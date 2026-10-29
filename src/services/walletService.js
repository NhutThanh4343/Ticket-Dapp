import { BrowserProvider, getAddress, toQuantity } from 'ethers';
import { readBlockchainConfig } from '../config/blockchain.js';
import { IntegrationError, publish, toIntegrationError } from '../blockchain/errors.js';

export function createWalletService({ getConfig = readBlockchainConfig, ethereum } = {}) {
  let injected;
  let revision = 0;
  let lifecycle = 0;
  let connecting;
  const listeners = new Set();
  let state = { account: null, chainId: null, connected: false, isAdmin: false, isCorrectNetwork: false, revision };

  const getState = () => ({ ...state });
  function update(account, chainId) {
    const config = account || chainId !== null ? getConfig() : null;
    state = {
      account: account ? getAddress(account) : null,
      chainId,
      connected: Boolean(account),
      isAdmin: Boolean(account && getAddress(account) === config?.adminAddress),
      isCorrectNetwork: Boolean(config && chainId === config.chainId),
      revision: ++revision,
    };
    publish(listeners, getState());
    return getState();
  }
  const onAccountsChanged = (accounts) => update(accounts[0] ?? null, state.chainId);
  const onChainChanged = (chainId) => update(state.account, BigInt(chainId));
  const onDisconnect = () => { lifecycle++; update(null, null); };

  function getEthereum() {
    if (injected) return injected;
    const available = ethereum ?? globalThis.window?.ethereum;
    const selected = available?.providers?.find((provider) => provider.isMetaMask) ?? available;
    if (!selected?.isMetaMask || typeof selected.request !== 'function') {
      throw new IntegrationError('METAMASK_NOT_FOUND', 'Vui lòng cài đặt hoặc bật MetaMask.');
    }
    injected = selected;
    injected.on('accountsChanged', onAccountsChanged);
    injected.on('chainChanged', onChainChanged);
    injected.on('disconnect', onDisconnect);
    return injected;
  }

  async function sync(requestPermission) {
    getConfig();
    const provider = getEthereum();
    const expectedLifecycle = lifecycle;
    // MetaMask may emit accountsChanged while approving the initial connection.
    if (requestPermission) await provider.request({ method: 'eth_requestAccounts' });
    const expectedRevision = revision;
    const [accounts, chain] = await Promise.all([
      provider.request({ method: 'eth_accounts' }),
      provider.request({ method: 'eth_chainId' }),
    ]);
    if (revision !== expectedRevision || lifecycle !== expectedLifecycle) {
      throw new IntegrationError('WALLET_CHANGED', 'Ví hoặc mạng vừa thay đổi. Vui lòng thử lại.');
    }
    return update(accounts[0] ?? null, BigInt(chain));
  }

  async function connect() {
    if (!connecting) {
      connecting = sync(true).catch((error) => { throw toIntegrationError(error); }).finally(() => { connecting = undefined; });
    }
    return connecting;
  }

  async function restore() {
    try { return await sync(false); } catch (error) { throw toIntegrationError(error); }
  }

  async function assertSession(session) {
    if (!state.connected || session.revision !== revision) {
      throw new IntegrationError('WALLET_CHANGED', 'Ví hoặc mạng vừa thay đổi. Vui lòng thử lại.');
    }
    const provider = getEthereum();
    const [accounts, chainId] = await Promise.all([
      provider.request({ method: 'eth_accounts' }),
      provider.request({ method: 'eth_chainId' }),
    ]);
    if (session.revision !== revision || !accounts[0] || getAddress(accounts[0]) !== session.account || BigInt(chainId) !== session.chainId) {
      throw new IntegrationError('WALLET_CHANGED', 'Ví hoặc mạng vừa thay đổi. Vui lòng thử lại.');
    }
  }

  async function getSession() {
    getConfig();
    if (!state.connected) throw new IntegrationError('WALLET_NOT_CONNECTED', 'Vui lòng kết nối MetaMask trước.');
    if (!state.isCorrectNetwork) throw new IntegrationError('WRONG_NETWORK', `Hãy chuyển ví sang chain ID ${getConfig().chainId}.`);
    const session = getState();
    await assertSession(session);
    const provider = new BrowserProvider(getEthereum());
    const signer = await provider.getSigner(session.account);
    await assertSession(session);
    return { ...session, signer };
  }

  async function switchNetwork() {
    try {
      const config = getConfig();
      await getEthereum().request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toQuantity(config.chainId) }] });
      return await restore();
    } catch (error) {
      if (error.code === 4902) throw new IntegrationError('NETWORK_NOT_ADDED', 'Hãy thêm testnet đã thống nhất vào MetaMask rồi thử lại.', error);
      throw toIntegrationError(error);
    }
  }

  // Local disconnect only. It does not revoke the site's MetaMask permissions.
  function disconnect() {
    lifecycle++;
    if (injected) {
      injected.removeListener('accountsChanged', onAccountsChanged);
      injected.removeListener('chainChanged', onChainChanged);
      injected.removeListener('disconnect', onDisconnect);
      injected = undefined;
    }
    update(null, null);
  }

  return {
    connect, restore, disconnect, switchNetwork, getState, getSession, assertSession,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const walletService = createWalletService();
