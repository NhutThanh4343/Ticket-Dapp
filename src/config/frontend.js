import { readBlockchainConfig } from './blockchain.js';
import { IntegrationError } from '../blockchain/errors.js';

export function readFrontendSettings(env = import.meta.env ?? {}) {
  const mode = env.VITE_DATA_MODE?.trim() || 'blockchain';
  if (mode !== 'blockchain') {
    return { mode: 'blockchain', config: null, error: new IntegrationError('CONFIG_ERROR', 'Ứng dụng chỉ sử dụng dữ liệu blockchain. Đặt VITE_DATA_MODE=blockchain.') };
  }
  try {
    return { mode, config: readBlockchainConfig(env), error: null };
  } catch (error) {
    return { mode, config: null, error };
  }
}
