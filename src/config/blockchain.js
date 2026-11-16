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
  if (![31337n, 11155111n].includes(BigInt(chain))) {
    throw new Error('Ứng dụng hỗ trợ Hardhat local (31337) và Sepolia (11155111).');
  }
  const rpcUrl = new URL(env.VITE_RPC_URL.trim());
  if (!['https:', 'http:'].includes(rpcUrl.protocol)) throw new Error('RPC URL phải dùng HTTP hoặc HTTPS.');
  const contractAddress = getAddress(env.VITE_CONTRACT_ADDRESS.trim());
  const adminAddress = getAddress(env.VITE_ADMIN_ADDRESS.trim());
  if (contractAddress === ZeroAddress || adminAddress === ZeroAddress) {
    throw new Error('Địa chỉ contract/admin không được là địa chỉ zero.');
  }
  const config = { chainId: BigInt(chain), rpcUrl: rpcUrl.href, contractAddress, adminAddress };
  if (env.VITE_DEPLOYMENT_BLOCK?.trim()) {
    if (!/^\d+$/.test(env.VITE_DEPLOYMENT_BLOCK.trim()) || !Number.isSafeInteger(Number(env.VITE_DEPLOYMENT_BLOCK))) {
      throw new Error('VITE_DEPLOYMENT_BLOCK phải là số block nguyên không âm an toàn.');
    }
    config.deploymentBlock = Number(env.VITE_DEPLOYMENT_BLOCK);
  }
  return Object.freeze(config);
}
