import { readBlockchainConfig } from './blockchain.js';
import { IntegrationError } from '../blockchain/errors.js';

export function readFrontendSettings(env = import.meta.env ?? {}) {
  const mode = env.VITE_DATA_MODE?.trim() || 'demo';
  if (!['demo', 'blockchain'].includes(mode)) {
    return { mode, config: null, error: new IntegrationError('CONFIG_ERROR', 'VITE_DATA_MODE chỉ nhận demo hoặc blockchain.') };
  }
  if (mode === 'demo') return { mode, config: null, error: null };
  try {
    return { mode, config: readBlockchainConfig(env), error: null };
  } catch (error) {
    return { mode, config: null, error };
  }
}
