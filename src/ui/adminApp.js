import { getAddress, parseEther } from 'ethers';
import { escapeHtml as html, formatDeparture, formatPrice } from './format.js';
import { toIntegrationError } from '../blockchain/errors.js';

const pending = (tx) => ['preparing', 'awaiting_signature', 'pending'].includes(tx.status);

export function mountAdminApp({ document, wallet, tickets, settings }) {
  const $ = (id) => document.getElementById(id);
  const abort = new AbortController();
  let alive = true;
  let epoch = 0;
  let loading = false;
  let submitting = false;
  let allowed = false;
  let opened = false;
  let selected = null;
  let lookupVersion = 0;
  let tx = tickets.getTransactionState();
  const on = (node, event, action) => node.addEventListener(event, action, { signal: abort.signal });
  function message(text, error = false) {
    $('tc-admin-message').textContent = text;
    $('tc-admin-message').classList.toggle('tc-error-text', error);
  }
  function controls() {
    const disabled = !allowed || submitting || pending(tx);
    document.querySelectorAll('#tc-admin-view form input, #tc-admin-view form button').forEach((node) => { node.disabled = disabled; });
    $('tc-admin-refresh').disabled = !allowed || loading || pending(tx);
    $('tc-admin-open').hidden = !allowed;
  }
  function tab(id) {
    document.querySelectorAll('.tc-admin-tab-content').forEach((node) => { node.hidden = node.id !== `tc-admin-tab-${id}`; });
    document.querySelectorAll('[data-tc-admin-tab]').forEach((node) => node.classList.toggle('active', node.dataset.tcAdminTab === id));
  }
  function view(admin) {
    opened = admin && allowed;
    document.body.classList.toggle('tc-admin-mode', opened);
    $('tc-admin-view').hidden = !opened;
    $('tc-admin-nav').hidden = !opened;
    $('tc-customer-view').hidden = opened;
    $('tc-customer-nav').hidden = opened;
    $('tc-brand-sub').textContent = opened ? 'ADMIN CONSOLE' : 'TRAVEL ON CHAIN';
    $('tc-admin-open').textContent = opened ? 'Xem tour' : 'Quản trị';
    if (opened) { tab('overview'); void loadData(); }
  }
  function clear() {
    for (const id of ['tc-stat-tours', 'tc-stat-sold', 'tc-stat-revenue', 'tc-stat-used']) $(id).textContent = '—';
    $('tc-admin-tours').replaceChildren();
    $('tc-admin-tickets').replaceChildren();
    selected = null;
    ++lookupVersion;
    $('tc-checkin-result').replaceChildren();
    $('tc-admin-use-form').hidden = true;
    $('tc-admin-use-form').reset();
    $('tc-admin-create-form').reset();
  }
  async function authorize(session) {
    const revision = ++epoch;
    allowed = false;
    loading = false;
    clear(); view(false); controls();
    if (settings.error || !session.connected || !session.isCorrectNetwork) return;
    try {
      const admin = await tickets.readAdmin();
      if (!alive || revision !== epoch) return;
      allowed = getAddress(session.account) === getAddress(admin);
      controls();
    } catch (error) {
      if (alive && revision === epoch) message(toIntegrationError(error).message, true);
    }
  }
  async function loadData() {
    if (!allowed || loading) return;
    const current = epoch;
    loading = true; controls();
    message('Đang đọc dữ liệu quản trị từ blockchain…');
    try {
      const [tours, allTickets] = await Promise.all([tickets.listTours(), tickets.listTickets()]);
      if (!alive || current !== epoch) return;
      const names = new Map(tours.map((tour) => [tour.id.toString(), tour.name]));
      $('tc-stat-tours').textContent = tours.length.toString();
      $('tc-stat-sold').textContent = tours.reduce((sum, tour) => sum + tour.soldTickets, 0n).toString();
      $('tc-stat-revenue').textContent = formatPrice(tours.reduce((sum, tour) => sum + tour.price * tour.soldTickets, 0n));
      $('tc-stat-used').textContent = allTickets.filter((ticket) => ticket.isUsed).length.toString();
      $('tc-admin-tours').innerHTML = tours.length ? tours.map((tour) => `<tr><td>${tour.id}</td><td>${html(tour.name)}</td><td>${html(formatDeparture(tour.departureTime))}</td><td>${html(formatPrice(tour.price))}</td><td>${tour.soldTickets} / ${tour.totalTickets}</td></tr>`).join('') : '<tr><td colspan="5">Chưa có tour. Tạo tour để bắt đầu mở bán.</td></tr>';
      $('tc-admin-tickets').innerHTML = allTickets.length ? allTickets.map((ticket) => `<tr><td>#${ticket.id}</td><td>${html(names.get(ticket.tourId.toString()) ?? `Tour #${ticket.tourId}`)}</td><td class="tc-address">${html(ticket.owner)}</td><td>${ticket.isUsed ? 'Đã sử dụng' : 'Chưa sử dụng'}</td></tr>`).join('') : '<tr><td colspan="4">Chưa có vé được mua.</td></tr>';
      message('Dữ liệu đã được cập nhật từ blockchain.');
    } catch (error) {
      if (alive && current === epoch) {
        for (const id of ['tc-stat-tours', 'tc-stat-sold', 'tc-stat-revenue', 'tc-stat-used']) $(id).textContent = '—';
        $('tc-admin-tours').replaceChildren();
        $('tc-admin-tickets').replaceChildren();
        message(toIntegrationError(error).message, true);
      }
    } finally { if (alive && current === epoch) { loading = false; controls(); } }
  }
  async function create(event) {
    event.preventDefault();
    if (!allowed || submitting || pending(tx)) return;
    const current = epoch;
    submitting = true; controls();
    try {
      const date = new Date($('tc-create-departure').value);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error('Giờ khởi hành phải ở tương lai.');
      const count = $('tc-create-count').value.trim();
      if (!/^[0-9]+$/.test(count) || BigInt(count) <= 0n) throw new Error('Số vé phải là số nguyên lớn hơn 0.');
      let price;
      try { price = parseEther($('tc-create-price').value.trim()); } catch { throw new Error('Giá ETH không hợp lệ; dùng dấu chấm thập phân và tối đa 18 chữ số sau dấu chấm.'); }
      if (price <= 0n) throw new Error('Giá vé phải lớn hơn 0.');
      const name = $('tc-create-name').value.trim();
      if (!name) throw new Error('Vui lòng nhập tên tour.');
      const result = await tickets.createTour({ name, departureTime: BigInt(Math.floor(date.getTime() / 1000)), price, totalTickets: BigInt(count) });
      if (alive && current === epoch) {
        $('tc-admin-create-form').reset();
        message(`Đã tạo tour #${result.tourId}. Mã giao dịch: ${result.txHash}`);
        void loadData();
      }
    } catch (error) {
      if (alive && current === epoch) message(error.code ? toIntegrationError(error).message : error.message, true);
    } finally { if (alive) { submitting = false; controls(); } }
  }
  async function lookup(event) {
    event?.preventDefault();
    if (!allowed || pending(tx)) return;
    const current = epoch;
    const version = ++lookupVersion;
    selected = null;
    $('tc-admin-use-form').hidden = true;
    $('tc-checkin-result').textContent = 'Đang tra cứu vé…';
    try {
      const id = $('tc-checkin-id').value.trim();
      if (!/^[0-9]+$/.test(id)) throw new Error('Mã vé phải là số nguyên không âm.');
      const ticket = await tickets.readTicket(id);
      const tour = await tickets.readTour(ticket.tourId);
      if (!alive || current !== epoch || version !== lookupVersion) return;
      selected = ticket;
      $('tc-checkin-result').innerHTML = `<strong>Vé #${ticket.id} · ${html(tour.name)}</strong><p>Ví sở hữu: <span class="tc-address">${html(ticket.owner)}</span></p><p>${ticket.isUsed ? 'Đã sử dụng' : 'Chưa sử dụng'}</p>`;
      $('tc-admin-use-form').reset();
      $('tc-admin-use-form').hidden = ticket.isUsed;
    } catch (error) {
      if (alive && current === epoch && version === lookupVersion) $('tc-checkin-result').textContent = error.code ? toIntegrationError(error).message : error.message;
    }
  }
  async function use(event) {
    event.preventDefault();
    if (!allowed || !selected || selected.isUsed || submitting || pending(tx)) return;
    const current = epoch;
    const ticket = selected;
    submitting = true; controls();
    try {
      let owner;
      try { owner = getAddress($('tc-checkin-owner').value.trim()); } catch { throw new Error('Địa chỉ ví đối chiếu không hợp lệ.'); }
      if (owner !== getAddress(ticket.owner)) throw new Error('Địa chỉ đối chiếu không khớp ví sở hữu vé.');
      if (!$('tc-checkin-confirm').checked) throw new Error('Hãy xác nhận đã đối chiếu người trình vé.');
      await tickets.useTicket(ticket.id);
      if (alive && current === epoch) { message(`Đã xác nhận sử dụng vé #${ticket.id}.`); await lookup(); }
    } catch (error) {
      if (alive && current === epoch) message(error.code ? toIntegrationError(error).message : error.message, true);
    } finally { if (alive) { submitting = false; controls(); } }
  }
  on($('tc-admin-open'), 'click', () => view(!opened));
  on($('tc-home'), 'click', () => view(false));
  on($('tc-admin-refresh'), 'click', () => void loadData());
  on($('tc-admin-create-form'), 'submit', (event) => void create(event));
  on($('tc-admin-lookup-form'), 'submit', (event) => void lookup(event));
  on($('tc-admin-use-form'), 'submit', (event) => void use(event));
  on($('tc-checkin-id'), 'input', () => { ++lookupVersion; selected = null; $('tc-admin-use-form').hidden = true; $('tc-checkin-result').replaceChildren(); });
  document.querySelectorAll('[data-tc-admin-tab]').forEach((button) => on(button, 'click', () => tab(button.dataset.tcAdminTab)));
  const unsubscribeWallet = wallet.subscribe((value) => void authorize(value));
  const unsubscribeTx = tickets.subscribeTransactions((value) => {
    tx = value; controls();
    if (allowed && opened && (value.status === 'success' || value.confirmed)) void loadData();
  });
  const timer = setInterval(() => { if (opened && !pending(tx) && document.visibilityState === 'visible') void loadData(); }, 15000);
  void authorize(wallet.getState());
  return { destroy() { alive = false; ++epoch; ++lookupVersion; abort.abort(); unsubscribeWallet(); unsubscribeTx(); clearInterval(timer); } };
}
