import { demoTours } from '../data/demoTours.js';
import { defaultTourImage, withTourContent } from '../data/tourContent.js';
import { toIntegrationError } from '../blockchain/errors.js';
import { escapeHtml as html, formatDeparture, formatPrice, hasDeparted, remainingTickets, shortAddress } from './format.js';

const busyStatuses = new Set(['preparing', 'awaiting_signature', 'pending']);
const transactionMessages = {
  preparing: 'Đang kiểm tra giao dịch…',
  awaiting_signature: 'Hãy kiểm tra và xác nhận yêu cầu trong MetaMask.',
  pending: 'Đã gửi giao dịch. Đang chờ blockchain xác nhận…',
  success: 'Giao dịch đã được xác nhận thành công.',
};

export function createCustomerApp({ document, wallet, tickets, settings }) {
  const $ = (id) => document.getElementById(id);
  const abort = new AbortController();
  const state = {
    tours: [], toursLoading: false, toursError: null,
    selectedTour: null, detailLoading: false, detailError: null,
    wallet: wallet.getState(), walletBusy: false, walletMessage: '',
    tickets: [], ticketsLoading: false, ticketsError: null,
    transaction: tickets.getTransactionState(), purchaseTourId: null,
  };
  let alive = true;
  let toursRequest = 0;
  let detailRequest = 0;
  let ticketsRequest = 0;
  let toastTimer;
  let clock;
  let lastDepartures = '';
  const subscriptions = [];
  const isDemo = settings.mode === 'demo';
  const canReadChain = !isDemo && !settings.error;
  const isBusy = () => busyStatuses.has(state.transaction.status);
  const on = (node, event, listener, options = {}) => node.addEventListener(event, listener, { ...options, signal: abort.signal });

  function toast(message) {
    $('tc-toast').textContent = message;
    $('tc-toast').classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('tc-toast').classList.remove('is-visible'), 5000);
  }

  const messageCard = (title, message, error = false) => `<div class="tc-empty${error ? ' tc-error' : ''}"><strong>${html(title)}</strong><p>${html(message)}</p></div>`;
  const tourTag = (tour) => hasDeparted(tour) ? 'Đã khởi hành' : remainingTickets(tour) === 0n ? 'Đã hết vé' : tour.tag;

  function renderConnection() {
    const connected = state.wallet.connected;
    $('tc-data-mode').textContent = isDemo ? 'CHẾ ĐỘ DEMO' : 'CHẾ ĐỘ BLOCKCHAIN';
    $('tc-source-label').textContent = isDemo ? 'DỮ LIỆU MINH HỌA · KHÔNG GỬI GIAO DỊCH' : 'NGUỒN DỮ LIỆU: BLOCKCHAIN';
    const message = isDemo ? 'Bạn đang xem tour minh họa. Kết nối ví và mua vé chưa được bật trong chế độ này.'
      : settings.error ? 'Kết nối blockchain chưa được cấu hình đầy đủ. Hiện chưa thể tải tour hoặc giao dịch.'
      : state.walletMessage || (!connected ? 'Bạn có thể xem tour ngay. Kết nối MetaMask để mua và xem vé.'
        : !state.wallet.isCorrectNetwork ? 'Ví đang ở mạng khác. Hãy chuyển sang mạng của hệ thống để mua và xem vé.'
          : `Đã kết nối ${shortAddress(state.wallet.account)} · Mạng ${state.wallet.chainId.toString()}`);
    $('tc-connection-message').textContent = message;
    $('tc-connection-message').classList.toggle('tc-error-text', Boolean(settings.error || (connected && !state.wallet.isCorrectNetwork)));
    $('tc-wallet-label').textContent = isDemo ? 'Chế độ demo' : state.walletBusy ? 'Đang xử lý ví…'
      : connected ? shortAddress(state.wallet.account) : 'Kết nối MetaMask';
    $('tc-connect').disabled = isDemo || Boolean(settings.error) || state.walletBusy || isBusy();
    $('tc-switch-network').hidden = !canReadChain || !connected || state.wallet.isCorrectNetwork;
    $('tc-switch-network').disabled = state.walletBusy || isBusy();
    $('tc-disconnect').hidden = !connected;
    $('tc-disconnect').disabled = state.walletBusy;
    $('tc-refresh').disabled = Boolean(settings.error) || state.toursLoading || state.ticketsLoading;
    $('tc-refresh-tickets').disabled = !canReadChain || !connected || !state.wallet.isCorrectNetwork || state.ticketsLoading;
  }

  function renderTours() {
    const grid = $('tc-tour-grid');
    grid.setAttribute('aria-busy', String(state.toursLoading));
    if (state.toursLoading) {
      grid.innerHTML = messageCard('Đang tải hành trình…', 'Vui lòng chờ trong giây lát.');
      $('tc-count').textContent = 'Đang tải tour…';
      return;
    }
    if (state.toursError) {
      grid.innerHTML = messageCard('Chưa tải được danh sách tour', state.toursError, true);
      $('tc-count').textContent = 'Chưa có dữ liệu để hiển thị';
      return;
    }
    const query = $('tc-search').value.trim().toLocaleLowerCase('vi');
    const filtered = state.tours.filter((tour) => `${tour.name} ${tour.location}`.toLocaleLowerCase('vi').includes(query));
    $('tc-count').textContent = `Hiển thị ${filtered.length} / ${state.tours.length} tour`;
    if (!filtered.length) {
      grid.innerHTML = state.tours.length ? messageCard('Chưa tìm thấy tour phù hợp', 'Hãy thử một tên tour hoặc địa điểm khác.')
        : messageCard('Chưa có tour mở bán', 'Hãy quay lại khi có hành trình mới.');
      return;
    }
    grid.innerHTML = filtered.map((tour) => `<article class="tc-tour-card">
      <div class="tc-tour-cover"><img data-tc-image src="${html(tour.image)}" alt="${html(tour.name)}" loading="lazy"><span class="tc-card-tag">${html(tourTag(tour))}</span></div>
      <div class="tc-tour-body"><p class="tc-tour-location">↗ ${html(tour.location)}</p><h3>${html(tour.name)}</h3>
        <p class="tc-tour-description">${html(tour.description)}</p>
        <div class="tc-tour-meta"><div><small>Giá mỗi vé</small><div class="tc-tour-price">${html(formatPrice(tour.price))}</div>
          <small>${html(formatDeparture(tour.departureTime))} · Còn ${remainingTickets(tour).toString()} vé</small></div>
          <button class="tc-open-tour" data-tc-tour="${tour.id.toString()}" aria-label="${html(`Xem chi tiết ${tour.name}`)}">↗</button></div>
      </div></article>`).join('');
  }

  function transactionMessage() {
    const tx = state.transaction;
    if (tx.status !== 'error') return transactionMessages[tx.status] ?? '';
    const reminder = tx.confirmed ? ' Giao dịch đã thành công trên chuỗi; hãy tải lại dữ liệu, không mua lại.'
      : tx.txHash && !['TRANSACTION_CANCELLED', 'TRANSACTION_FAILED', 'CONTRACT_REVERT'].includes(tx.error.code)
        ? ' Hãy kiểm tra mã giao dịch trong ví trước khi gửi lại.' : '';
    return `${tx.error.message}${reminder}`;
  }

  function renderTransaction() {
    const tx = state.transaction;
    $('tc-transaction').hidden = tx.status === 'idle';
    $('tc-transaction').dataset.status = tx.status;
    $('tc-transaction-message').textContent = transactionMessage();
    $('tc-transaction-account').textContent = tx.account ? `Ví gửi: ${shortAddress(tx.account)}` : '';
    $('tc-transaction-hash').textContent = tx.txHash ? `Mã giao dịch: ${tx.txHash}` : '';
  }

  function renderBuy() {
    const tour = state.selectedTour;
    if (!tour) return;
    let label = 'Mua 01 vé';
    let message = 'Mỗi giao dịch mua một vé. Chỉ ghi nhận vé sau khi blockchain xác nhận.';
    let disabled = false;
    if (isDemo) { label = 'Chỉ xem minh họa'; message = 'Đây là dữ liệu demo. Không kết nối ví hoặc gửi giao dịch mua vé.'; disabled = true; }
    else if (settings.error) { message = 'Chưa có cấu hình kết nối blockchain.'; disabled = true; }
    else if (state.detailLoading || state.toursLoading) { label = 'Đang cập nhật tour…'; message = 'Đang đọc giá và tình trạng vé mới nhất.'; disabled = true; }
    else if (state.detailError || state.toursError) { message = state.detailError || state.toursError; disabled = true; }
    else if (isBusy()) { label = state.transaction.status === 'pending' ? 'Đang chờ xác nhận…' : 'Đang xử lý…'; message = transactionMessage(); disabled = true; }
    else if (hasDeparted(tour)) { label = 'Tour đã khởi hành'; message = 'Tour đã đến giờ khởi hành và không còn nhận mua vé.'; disabled = true; }
    else if (remainingTickets(tour) === 0n) { label = 'Đã hết vé'; message = 'Tour này đã bán hết vé.'; disabled = true; }
    else if (state.walletBusy) { label = 'Đang xử lý ví…'; disabled = true; }
    else if (!state.wallet.connected) { label = 'Kết nối ví để mua vé'; }
    else if (!state.wallet.isCorrectNetwork) { label = 'Chuyển mạng để mua vé'; message = 'Hãy chuyển ví sang mạng của hệ thống trước khi mua.'; }
    else if (state.purchaseTourId === tour.id.toString() && ['success', 'error'].includes(state.transaction.status)) { message = transactionMessage(); }
    $('tc-buy').textContent = label;
    $('tc-buy').disabled = disabled;
    $('tc-dialog-message').textContent = message;
  }

  function renderDialog() {
    const tour = state.selectedTour;
    if (!tour) return;
    $('tc-dialog-image').src = tour.image;
    $('tc-dialog-image').alt = tour.name;
    $('tc-dialog-image').dataset.tcImage = '';
    $('tc-dialog-tag').textContent = tourTag(tour);
    $('tc-dialog-location').textContent = tour.location;
    $('tc-dialog-title').textContent = tour.name;
    $('tc-dialog-description').textContent = tour.description;
    $('tc-dialog-date').textContent = formatDeparture(tour.departureTime);
    $('tc-dialog-price').textContent = formatPrice(tour.price);
    $('tc-dialog-remaining').textContent = remainingTickets(tour).toString();
    renderBuy();
  }

  function renderTickets() {
    const list = $('tc-ticket-list');
    list.setAttribute('aria-busy', String(state.ticketsLoading));
    if (isDemo) list.innerHTML = messageCard('Vé chưa được bật trong chế độ demo', 'Dữ liệu tour đang là minh họa; chưa có vé blockchain để hiển thị.');
    else if (settings.error) list.innerHTML = messageCard('Chưa thể tải vé', 'Kết nối blockchain chưa được cấu hình.', true);
    else if (!state.wallet.connected) list.innerHTML = messageCard('Kết nối ví để xem vé', 'Các vé đã mua sẽ xuất hiện theo tài khoản MetaMask đang kết nối.');
    else if (!state.wallet.isCorrectNetwork) list.innerHTML = messageCard('Hãy chuyển mạng để xem vé', 'Ví đang ở mạng khác với hệ thống.');
    else if (state.ticketsLoading) list.innerHTML = messageCard('Đang tải vé của bạn…', 'Đang đọc dữ liệu cho ví hiện tại.');
    else if (state.ticketsError) list.innerHTML = messageCard('Chưa tải được vé', state.ticketsError, true);
    else if (!state.tickets.length) list.innerHTML = messageCard('Bạn chưa có vé', 'Khám phá các tour và chọn hành trình đầu tiên của bạn.');
    else list.innerHTML = state.tickets.map(({ ticket, tour }) => `<article class="tc-owned-ticket" data-tc-ticket="${ticket.id.toString()}">
      <div class="tc-owned-ticket-heading"><strong>Mã vé #${ticket.id.toString()}</strong><span class="tc-ticket-state${ticket.isUsed ? ' is-used' : ''}">${ticket.isUsed ? 'Đã sử dụng' : 'Chưa sử dụng'}</span></div>
      <h3>${html(tour?.name ?? `Tour #${ticket.tourId.toString()}`)}</h3>
      <p>${tour ? html(formatDeparture(tour.departureTime)) : 'Chưa tải được chi tiết tour. Hãy thử tải lại vé.'}</p>
      <p class="tc-ticket-owner">Ví sở hữu: <span>${html(ticket.owner)}</span></p>
    </article>`).join('');
    renderConnection();
  }

  async function loadTours() {
    const request = ++toursRequest;
    state.toursLoading = true;
    state.toursError = null;
    renderTours(); renderConnection(); renderBuy();
    try {
      if (settings.error) throw settings.error;
      const result = isDemo ? demoTours : await tickets.listTours();
      if (!alive || request !== toursRequest) return;
      state.tours = result.map(withTourContent);
      if (state.selectedTour) {
        ++detailRequest;
        state.detailLoading = false;
        const current = state.tours.find((tour) => tour.id === state.selectedTour.id);
        if (current) { state.selectedTour = current; state.detailError = null; }
        else state.detailError = 'Tour không còn trong danh sách. Hãy đóng cửa sổ và tải lại.';
      }
    } catch (error) {
      if (!alive || request !== toursRequest) return;
      state.tours = [];
      state.toursError = error.code === 'CONFIG_ERROR' ? 'Kết nối blockchain chưa được cấu hình đầy đủ.' : toIntegrationError(error).message;
    } finally {
      if (alive && request === toursRequest) {
        state.toursLoading = false;
        renderTours(); renderDialog(); renderConnection();
      }
    }
  }

  async function openTour(id) {
    const initial = state.tours.find((tour) => tour.id.toString() === id);
    if (!initial) return;
    const request = ++detailRequest;
    state.selectedTour = initial;
    state.detailError = null;
    state.detailLoading = canReadChain;
    renderDialog();
    if (!$('tc-tour-dialog').open) $('tc-tour-dialog').showModal();
    if (!canReadChain) return;
    try {
      const current = await tickets.readTour(initial.id);
      if (!alive || request !== detailRequest) return;
      state.selectedTour = withTourContent(current);
      state.tours = state.tours.map((tour) => tour.id === current.id ? state.selectedTour : tour);
      renderTours();
    } catch (error) {
      if (!alive || request !== detailRequest) return;
      state.detailError = toIntegrationError(error).message;
    } finally {
      if (alive && request === detailRequest) {
        state.detailLoading = false;
        renderDialog();
      }
    }
  }

  async function loadMyTickets() {
    const request = ++ticketsRequest;
    const session = state.wallet;
    state.tickets = [];
    state.ticketsError = null;
    state.ticketsLoading = canReadChain && session.connected && session.isCorrectNetwork;
    renderTickets();
    if (!state.ticketsLoading) return;
    const current = () => alive && request === ticketsRequest && state.wallet.account === session.account && state.wallet.revision === session.revision;
    try {
      const result = await tickets.listMyTickets();
      if (!current()) return;
      const tourCache = new Map(state.tours.map((tour) => [tour.id.toString(), Promise.resolve(tour)]));
      const hydrated = await Promise.all(result.map(async (ticket) => {
        const id = ticket.tourId.toString();
        if (!tourCache.has(id)) tourCache.set(id, tickets.readTour(ticket.tourId).catch(() => null));
        return { ticket, tour: await tourCache.get(id) };
      }));
      if (current()) state.tickets = hydrated;
    } catch (error) {
      if (current()) state.ticketsError = toIntegrationError(error).message;
    } finally {
      if (current()) { state.ticketsLoading = false; renderTickets(); }
    }
  }

  async function walletAction(action) {
    if (!canReadChain || state.walletBusy || isBusy()) return;
    state.walletBusy = true;
    state.walletMessage = '';
    renderConnection(); renderBuy();
    try { await action(); }
    catch (error) { state.walletMessage = toIntegrationError(error).message; toast(state.walletMessage); }
    finally { if (alive) { state.walletBusy = false; renderConnection(); renderBuy(); } }
  }

  async function purchase() {
    if ($('tc-buy').disabled || !state.selectedTour || !canReadChain) return;
    if (!state.wallet.connected) return walletAction(() => wallet.connect());
    if (!state.wallet.isCorrectNetwork) return walletAction(() => wallet.switchNetwork());
    const id = state.selectedTour.id;
    state.purchaseTourId = id.toString();
    try { await tickets.purchaseTicket(id); }
    catch (error) { if (alive) toast(toIntegrationError(error).message); }
  }

  function walletChanged(value) {
    state.wallet = value;
    state.walletMessage = '';
    ++ticketsRequest;
    state.tickets = [];
    state.ticketsLoading = false;
    state.ticketsError = null;
    renderConnection(); renderTickets(); renderBuy();
    void loadMyTickets();
  }

  function transactionChanged(value) {
    state.transaction = value;
    renderTransaction(); renderConnection(); renderBuy();
    if (value.status === 'success' || (value.status === 'error' && value.confirmed)) {
      if (value.refresh?.includes('tours')) void loadTours();
      if (value.refresh?.includes('myTickets')) void loadMyTickets();
    }
  }

  async function start() {
    on($('tc-tour-grid'), 'click', (event) => {
      const button = event.target.closest('[data-tc-tour]');
      if (button) void openTour(button.dataset.tcTour);
    });
    on($('tc-search'), 'input', renderTours);
    on($('tc-clear-search'), 'click', () => { $('tc-search').value = ''; renderTours(); $('tc-search').focus(); });
    on($('tc-connect'), 'click', () => void walletAction(() => wallet.connect()));
    on($('tc-switch-network'), 'click', () => void walletAction(() => wallet.switchNetwork()));
    on($('tc-disconnect'), 'click', () => wallet.disconnect());
    on($('tc-refresh'), 'click', () => { void loadTours(); void loadMyTickets(); });
    on($('tc-refresh-tickets'), 'click', () => void loadMyTickets());
    on($('tc-buy'), 'click', () => void purchase());
    on($('tc-close-dialog'), 'click', () => $('tc-tour-dialog').close());
    on($('tc-tour-dialog'), 'click', (event) => { if (event.target === $('tc-tour-dialog')) $('tc-tour-dialog').close(); });
    on($('tc-tour-dialog'), 'close', () => { ++detailRequest; state.selectedTour = null; state.detailLoading = false; });
    on(document, 'error', (event) => {
      const image = event.target;
      if (image.matches?.('img[data-tc-image]') && image.src !== defaultTourImage) image.src = defaultTourImage;
    }, { capture: true });
    subscriptions.push(wallet.subscribe(walletChanged), tickets.subscribeTransactions(transactionChanged));
    renderConnection(); renderTickets(); renderTransaction();
    clock = setInterval(() => {
      renderBuy();
      const departures = state.tours.map((tour) => hasDeparted(tour)).join(',');
      if (departures !== lastDepartures) { lastDepartures = departures; renderTours(); }
    }, 1000);
    const loading = loadTours();
    if (canReadChain) {
      try { await wallet.restore(); }
      catch (error) {
        if (alive) { state.walletMessage = toIntegrationError(error).message; renderConnection(); }
      }
    }
    await loading;
  }

  function destroy() {
    alive = false;
    abort.abort();
    clearTimeout(toastTimer);
    clearInterval(clock);
    subscriptions.forEach((unsubscribe) => unsubscribe());
    ++toursRequest; ++ticketsRequest; ++detailRequest;
  }

  return { start, destroy };
}
