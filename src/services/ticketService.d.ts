import type { Contract, ContractRunner, InterfaceAbi, Provider, Signer } from 'ethers';
import type { IntegrationError } from '../blockchain/errors.js';

export interface Tour {
  id: bigint;
  name: string;
  departureTime: bigint;
  price: bigint;
  totalTickets: bigint;
  soldTickets: bigint;
}

export interface Ticket {
  id: bigint;
  tourId: bigint;
  owner: string;
  isUsed: boolean;
}

export interface BlockchainConfig {
  chainId: bigint;
  rpcUrl: string;
  contractAddress: string;
  adminAddress: string;
}

export interface WalletSession {
  account: string;
  chainId: bigint;
  revision: number;
  signer: Signer;
}

type IntegerInput = bigint | string | number;
export interface CreateTourInput {
  name: string;
  departureTime: IntegerInput;
  price: IntegerInput;
  totalTickets: IntegerInput;
}

export interface TransactionState {
  status: 'idle' | 'preparing' | 'awaiting_signature' | 'pending' | 'success' | 'error';
  operation: string | null;
  txHash: string | null;
  account?: string | null;
  error?: IntegrationError;
  confirmed?: boolean;
  refresh?: ('tours' | 'myTickets')[];
  result?: { txHash: string; tourId?: bigint; ticketId?: bigint };
}

export interface TicketService {
  listTours(): Promise<Tour[]>;
  readTour(tourId: IntegerInput): Promise<Tour>;
  listMyTickets(): Promise<Ticket[]>;
  createTour(input: CreateTourInput): Promise<{ tourId: bigint; txHash: string }>;
  purchaseTicket(tourId: IntegerInput): Promise<{ ticketId: bigint; txHash: string }>;
  useTicket(ticketId: IntegerInput): Promise<{ txHash: string }>;
  getTransactionState(): TransactionState;
  subscribeTransactions(listener: (state: TransactionState) => void): () => void;
  destroy(): void;
}

export interface TicketServiceOptions {
  getConfig?: () => BlockchainConfig;
  wallet?: {
    getSession(): Promise<WalletSession>;
    assertSession(session: WalletSession): Promise<void>;
  };
  readProvider?: Provider;
  createContract?: (address: string, abi: InterfaceAbi, runner: ContractRunner) => Contract;
}

export function createTicketService(options?: TicketServiceOptions): TicketService;
export const ticketService: TicketService;
export const listTours: TicketService['listTours'];
export const readTour: TicketService['readTour'];
export const listMyTickets: TicketService['listMyTickets'];
export const createTour: TicketService['createTour'];
export const purchaseTicket: TicketService['purchaseTicket'];
export const useTicket: TicketService['useTicket'];
