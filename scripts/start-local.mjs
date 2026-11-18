import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Starts only loopback services. Ctrl+C stops the processes owned by this launcher.
const children = new Set();
const e2e = process.argv.includes('--e2e');
const rpcPort = e2e ? 18545 : 8545;
const webPort = e2e ? 4173 : 5173;
const rpcUrl = `http://127.0.0.1:${rpcPort}`;
const recordDirectory = e2e ? '.local/e2e/deployments' : 'deployments';
let stopping = false;
function child(args, extraEnv = {}) {
  const proc = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true, env: { ...process.env, ...extraEnv } });
  children.add(proc);
  proc.on('exit', () => children.delete(proc));
  return proc;
}
async function run(args, env) {
  const proc = child(args, env);
  const code = await new Promise((resolve, reject) => { proc.once('error', reject); proc.once('exit', resolve); });
  if (code !== 0) throw new Error(`Command exited with code ${code}`);
}
function stop() {
  if (stopping) return;
  stopping = true;
  for (const proc of children) proc.kill('SIGTERM');
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
async function ready() {
  try {
    const response = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(1000) });
    const data = await response.json();
    if (data.result && data.result !== '0x7a69') throw new Error(`Port ${rpcPort} đang phục vụ mạng khác; hãy dừng dịch vụ đó trước.`);
    return data.result === '0x7a69';
  } catch (error) {
    if (error.message.includes('mạng khác')) throw error;
    return false;
  }
}
try {
  const running = await ready();
  if (e2e && running) throw new Error('Port test 18545 đang được sử dụng.');
  if (!running) {
    const chain = child(['node_modules/hardhat/dist/src/cli.js', 'node', '--hostname', '127.0.0.1', '--port', String(rpcPort)]);
    let available = false;
    for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
      if (chain.exitCode !== null) throw new Error('Không khởi động được blockchain local.');
      if (await ready()) { available = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!available || stopping) throw new Error('Blockchain local chưa sẵn sàng.');
  }
  await run(['node_modules/hardhat/dist/src/cli.js', 'run', 'scripts/deploy.ts', '--network', 'localhost', '--build-profile', 'production'], {
    TOURCHAIN_REUSE_DEPLOYMENT: e2e ? '0' : '1', TOURCHAIN_LOCAL_RPC_URL: rpcUrl,
    TOURCHAIN_ENV_FILE: e2e ? '.env.e2e.local' : '.env.local', TOURCHAIN_DEPLOYMENT_DIR: recordDirectory,
  });
  const deployment = JSON.parse(await readFile(`${recordDirectory}/31337.json`, 'utf8'));
  console.log(`\nTourChain local — admin: ${deployment.admin}\nFrontend: http://127.0.0.1:${webPort}\n`);
  const web = child(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort', ...(e2e ? ['--mode', 'e2e'] : [])]);
  await new Promise((resolve, reject) => { web.once('error', reject); web.once('exit', resolve); });
} catch (error) {
  if (!stopping) { console.error(error.message); process.exitCode = 1; }
} finally { stop(); }
