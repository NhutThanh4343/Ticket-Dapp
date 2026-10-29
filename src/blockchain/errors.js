import { Interface } from 'ethers';
import { tourTicketAbi } from '../contracts/tourTicketAbi.js';

const contractInterface = new Interface(tourTicketAbi);
const messages = {
  Unauthorized: 'Ví hiện tại không có quyền quản trị.',
  EmptyTourName: 'Vui lòng nhập tên tour.',
  InvalidDepartureTime: 'Giờ khởi hành phải ở tương lai.',
  InvalidPrice: 'Giá vé phải lớn hơn 0.',
  InvalidTicketCount: 'Số lượng vé phải lớn hơn 0.',
  TourNotFound: 'Tour không tồn tại.',
  TicketNotFound: 'Vé không tồn tại.',
  TourAlreadyDeparted: 'Tour đã đến giờ khởi hành.',
  SoldOut: 'Tour đã hết vé.',
  IncorrectPayment: 'Số tiền gửi không đúng giá vé.',
  TicketAlreadyUsed: 'Vé đã được sử dụng.',
  PaymentTransferFailed: 'Không thể chuyển tiền đến ví quản trị.',
};

export class IntegrationError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'IntegrationError';
    this.code = code;
  }
}

export function toIntegrationError(error) {
  if (error instanceof IntegrationError) return error;
  const nested = [error, error?.error, error?.info?.error, error?.cause].filter(Boolean);
  const codes = nested.map((item) => item.code);
  if (codes.some((code) => code === 4001 || code === 'ACTION_REJECTED')) {
    return new IntegrationError('USER_REJECTED', 'Bạn đã từ chối yêu cầu trong ví.', error);
  }
  if (codes.includes('INSUFFICIENT_FUNDS')) {
    return new IntegrationError('INSUFFICIENT_FUNDS', 'Ví không đủ tiền thanh toán và phí gas.', error);
  }
  if (codes.includes('TRANSACTION_REPLACED')) {
    const cancelled = nested.some((item) => item.cancelled);
    return new IntegrationError(cancelled ? 'TRANSACTION_CANCELLED' : 'TRANSACTION_REPLACED',
      cancelled ? 'Giao dịch đã bị hủy hoặc thay bằng thao tác khác trong ví.' : 'Giao dịch đã bị thay thế. Hãy kiểm tra ví và tải lại dữ liệu.', error);
  }
  for (const item of nested) {
    const data = typeof item.data === 'string' ? item.data : item.data?.data;
    if (!data) continue;
    try {
      const decoded = contractInterface.parseError(data);
      if (decoded && messages[decoded.name]) {
        return new IntegrationError(decoded.name, messages[decoded.name], error);
      }
    } catch { /* Unrecognized revert data uses a fallback below. */ }
  }
  if (codes.includes('CALL_EXCEPTION')) {
    return new IntegrationError('CONTRACT_REVERT', 'Contract từ chối thao tác; không giải mã được nguyên nhân.', error);
  }
  if (codes.includes(-32002)) {
    return new IntegrationError('WALLET_REQUEST_PENDING', 'Ví đang có yêu cầu chờ xử lý. Hãy mở MetaMask.', error);
  }
  if (codes.some((code) => [4900, 4901, 'NETWORK_ERROR', 'SERVER_ERROR', 'TIMEOUT', 'OFFCHAIN_FAULT'].includes(code))) {
    return new IntegrationError('RPC_ERROR', 'Không thể kết nối mạng blockchain. Vui lòng thử lại.', error);
  }
  return new IntegrationError('UNKNOWN_ERROR', 'Không thể hoàn tất thao tác. Vui lòng thử lại.', error);
}

// A broken UI subscriber must not turn a confirmed transaction into a failure.
export function publish(listeners, value) {
  for (const listener of listeners) {
    try { listener(value); } catch (error) { console.error('Integration subscriber failed:', error); }
  }
}
