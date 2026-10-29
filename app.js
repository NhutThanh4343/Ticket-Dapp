/*
 * TourChain TV1 - Customer Frontend (standalone Go Live version)
 * Chỉ dùng tiền tố tc- cho DOM/CSS để tránh đụng tên với code thành viên khác.
 * Dữ liệu hiện là mock. Khi tích hợp, thay module dữ liệu bằng ticketService.js
 * theo QUY_UOC_CHUNG.md; không sửa chữ ký Solidity ở frontend.
 */
const TC_MOCK_TOURS = [
  { id: 0n, name: "Khám phá Vịnh Hạ Long", departureTime: 1893456000n, price: 10000000000000000n, totalTickets: 30n, soldTickets: 8n, location: "Quảng Ninh, Việt Nam", tag: "Được yêu thích", image: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=85", description: "Khám phá cảnh quan thiên nhiên, những đảo đá vôi và hang động nổi tiếng của Vịnh Hạ Long." },
  { id: 1n, name: "Nghỉ dưỡng tại Đà Nẵng", departureTime: 1896048000n, price: 15000000000000000n, totalTickets: 25n, soldTickets: 10n, location: "Đà Nẵng, Việt Nam", tag: "Biển xanh", image: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=85", description: "Tận hưởng bãi biển, ẩm thực địa phương và những điểm tham quan nổi bật của thành phố Đà Nẵng." },
  { id: 2n, name: "Săn mây Đà Lạt", departureTime: 1898726400n, price: 8000000000000000n, totalTickets: 40n, soldTickets: 12n, location: "Lâm Đồng, Việt Nam", tag: "Thiên nhiên", image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85", description: "Tận hưởng khí hậu mát mẻ, rừng thông, hồ nước và những điểm check-in đặc trưng của Đà Lạt." },
  { id: 3n, name: "Một ngày ở Hội An", departureTime: 1901318400n, price: 6000000000000000n, totalTickets: 35n, soldTickets: 5n, location: "Quảng Nam, Việt Nam", tag: "Văn hóa", image: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=85", description: "Dạo phố cổ, khám phá kiến trúc, thưởng thức món ăn địa phương và nét văn hóa đặc sắc." },
  { id: 4n, name: "Chinh phục Sa Pa", departureTime: 1903996800n, price: 12000000000000000n, totalTickets: 20n, soldTickets: 6n, location: "Lào Cai, Việt Nam", tag: "Phiêu lưu", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85", description: "Ngắm núi non hùng vĩ, ruộng bậc thang và trải nghiệm văn hóa vùng cao phía Bắc." },
  { id: 5n, name: "Khám phá Phú Quốc", departureTime: 1906588800n, price: 18000000000000000n, totalTickets: 28n, soldTickets: 3n, location: "Kiên Giang, Việt Nam", tag: "Đảo ngọc", image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=85", description: "Thư giãn trên bãi biển, khám phá làng chài và tận hưởng cảnh hoàng hôn trên đảo." }
];

const tcState = { tours: TC_MOCK_TOURS, selectedTour: null, account: null, toastTimer: null };
const tc = (id) => document.getElementById(id);

function tcFormatEth(wei) {
  // Format chuỗi ETH từ số nguyên wei, không dùng phép tính số thực.
  const raw = BigInt(wei).toString().padStart(19, "0");
  const whole = raw.slice(0, -18) || "0";
  const fraction = raw.slice(-18).replace(/0+$/, "");
  return `${whole}${fraction ? "." + fraction : ""} ETH`;
}
function tcFormatDate(timestamp) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return "Chưa cập nhật";
  return new Date(seconds * 1000).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function tcRemaining(tour) {
  const left = BigInt(tour.totalTickets) - BigInt(tour.soldTickets);
  return left > 0n ? left : 0n;
}
function tcShowToast(message) {
  const node = tc("tc-toast");
  node.textContent = message;
  node.classList.add("is-visible");
  clearTimeout(tcState.toastTimer);
  tcState.toastTimer = setTimeout(() => node.classList.remove("is-visible"), 3000);
}
function tcRenderTours() {
  const query = tc("tc-search").value.trim().toLocaleLowerCase("vi");
  const tours = tcState.tours.filter(t => `${t.name} ${t.location}`.toLocaleLowerCase("vi").includes(query));
  tc("tc-count").textContent = `Hiển thị ${tours.length} / ${tcState.tours.length} tour`;
  if (!tours.length) {
    tc("tc-tour-grid").innerHTML = '<div class="tc-no-results"><strong>Chưa tìm thấy tour phù hợp.</strong><p>Hãy thử một tên tour hoặc địa điểm khác.</p></div>';
    return;
  }
  tc("tc-tour-grid").innerHTML = tours.map(tour => {
    const id = BigInt(tour.id).toString();
    const remaining = tcRemaining(tour);
    const soldOut = remaining === 0n;
    return `<article class="tc-tour-card">
      <div class="tc-tour-cover"><img src="${tour.image}" alt="${tour.name}" loading="lazy"><span class="tc-card-tag">${soldOut ? "Đã hết vé" : tour.tag}</span></div>
      <div class="tc-tour-body">
        <p class="tc-tour-location">↗ ${tour.location}</p>
        <h3>${tour.name}</h3>
        <p class="tc-tour-description">${tour.description}</p>
        <div class="tc-tour-meta"><div><small>Giá mỗi vé</small><div class="tc-tour-price">${tcFormatEth(tour.price)}</div><small>${tcFormatDate(tour.departureTime)} · Còn ${remaining.toString()} vé</small></div>
        <button class="tc-open-tour" data-tc-tour="${id}" aria-label="Xem chi tiết ${tour.name}" ${soldOut ? "disabled" : ""}>↗</button></div>
      </div>
    </article>`;
  }).join("");
}
function tcOpenTour(id) {
  const tour = tcState.tours.find(item => BigInt(item.id).toString() === String(id));
  if (!tour) return;
  tcState.selectedTour = tour;
  tc("tc-dialog-image").src = tour.image;
  tc("tc-dialog-image").alt = tour.name;
  tc("tc-dialog-tag").textContent = tcRemaining(tour) === 0n ? "Đã hết vé" : tour.tag;
  tc("tc-dialog-location").textContent = tour.location;
  tc("tc-dialog-title").textContent = tour.name;
  tc("tc-dialog-description").textContent = tour.description;
  tc("tc-dialog-date").textContent = tcFormatDate(tour.departureTime);
  tc("tc-dialog-price").textContent = tcFormatEth(tour.price);
  tc("tc-dialog-remaining").textContent = tcRemaining(tour).toString();
  tc("tc-dialog-message").textContent = "Dữ liệu minh họa. Chưa có ABI/địa chỉ contract nên chưa gửi giao dịch thật.";
  tc("tc-buy").textContent = tcState.account ? "Mua 01 vé (demo)" : "Kết nối ví để mua vé";
  tc("tc-buy").disabled = tcRemaining(tour) === 0n;
  tc("tc-tour-dialog").showModal();
}
async function tcConnectWallet() {
  if (!window.ethereum) {
    tcShowToast("Chưa phát hiện MetaMask. Cài tiện ích MetaMask để thử kết nối ví.");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    tcState.account = accounts && accounts[0] ? accounts[0] : null;
    tcUpdateWallet();
    tcShowToast(tcState.account ? "Đã kết nối ví MetaMask. Mua vé thật cần tích hợp contract." : "Chưa chọn tài khoản ví.");
  } catch (error) {
    tcShowToast(error && error.code === 4001 ? "Bạn đã từ chối yêu cầu kết nối ví." : "Không thể kết nối ví. Vui lòng thử lại.");
  }
}
function tcUpdateWallet() {
  tc("tc-wallet-label").textContent = tcState.account ? `${tcState.account.slice(0, 6)}…${tcState.account.slice(-4)}` : "Kết nối MetaMask";
  if (tcState.selectedTour && tc("tc-tour-dialog").open) {
    tc("tc-buy").textContent = tcState.account ? "Mua 01 vé (demo)" : "Kết nối ví để mua vé";
  }
}

tc("tc-tour-grid").addEventListener("click", event => {
  const button = event.target.closest("[data-tc-tour]");
  if (button) tcOpenTour(button.dataset.tcTour);
});
tc("tc-search").addEventListener("input", tcRenderTours);
tc("tc-clear-search").addEventListener("click", () => { tc("tc-search").value = ""; tcRenderTours(); });
tc("tc-connect").addEventListener("click", tcConnectWallet);
tc("tc-close-dialog").addEventListener("click", () => tc("tc-tour-dialog").close());
tc("tc-tour-dialog").addEventListener("click", event => { if (event.target === tc("tc-tour-dialog")) tc("tc-tour-dialog").close(); });
tc("tc-buy").addEventListener("click", async () => {
  if (!tcState.account) { await tcConnectWallet(); return; }
  tc("tc-dialog-message").textContent = "Ví đã kết nối. Đây vẫn là bản demo: cần ABI và địa chỉ contract đã triển khai trước khi gọi buyTicket(tourId, { value: tour.price }).";
  tcShowToast("Chưa gửi giao dịch. Cần tích hợp contract theo quy ước nhóm.");
});
if (window.ethereum && window.ethereum.on) {
  window.ethereum.on("accountsChanged", accounts => {
    tcState.account = accounts && accounts[0] ? accounts[0] : null;
    tcUpdateWallet();
    tcShowToast(tcState.account ? "Đã cập nhật tài khoản ví." : "Ví đã ngắt kết nối.");
  });
  window.ethereum.on("chainChanged", () => tcShowToast("Mạng ví vừa thay đổi. Cần kiểm tra chainId trước khi giao dịch."));
}
tcRenderTours();
