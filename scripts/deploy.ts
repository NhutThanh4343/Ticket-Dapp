import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { artifacts, globalOptions, network } from 'hardhat';

const { ethers } = await network.create();
const [signer] = await ethers.getSigners();
if (!signer) throw new Error('Không có ví triển khai cho mạng đã chọn.');
const chain = await ethers.provider.getNetwork();
if (![31337n, 11155111n].includes(chain.chainId)) throw new Error('Deployment chỉ hỗ trợ local (31337) hoặc Sepolia (11155111).');
const publicRpc = chain.chainId === 31337n ? process.env.TOURCHAIN_LOCAL_RPC_URL ?? 'http://127.0.0.1:8545' : process.env.SEPOLIA_PUBLIC_RPC_URL;
if (!publicRpc) throw new Error('Đặt SEPOLIA_PUBLIC_RPC_URL trước khi deploy; URL này sẽ được đưa vào frontend.');
const frontendProvider = new ethers.JsonRpcProvider(publicRpc);
try {
  if ((await frontendProvider.getNetwork()).chainId !== chain.chainId) throw new Error('RPC công khai không cùng mạng với ví triển khai.');
} finally { frontendProvider.destroy(); }
const artifact = await artifacts.readArtifact('TourTicketContract');
const recordDirectory = process.env.TOURCHAIN_DEPLOYMENT_DIR ?? 'deployments';
const recordPath = `${recordDirectory}/${chain.chainId}.json`;
let record: { address: string; admin: string; deploymentBlock: number; chainId: string; txHash: string; runtimeCodeHash?: string } | undefined;
if (process.env.TOURCHAIN_REUSE_DEPLOYMENT === '1') {
  try {
    const previous = JSON.parse(await readFile(recordPath, 'utf8'));
    const code = await ethers.provider.getCode(previous.address);
    if (code !== '0x' && code === artifact.deployedBytecode && previous.admin === signer.address) {
      const existing = await ethers.getContractAt('TourTicketContract', previous.address);
      if (await existing.admin() === signer.address) record = previous;
    }
  } catch { /* First deployment on this chain. */ }
}
if (!record) {
  const contract = await ethers.deployContract('TourTicketContract');
  await contract.waitForDeployment();
  const receipt = await contract.deploymentTransaction()!.wait();
  if (!receipt || receipt.status !== 1) throw new Error('Deployment chưa được xác nhận.');
  record = {
    address: await contract.getAddress(), admin: await contract.admin(), chainId: chain.chainId.toString(),
    deploymentBlock: receipt.blockNumber, txHash: receipt.hash,
    runtimeCodeHash: ethers.keccak256(await ethers.provider.getCode(await contract.getAddress())),
  };
}
await mkdir(recordDirectory, { recursive: true });
await writeFile(recordPath, JSON.stringify({ ...record, compiler: '0.8.34', evmVersion: 'cancun', buildProfile: globalOptions.buildProfile }, null, 2) + '\n');
await writeFile('src/contracts/tourTicketAbi.js', '// Generated from the artifact used for deployment.\nexport const tourTicketAbi = ' + JSON.stringify(artifact.abi, null, 2) + ';\n');
await writeFile('src/contracts/deploymentBytecode.js', '// Generated from solc 0.8.34, production profile (Cancun).\nexport const deploymentBytecode = ' + JSON.stringify(artifact.bytecode) + ';\n');
const envFile = process.env.TOURCHAIN_ENV_FILE ?? '.env.local';
let env = '';
try { env = await readFile(envFile, 'utf8'); } catch { /* Public frontend config is created below. */ }
const values = {
  VITE_DATA_MODE: 'blockchain', VITE_CHAIN_ID: record.chainId,
  VITE_RPC_URL: publicRpc,
  VITE_CONTRACT_ADDRESS: record.address, VITE_ADMIN_ADDRESS: record.admin, VITE_DEPLOYMENT_BLOCK: String(record.deploymentBlock),
};
if (!values.VITE_RPC_URL) throw new Error('Đặt SEPOLIA_RPC_URL cho frontend trước khi deploy Sepolia.');
for (const [key, value] of Object.entries(values)) {
  const pattern = new RegExp('^' + key + '=.*$', 'm');
  env = pattern.test(env) ? env.replace(pattern, () => key + '=' + value) : env.trimEnd() + '\n' + key + '=' + value + '\n';
}
await writeFile(envFile, env.trimStart());
console.log(`Contract: ${record.address}\nAdmin: ${record.admin}\nChain: ${record.chainId}\nDeployment block: ${record.deploymentBlock}\nĐã cập nhật ABI và cấu hình frontend công khai.`);
