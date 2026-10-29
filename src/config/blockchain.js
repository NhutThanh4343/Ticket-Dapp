import { getAddress, ZeroAddress } from 'ethers';
import { IntegrationError } from '../blockchain/errors.js';

// Lazy validation lets the UI render setup instructions before deployment exists.
export function readBlockchainConfig(env = import.meta.env ?? {}) {
  try {
    return validateConfig(env);
  } catch (error) {
    throw new IntegrationError('CONFIG_ERROR', error.message, error);
  }
}

function validateConfig(env) {
  const required = ['VITE_CHAIN_ID', 'VITE_RPC_URL', 'VITE_CONTRACT_ADDRESS', 'VITE_ADMIN_ADDRESS'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Thiếu cấu hình blockchain: ${missing.join(', ')}`);

  const chain = env.VITE_CHAIN_ID.trim();
  if (!/^(?:[1-9]\d*|0x[0-9a-f]+)$/i.test(chain) || BigInt(chain) <= 0n) {
    throw new Error('VITE_CHAIN_ID phải là số nguyên dương (thập phân hoặc hex).');
  }
  const rpcUrl = new URL(env.VITE_RPC_URL.trim());
  if (!['https:', 'http:'].includes(rpcUrl.protocol)) throw new Error('RPC URL phải dùng HTTP hoặc HTTPS.');
  const contractAddress = getAddress(env.VITE_CONTRACT_ADDRESS.trim());
  const adminAddress = getAddress(env.VITE_ADMIN_ADDRESS.trim());
  if (contractAddress === ZeroAddress || adminAddress === ZeroAddress) {
    throw new Error('Địa chỉ contract/admin không được là địa chỉ zero.');
  }
  return Object.freeze({ chainId: BigInt(chain), rpcUrl: rpcUrl.href, contractAddress, adminAddress });
}
