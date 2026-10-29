import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { BrowserProvider, Interface, MaxUint256, parseEther } from 'ethers';
import {
  readBlockchainConfig, tourTicketAbi, createWalletService, createTicketService,
  IntegrationError, toIntegrationError,
} from '../src/index.js';

// TEST FIXTURES only, not deployment addresses or network configuration.
const admin = '0x0000000000000000000000000000000000000001';
const buyer = '0x0000000000000000000000000000000000000002';
const address = '0x0000000000000000000000000000000000000003';
const config = { chainId: 31337n, rpcUrl: 'http://localhost:8545/', contractAddress: address, adminAddress: admin };
const abi = new Interface(tourTicketAbi);
const tour = { id: 0n, name: 'Đà Lạt', departureTime: 1893456000n, price: parseEther('0.01'), totalTickets: 30n, soldTickets: 0n };
const ticket = { id: 0n, tourId: 0n, owner: buyer, isUsed: false };
const txHash = `0x${'1'.repeat(64)}`;
const getConfig = () => config;
const hasCode = (code) => (error) => error.code === code;

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

class MetaMask extends EventEmitter {
  isMetaMask = true;
  accounts = [buyer];
  chainId = '0x7a69';
  requests = [];
  async request({ method, params }) {
    this.requests.push(method);
    if (method === 'eth_requestAccounts') {
      this.emit('accountsChanged', this.accounts);
      return this.accounts;
    }
    if (method === 'eth_accounts') return this.accounts;
    if (method === 'eth_chainId') return this.chainId;
    if (method === 'wallet_switchEthereumChain') {
      this.chainId = params[0].chainId;
      this.emit('chainChanged', this.chainId);
      return null;
    }
    throw new Error(`Unexpected RPC: ${method}`);
  }
}

function receipt(eventName, values, overrides = {}) {
  const log = abi.encodeEventLog(abi.getEvent(eventName), values);
  return { status: 1, hash: txHash, logs: [{ ...log, address }], ...overrides };
}

function fixture() {
  const calls = [];
  const rpc = { getNetwork: async () => ({ chainId: config.chainId }), getCode: async () => '0x1234' };
  const signer = { provider: rpc };
  const session = { account: buyer, chainId: config.chainId, revision: 1, signer };
  const wallet = { getSession: async () => session, assertSession: async () => {} };
  const response = (data) => ({ hash: txHash, wait: async () => data });
  const contract = {
    interface: abi,
    getTours: async () => [tour],
    getTour: async (id) => { calls.push(['getTour', id]); return tour; },
    getMyTickets: async () => [ticket],
    createTour: async (...args) => { calls.push(['createTour', ...args]); return response(receipt('TourCreated', [0n, admin])); },
    buyTicket: async (...args) => { calls.push(['buyTicket', ...args]); return response(receipt('TicketPurchased', [0n, 0n, buyer, tour.price])); },
    markTicketUsed: async (id) => { calls.push(['markTicketUsed', id]); return response(receipt('TicketUsed', [0n, admin])); },
  };
  const service = createTicketService({
    getConfig, wallet, readProvider: rpc,
    createContract: (target, contractAbi, runner) => {
      assert.equal(target, address);
      calls.push(['runner', runner]);
      return contract;
    },
  });
  return { service, calls, rpc, wallet, contract, signer, session };
}

test('configuration has no deployment defaults and validates exact integer chain IDs', () => {
  assert.throws(() => readBlockchainConfig({}), hasCode('CONFIG_ERROR'));
  const env = {
    VITE_CHAIN_ID: '0x7a69', VITE_RPC_URL: config.rpcUrl,
    VITE_CONTRACT_ADDRESS: address, VITE_ADMIN_ADDRESS: admin,
  };
  assert.deepEqual(readBlockchainConfig(env), config);
  for (const value of ['0', '-1', '1.2', '1e3']) {
    assert.throws(() => readBlockchainConfig({ ...env, VITE_CHAIN_ID: value }), hasCode('CONFIG_ERROR'));
  }
  assert.throws(() => readBlockchainConfig({ ...env, VITE_RPC_URL: 'file:///tmp/rpc' }), hasCode('CONFIG_ERROR'));
  assert.throws(() => readBlockchainConfig({ ...env, VITE_CONTRACT_ADDRESS: `0x${'0'.repeat(40)}` }), hasCode('CONFIG_ERROR'));
});

test('ABI round trips tuples in the agreed order without losing large uint256 values', () => {
  const bigTour = { ...tour, id: 9007199254740993n, price: MaxUint256 };
  const encoded = abi.encodeFunctionResult('getTour', [Object.values(bigTour)]);
  const [decoded] = abi.decodeFunctionResult('getTour', encoded);
  assert.equal(decoded.id, bigTour.id);
  assert.equal(decoded.price, MaxUint256);
  assert.equal(decoded.soldTickets, 0n);
  assert.equal(abi.getFunction('buyTicket').payable, true);
  assert.equal(abi.getFunction('markTicketUsed').outputs.length, 0);
});

test('MetaMask connection accepts initial accountsChanged and restore does not request permission', async () => {
  const ethereum = new MetaMask();
  const wallet = createWalletService({ getConfig, ethereum });
  assert.equal((await wallet.connect()).account, buyer);
  const session = await wallet.getSession();
  assert.equal(await session.signer.getAddress(), buyer);
  ethereum.requests.length = 0;
  await wallet.restore();
  assert.ok(!ethereum.requests.includes('eth_requestAccounts'));
  wallet.disconnect();
  assert.equal(ethereum.listenerCount('accountsChanged'), 0);
});

test('wallet events invalidate old sessions and update admin/network flags', async () => {
  const ethereum = new MetaMask();
  const wallet = createWalletService({ getConfig, ethereum });
  const states = [];
  const unsubscribe = wallet.subscribe((state) => states.push(state));
  await wallet.connect();
  const previous = await wallet.getSession();
  ethereum.accounts = [admin];
  ethereum.emit('accountsChanged', ethereum.accounts);
  assert.equal(wallet.getState().isAdmin, true);
  await assert.rejects(wallet.assertSession(previous), hasCode('WALLET_CHANGED'));
  ethereum.chainId = '0x1';
  ethereum.emit('chainChanged', ethereum.chainId);
  await assert.rejects(wallet.getSession(), hasCode('WRONG_NETWORK'));
  assert.equal((await wallet.switchNetwork()).isCorrectNetwork, true);
  ethereum.accounts = [];
  ethereum.emit('accountsChanged', []);
  assert.equal(wallet.getState().connected, false);
  assert.ok(states.length >= 4);
  unsubscribe();
  wallet.disconnect();
});

test('user rejection maps errors; local disconnect works before configuration', async () => {
  const ethereum = new MetaMask();
  ethereum.request = async () => { throw { code: 4001 }; };
  const wallet = createWalletService({ getConfig, ethereum });
  await assert.rejects(wallet.connect(), hasCode('USER_REJECTED'));
  wallet.disconnect();
  createWalletService().disconnect();
  await assert.rejects(createWalletService({ getConfig, ethereum: {} }).connect(), hasCode('METAMASK_NOT_FOUND'));
});

test('disconnect during a pending connection cannot reconnect the UI', async () => {
  const ethereum = new MetaMask();
  const approval = deferred();
  const original = ethereum.request.bind(ethereum);
  ethereum.request = (request) => request.method === 'eth_requestAccounts' ? approval.promise : original(request);
  const wallet = createWalletService({ getConfig, ethereum });
  const pending = wallet.connect();
  wallet.disconnect();
  approval.resolve([buyer]);
  await assert.rejects(pending, hasCode('WALLET_CHANGED'));
  assert.equal(wallet.getState().connected, false);
});

test('public reads do not access the wallet; empty arrays and ID zero are valid', async () => {
  const { service, wallet, contract, calls } = fixture();
  wallet.getSession = async () => { throw new Error('Public reads must not use wallet'); };
  assert.deepEqual(await service.listTours(), [tour]);
  assert.deepEqual(await service.readTour(0n), tour);
  assert.ok(calls.some(([name, id]) => name === 'getTour' && id === 0n));
  contract.getTours = async () => [];
  assert.deepEqual(await service.listTours(), []);
});

test('real ethers Contract reads public tuples and sends the current caller for getMyTickets', async () => {
  const ethereum = new MetaMask();
  const original = ethereum.request.bind(ethereum);
  const contractCalls = [];
  ethereum.request = async (request) => {
    if (request.method === 'eth_getCode') return '0x1234';
    if (request.method === 'eth_call') {
      const transaction = request.params[0];
      const method = abi.parseTransaction({ data: transaction.data });
      contractCalls.push({ name: method.name, transaction });
      if (method.name === 'getTours') return abi.encodeFunctionResult('getTours', [[Object.values(tour)]]);
      if (method.name === 'getTour') return abi.encodeFunctionResult('getTour', [Object.values(tour)]);
      if (method.name === 'getMyTickets') return abi.encodeFunctionResult('getMyTickets', [[Object.values(ticket)]]);
    }
    return original(request);
  };
  const wallet = createWalletService({ getConfig, ethereum });
  const rpc = new BrowserProvider(ethereum);
  const service = createTicketService({ getConfig, wallet, readProvider: rpc });
  try {
    assert.deepEqual(await service.listTours(), [tour]);
    assert.deepEqual(await service.readTour(0n), tour);
    assert.equal(contractCalls[0].transaction.from, undefined);
    assert.ok(!ethereum.requests.includes('eth_requestAccounts'));
    await wallet.connect();
    assert.deepEqual(await service.listMyTickets(), [ticket]);
    const privateRead = contractCalls.find((call) => call.name === 'getMyTickets');
    assert.equal(privateRead.transaction.from.toLowerCase(), buyer);
    assert.ok(!ethereum.requests.includes('eth_sendTransaction'));
  } finally {
    wallet.disconnect();
    service.destroy();
    rpc.destroy();
  }
});

test('my tickets use the current signer and discard results after a wallet change', async () => {
  const { service, wallet, calls, signer } = fixture();
  assert.deepEqual(await service.listMyTickets(), [ticket]);
  assert.ok(calls.some(([name, runner]) => name === 'runner' && runner === signer));
  wallet.assertSession = async () => { throw new IntegrationError('WALLET_CHANGED', 'changed'); };
  await assert.rejects(service.listMyTickets(), hasCode('WALLET_CHANGED'));
});

test('all write wrappers confirm receipt events and preserve ID zero', async () => {
  const { service, calls } = fixture();
  const states = [];
  service.subscribeTransactions((state) => states.push(state));
  assert.deepEqual(await service.createTour({ ...tour, name: '  Đà Lạt  ' }), { tourId: 0n, txHash });
  assert.deepEqual(calls.find(([name]) => name === 'createTour'), ['createTour', 'Đà Lạt', tour.departureTime, tour.price, tour.totalTickets]);
  assert.deepEqual(await service.purchaseTicket('0'), { ticketId: 0n, txHash });
  assert.deepEqual(calls.find(([name]) => name === 'buyTicket'), ['buyTicket', 0n, { value: tour.price }]);
  assert.deepEqual(await service.useTicket(0n), { txHash });
  assert.deepEqual(states.slice(0, 4).map((state) => state.status), ['preparing', 'awaiting_signature', 'pending', 'success']);
  assert.deepEqual(states.find((state) => state.status === 'success' && state.operation === 'purchaseTicket').refresh, ['tours', 'myTickets']);
});

test('no success before confirmation and duplicate writes are blocked', async () => {
  const { service, contract } = fixture();
  const mined = deferred();
  const sent = deferred();
  contract.buyTicket = async () => ({ hash: txHash, wait: () => { sent.resolve(); return mined.promise; } });
  const pending = service.purchaseTicket(0n);
  await sent.promise;
  assert.equal(service.getTransactionState().status, 'pending');
  await assert.rejects(service.useTicket(0n), hasCode('TRANSACTION_PENDING'));
  mined.resolve(receipt('TicketPurchased', [0n, 0n, buyer, tour.price]));
  await pending;
  assert.equal(service.getTransactionState().status, 'success');
});

test('receipt logs from a different contract cannot supply a ticket ID', async () => {
  const { service, contract } = fixture();
  const data = receipt('TicketPurchased', [999n, 0n, buyer, tour.price]);
  data.logs[0].address = admin;
  contract.buyTicket = async () => ({ hash: txHash, wait: async () => data });
  await assert.rejects(service.purchaseTicket(0n), hasCode('RECEIPT_EVENT_MISSING'));
  assert.equal(service.getTransactionState().confirmed, true);
  assert.deepEqual(service.getTransactionState().refresh, ['tours', 'myTickets']);
});

test('reverted receipts are not reported as success', async () => {
  const { service, contract } = fixture();
  contract.markTicketUsed = async () => ({ hash: txHash, wait: async () => ({ status: 0, hash: txHash, logs: [] }) });
  await assert.rejects(service.useTicket(0n), hasCode('TRANSACTION_FAILED'));
  assert.equal(service.getTransactionState().confirmed, false);
});

test('repricing uses the mined replacement hash; cancellation is an error', async () => {
  const { service, contract } = fixture();
  const replacementHash = `0x${'2'.repeat(64)}`;
  contract.buyTicket = async () => ({ hash: txHash, wait: async () => {
    throw { code: 'TRANSACTION_REPLACED', reason: 'repriced', cancelled: false,
      receipt: receipt('TicketPurchased', [0n, 0n, buyer, tour.price], { hash: replacementHash }) };
  } });
  assert.equal((await service.purchaseTicket(0n)).txHash, replacementHash);
  contract.buyTicket = async () => ({ hash: txHash, wait: async () => {
    throw { code: 'TRANSACTION_REPLACED', reason: 'cancelled', cancelled: true };
  } });
  await assert.rejects(service.purchaseTicket(0n), hasCode('TRANSACTION_CANCELLED'));
});

test('RPC on wrong chain or an empty deployment is rejected before contract calls', async () => {
  const { service, rpc, calls } = fixture();
  rpc.getNetwork = async () => ({ chainId: 1n });
  await assert.rejects(service.listTours(), hasCode('WRONG_NETWORK'));
  rpc.getNetwork = async () => ({ chainId: config.chainId });
  rpc.getCode = async () => '0x';
  await assert.rejects(service.listTours(), hasCode('CONTRACT_NOT_DEPLOYED'));
  assert.equal(calls.length, 0);
});

test('unsafe numbers, negative IDs, invalid prices and counts never reach writes', async () => {
  const { service, calls } = fixture();
  for (const id of [Number.MAX_SAFE_INTEGER + 1, -1, 1.1, '1e3', '', MaxUint256 + 1n]) {
    await assert.rejects(service.purchaseTicket(id), hasCode('INVALID_INPUT'));
  }
  await assert.rejects(service.createTour({ ...tour, price: 0n }), hasCode('InvalidPrice'));
  await assert.rejects(service.createTour({ ...tour, totalTickets: 0n }), hasCode('InvalidTicketCount'));
  await assert.rejects(service.createTour({ ...tour, name: '  ' }), hasCode('EmptyTourName'));
  assert.ok(!calls.some(([name]) => ['buyTicket', 'createTour'].includes(name)));
});

test('wallet switch during price lookup prevents submitting a transaction', async () => {
  const { service, wallet, contract, calls } = fixture();
  let changed = false;
  contract.getTour = async () => { changed = true; return tour; };
  wallet.assertSession = async () => { if (changed) throw new IntegrationError('WALLET_CHANGED', 'changed'); };
  await assert.rejects(service.purchaseTicket(0n), hasCode('WALLET_CHANGED'));
  assert.ok(!calls.some(([name]) => name === 'buyTicket'));
});

test('all twelve custom errors decode and provider errors keep a useful fallback', () => {
  const names = ['Unauthorized', 'EmptyTourName', 'InvalidDepartureTime', 'InvalidPrice', 'InvalidTicketCount',
    'TourNotFound', 'TicketNotFound', 'TourAlreadyDeparted', 'SoldOut', 'IncorrectPayment', 'TicketAlreadyUsed', 'PaymentTransferFailed'];
  for (const name of names) {
    const error = { code: 'CALL_EXCEPTION', info: { error: { data: abi.encodeErrorResult(name) } } };
    assert.equal(toIntegrationError(error).code, name);
  }
  assert.equal(toIntegrationError({ code: 'INSUFFICIENT_FUNDS' }).code, 'INSUFFICIENT_FUNDS');
  assert.equal(toIntegrationError({ code: 'NETWORK_ERROR' }).code, 'RPC_ERROR');
  assert.equal(toIntegrationError({ code: 'CALL_EXCEPTION', data: '0x12345678' }).code, 'CONTRACT_REVERT');
  assert.equal(toIntegrationError(new Error('unknown')).code, 'UNKNOWN_ERROR');
});
