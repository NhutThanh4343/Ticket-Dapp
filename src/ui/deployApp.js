import { BrowserProvider, Contract, ContractFactory, JsonRpcProvider, getAddress, toQuantity } from 'ethers';
import { tourTicketAbi } from '../contracts/tourTicketAbi.js';
import { deploymentBytecode } from '../contracts/deploymentBytecode.js';
import { toIntegrationError } from '../blockchain/errors.js';

const $ = (id) => document.getElementById(id);
let account = null;
let busy = false;
let output = '';
const available = window.ethereum;
const ethereum = available?.providers?.find((provider) => provider.isMetaMask) ?? available;
function changed() {
  account = null;
  $('tc-deploy-account').textContent = 'Ví hoặc mạng vừa thay đổi. Hãy kết nối lại để triển khai.';
  $('tc-deploy-submit').disabled = true;
}
ethereum?.on('accountsChanged', changed);
ethereum?.on('chainChanged', changed);
$('tc-deploy-network').addEventListener('change', () => {
  $('tc-deploy-rpc').value = $('tc-deploy-network').value === '31337' ? 'http://127.0.0.1:8545' : '';
});
$('tc-deploy-connect').addEventListener('click', async () => {
  if (busy) return;
  try {
    if (!ethereum?.isMetaMask) throw new Error('Vui lòng cài đặt MetaMask.');
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts[0]) throw new Error('Chưa có tài khoản được cấp quyền.');
    account = getAddress(accounts[0]);
    $('tc-deploy-account').textContent = `Ví admin sẽ là: ${account}`;
    $('tc-deploy-submit').disabled = false;
  } catch (error) { $('tc-deploy-status').textContent = error.code ? toIntegrationError(error).message : error.message; }
});
$('tc-deploy-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!account || busy) return;
  busy = true;
  $('tc-deploy-submit').disabled = true;
  $('tc-deploy-connect').disabled = true;
  $('tc-deploy-download').hidden = true;
  $('tc-deploy-network').disabled = true;
  $('tc-deploy-rpc').disabled = true;
  output = '';
  let rpc;
  let hash;
  try {
    const chainId = BigInt($('tc-deploy-network').value);
    if (![31337n, 11155111n].includes(chainId)) throw new Error('Chỉ hỗ trợ local và Sepolia.');
    const rpcUrl = new URL($('tc-deploy-rpc').value.trim());
    if (!['http:', 'https:'].includes(rpcUrl.protocol) || rpcUrl.username || rpcUrl.password) throw new Error('RPC phải là URL HTTP(S) công khai không chứa mật khẩu.');
    rpc = new JsonRpcProvider(rpcUrl.href, undefined, { cacheTimeout: 0 });
    if ((await rpc.getNetwork()).chainId !== chainId) throw new Error('RPC không thuộc mạng đã chọn.');
    const origin = account;
    try { await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toQuantity(chainId) }] }); }
    catch (error) {
      if (error.code !== 4902) throw error;
      await ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: toQuantity(chainId), chainName: chainId === 31337n ? 'TourChain Local' : 'Sepolia', rpcUrls: [rpcUrl.href], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } }] });
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toQuantity(chainId) }] });
    }
    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner(origin);
    const [accounts, activeChain] = await Promise.all([ethereum.request({ method: 'eth_accounts' }), ethereum.request({ method: 'eth_chainId' })]);
    if (!accounts[0] || getAddress(accounts[0]) !== origin || BigInt(activeChain) !== chainId) throw new Error('Ví hoặc mạng vừa thay đổi. Kết nối lại trước khi triển khai.');
    $('tc-deploy-status').textContent = 'Hãy kiểm tra mạng, ví admin và phí gas trong MetaMask rồi xác nhận triển khai.';
    const contract = await new ContractFactory(tourTicketAbi, deploymentBytecode, signer).deploy();
    hash = contract.deploymentTransaction().hash;
    $('tc-deploy-status').textContent = `Đã gửi deployment. Đang chờ xác nhận: ${hash}`;
    const receipt = await rpc.waitForTransaction(hash, 1, 180000);
    if (!receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error('Chưa có receipt triển khai thành công. Kiểm tra hash trong ví trước khi thử lại.');
    const admin = await new Contract(receipt.contractAddress, tourTicketAbi, rpc).admin();
    if (getAddress(admin) !== origin) throw new Error('Ví admin trên chuỗi không khớp ví triển khai.');
    output = `VITE_DATA_MODE=blockchain\nVITE_CHAIN_ID=${chainId}\nVITE_RPC_URL=${rpcUrl.href}\nVITE_CONTRACT_ADDRESS=${receipt.contractAddress}\nVITE_ADMIN_ADDRESS=${admin}\nVITE_DEPLOYMENT_BLOCK=${receipt.blockNumber}\n`;
    $('tc-deploy-result').textContent = output;
    $('tc-deploy-status').textContent = `Triển khai đã xác nhận. Mã giao dịch: ${receipt.hash}`;
    $('tc-deploy-download').hidden = false;
  } catch (error) {
    $('tc-deploy-status').textContent = (error.code ? toIntegrationError(error).message : error.message) + (hash ? ` Hash: ${hash}. Kiểm tra giao dịch trước khi triển khai lại.` : '');
  } finally {
    rpc?.destroy();
    busy = false;
    $('tc-deploy-connect').disabled = false;
    $('tc-deploy-network').disabled = false;
    $('tc-deploy-rpc').disabled = false;
    $('tc-deploy-submit').disabled = !account;
  }
});
$('tc-deploy-download').addEventListener('click', () => {
  if (!output) return;
  const url = URL.createObjectURL(new Blob([output], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'tourchain.env.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
