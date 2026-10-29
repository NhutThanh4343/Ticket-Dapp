import { Contract, JsonRpcProvider, MaxUint256 } from 'ethers';
import { readBlockchainConfig } from '../config/blockchain.js';
import { tourTicketAbi } from '../contracts/tourTicketAbi.js';
import { IntegrationError, publish, toIntegrationError } from '../blockchain/errors.js';
import { walletService } from './walletService.js';

function uint(value, label) {
  if ((typeof value === 'number' && !Number.isSafeInteger(value)) ||
      !['bigint', 'string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value))) {
    throw new IntegrationError('INVALID_INPUT', `${label} phải là số nguyên không âm chính xác.`);
  }
  const result = BigInt(value);
  if (result > MaxUint256) throw new IntegrationError('INVALID_INPUT', `${label} vượt giới hạn uint256.`);
  return result;
}

const tourObject = (tour) => ({
  id: tour.id, name: tour.name, departureTime: tour.departureTime,
  price: tour.price, totalTickets: tour.totalTickets, soldTickets: tour.soldTickets,
});
const ticketObject = (ticket) => ({ id: ticket.id, tourId: ticket.tourId, owner: ticket.owner, isUsed: ticket.isUsed });

// Dependencies can be supplied for tests or a host app's existing RPC provider.
export function createTicketService({
  getConfig = readBlockchainConfig,
  wallet = walletService,
  readProvider,
  createContract = (address, abi, runner) => new Contract(address, abi, runner),
} = {}) {
  let provider = readProvider;
  let transaction = { status: 'idle', operation: null, txHash: null };
  let busy = false;
  const listeners = new Set();
  const getTransactionState = () => ({ ...transaction });
  function status(value) {
    transaction = value;
    publish(listeners, getTransactionState());
  }

  async function checkedContract(runner) {
    const config = getConfig();
    const rpc = runner.provider ?? runner;
    const network = await rpc.getNetwork();
    if (network.chainId !== config.chainId) throw new IntegrationError('WRONG_NETWORK', `RPC/ví phải dùng chain ID ${config.chainId}.`);
    const code = await rpc.getCode(config.contractAddress);
    if (code === '0x' || /^0x0*$/.test(code)) {
      throw new IntegrationError('CONTRACT_NOT_DEPLOYED', 'Không có contract tại địa chỉ trên mạng đã cấu hình.');
    }
    return createContract(config.contractAddress, tourTicketAbi, runner);
  }

  async function publicContract() {
    provider ??= new JsonRpcProvider(getConfig().rpcUrl);
    return checkedContract(provider);
  }

  async function read(action) {
    try { return await action(); } catch (error) { throw toIntegrationError(error); }
  }

  // Receipt logs must come from this deployment, not another contract emitting the same event.
  function eventFrom(receipt, contract, eventName) {
    const address = getConfig().contractAddress.toLowerCase();
    for (const log of receipt.logs) {
      if (log.address?.toLowerCase() !== address) continue;
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === eventName) return parsed.args;
      } catch { /* Other logs are not part of this ABI. */ }
    }
    throw new IntegrationError('RECEIPT_EVENT_MISSING', `Giao dịch đã xác nhận nhưng thiếu event ${eventName}; kiểm tra ABI và tải lại dữ liệu.`);
  }

  async function write(operation, send, eventName, resultFrom, refresh) {
    if (busy) throw new IntegrationError('TRANSACTION_PENDING', 'Đang có giao dịch chờ xử lý.');
    busy = true;
    let hash = null;
    let session;
    let confirmed = false;
    try {
      status({ status: 'preparing', operation, txHash: null });
      session = await wallet.getSession();
      const contract = await checkedContract(session.signer);
      await wallet.assertSession(session);
      status({ status: 'awaiting_signature', operation, txHash: null, account: session.account });
      const tx = await send(contract, session);
      hash = tx.hash;
      status({ status: 'pending', operation, txHash: hash, account: session.account });
      let receipt;
      try {
        receipt = await tx.wait();
      } catch (error) {
        // Speed-up transactions keep the same intent. Cancellation/replacement does not.
        if (error.code !== 'TRANSACTION_REPLACED' || error.cancelled || error.reason !== 'repriced') throw error;
        receipt = error.receipt;
      }
      if (!receipt || receipt.status !== 1) throw new IntegrationError('TRANSACTION_FAILED', 'Giao dịch không được xác nhận thành công.');
      confirmed = true;
      hash = receipt.hash ?? hash;
      const args = eventFrom(receipt, contract, eventName);
      const result = { ...resultFrom(args), txHash: hash };
      // Keep the originating account: a pending transaction can confirm after switching wallets.
      status({ status: 'success', operation, txHash: hash, account: session.account, result, refresh });
      return result;
    } catch (error) {
      const failure = toIntegrationError(error);
      status({ status: 'error', operation, txHash: hash, account: session?.account ?? null, error: failure, confirmed, refresh: confirmed ? refresh : [] });
      throw failure;
    } finally {
      busy = false;
    }
  }

  return {
    listTours: () => read(async () => (await (await publicContract()).getTours()).map(tourObject)),
    readTour: (tourId) => read(async () => tourObject(await (await publicContract()).getTour(uint(tourId, 'ID tour')))),
    listMyTickets: () => read(async () => {
      const session = await wallet.getSession();
      const contract = await checkedContract(session.signer);
      const tickets = await contract.getMyTickets();
      await wallet.assertSession(session);
      return tickets.map(ticketObject);
    }),
    createTour: (input) => write('createTour', async (contract, session) => {
      const name = typeof input?.name === 'string' ? input.name.trim() : '';
      if (!name) throw new IntegrationError('EmptyTourName', 'Vui lòng nhập tên tour.');
      const departureTime = uint(input.departureTime, 'Giờ khởi hành');
      const price = uint(input.price, 'Giá vé (wei)');
      const totalTickets = uint(input.totalTickets, 'Số vé');
      if (price === 0n) throw new IntegrationError('InvalidPrice', 'Giá vé phải lớn hơn 0.');
      if (totalTickets === 0n) throw new IntegrationError('InvalidTicketCount', 'Số lượng vé phải lớn hơn 0.');
      await wallet.assertSession(session);
      return contract.createTour(name, departureTime, price, totalTickets);
    }, 'TourCreated', (args) => ({ tourId: args.tourId }), ['tours']),
    purchaseTicket: (tourId) => write('purchaseTicket', async (contract, session) => {
      const id = uint(tourId, 'ID tour');
      const tour = await contract.getTour(id);
      await wallet.assertSession(session);
      return contract.buyTicket(id, { value: tour.price });
    }, 'TicketPurchased', (args) => ({ ticketId: args.ticketId }), ['tours', 'myTickets']),
    useTicket: (ticketId) => write('useTicket', async (contract, session) => {
      const id = uint(ticketId, 'ID vé');
      await wallet.assertSession(session);
      return contract.markTicketUsed(id);
    },
      'TicketUsed', () => ({}), ['myTickets']),
    getTransactionState,
    subscribeTransactions(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (!readProvider) provider?.destroy();
      provider = undefined;
      listeners.clear();
    },
  };
}

export const ticketService = createTicketService();
export const { listTours, readTour, createTour, purchaseTicket, listMyTickets, useTicket } = ticketService;
