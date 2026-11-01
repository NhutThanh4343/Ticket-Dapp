/*
 * TourChain TV1 - Full Customer & Admin System JS (Fixed Version)
 */

// Initial Mock Tour Data
const TC_MOCK_TOURS = [
  { id: 0n, name: "Khám phá Vịnh Hạ Long", departureTime: 1893456000n, price: 10000000000000000n, totalTickets: 30n, soldTickets: 8n, location: "Quảng Ninh, Việt Nam", tag: "Được yêu thích", image: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=85", description: "Khám phá cảnh quan thiên nhiên, những đảo đá vôi và hang động nổi tiếng của Vịnh Hạ Long." },
  { id: 1n, name: "Nghỉ dưỡng tại Đà Nẵng", departureTime: 1896048000n, price: 15000000000000000n, totalTickets: 25n, soldTickets: 10n, location: "Đà Nẵng, Việt Nam", tag: "Biển xanh", image: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=85", description: "Tận hưởng bãi biển, ẩm thực địa phương và những điểm tham quan nổi bật của thành phố Đà Nẵng." },
  { id: 2n, name: "Săn mây Đà Lạt", departureTime: 1898726400n, price: 8000000000000000n, totalTickets: 40n, soldTickets: 12n, location: "Lâm Đồng, Việt Nam", tag: "Thiên nhiên", image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85", description: "Tận hưởng khí hậu mát mẻ, rừng thông, hồ nước và những điểm check-in đặc trưng của Đà Lạt." },
  { id: 3n, name: "Một ngày ở Hội An", departureTime: 1901318400n, price: 6000000000000000n, totalTickets: 35n, soldTickets: 5n, location: "Quảng Nam, Việt Nam", tag: "Văn hóa", image: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=85", description: "Dạo phố cổ, khám phá kiến trúc, thưởng thức món ăn địa phương và nét văn hóa đặc sắc." },
  { id: 4n, name: "Chinh phục Sa Pa", departureTime: 1903996800n, price: 12000000000000000n, totalTickets: 20n, soldTickets: 6n, location: "Lào Cai, Việt Nam", tag: "Phiêu lưu", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85", description: "Ngắm núi non hùng vĩ, ruộng bậc thang và trải nghiệm văn hóa vùng cao phía Bắc." },
  { id: 5n, name: "Khám phá Phú Quốc", departureTime: 1906588800n, price: 18000000000000000n, totalTickets: 28n, soldTickets: 3n, location: "Kiên Giang, Việt Nam", tag: "Đảo ngọc", image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=85", description: "Thư giãn trên bãi biển, khám phá làng chài và tận hưởng cảnh hoàng hôn trên đảo." }
];

const tcState = {
  tours: TC_MOCK_TOURS,
  selectedTour: null,
  account: null,
  toastTimer: null,
  currentRole: 'user', // 'user' or 'admin'
  isAdminPaused: false
};

const tc = (id) => document.getElementById(id);

// --- UTILITIES ---
function tcFormatEth(wei) {
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
  tcState.toastTimer = setTimeout(() => node.classList.remove("is-visible"), 3200);
}

// --- CUSTOMER RENDER FUNCTIONS ---
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

// --- WALLET CONNECTION ---
async function tcConnectWallet() {
  if (!window.ethereum) {
    tcShowToast("Chưa phát hiện MetaMask. Cài tiện ích MetaMask để thử kết nối ví.");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    tcState.account = accounts && accounts[0] ? accounts[0] : null;
    tcUpdateWallet();
    tcShowToast(tcState.account ? "Đã kết nối ví MetaMask: " + tcState.account.slice(0,6) + "..." + tcState.account.slice(-4) : "Chưa chọn tài khoản ví.");
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

// --- LOGIN & ROLE SWITCHING LOGIC ---
function openLoginModal() {
  tc("tc-login-modal").showModal();
}

function closeLoginModal() {
  tc("tc-login-modal").close();
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const user = tc("usernameInput").value.trim().toLowerCase();
  const pass = tc("passwordInput").value.trim();

  if (pass !== "123456") {
    tcShowToast("Mật khẩu không chính xác! (Mật khẩu chuẩn: 123456)");
    return;
  }

  if (user === "admin") {
    setRole("admin");
    tcShowToast("Đã đăng nhập tài khoản ADMIN thành công!");
  } else if (user === "user") {
    setRole("user");
    tcShowToast("Đã đăng nhập tài khoản NGƯỜI DÙNG thành công!");
  } else {
    tcShowToast("Tên tài khoản không hợp lệ. Sử dụng 'admin' hoặc 'user'.");
    return;
  }

  closeLoginModal();
  tc("usernameInput").value = "";
  tc("passwordInput").value = "";
}

function setRole(role) {
  tcState.currentRole = role;
  const badge = tc("tc-user-badge");
  const brandSub = tc("tc-brand-sub");
  const customerNav = tc("tc-customer-nav");
  const adminNav = tc("tc-admin-nav");
  const customerView = tc("tc-customer-view");
  const adminView = tc("tc-admin-view");

  if (role === 'admin') {
    document.body.classList.add('tc-admin-mode');
    badge.textContent = "⚙️ Admin";
    badge.className = "tc-badge-admin";
    brandSub.textContent = "ADMIN CONSOLE";
    customerNav.style.display = 'none';
    adminNav.style.display = 'flex';
    customerView.style.display = 'none';
    adminView.style.display = 'block';

    switchAdminTab('overview');
    initAdminCharts();
  } else {
    document.body.classList.remove('tc-admin-mode');
    badge.textContent = "👤 User";
    badge.className = "tc-badge-customer";
    brandSub.textContent = "TRAVEL ON CHAIN";
    customerNav.style.display = 'flex';
    adminNav.style.display = 'none';
    customerView.style.display = 'block';
    adminView.style.display = 'none';
  }
}

function tcNavigateHome() {
  if (tcState.currentRole === 'admin') switchAdminTab('overview');
}

// --- ADMIN TABS & ACTIONS ---
function switchAdminTab(tabId) {
  document.querySelectorAll('.tc-admin-tab-content').forEach(el => el.style.display = 'none');
  
  // Highlight active button correctly
  document.querySelectorAll('.tc-admin-nav-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabId}'`)) {
      btn.classList.add('active');
    }
  });

  const selectedTab = tc(`tc-admin-tab-${tabId}`);
  if (selectedTab) selectedTab.style.display = 'block';
}

function tcAdminHandleMint(e) {
  e.preventDefault();
  const name = tc("tcMintName").value.trim();
  const location = tc("tcMintLocation").value.trim();
  const priceEth = parseFloat(tc("tcMintPrice").value) || 0.01;
  const supply = parseInt(tc("tcMintSupply").value) || 50;
  const tag = tc("tcMintTag").value.trim() || "Tour mới";
  const image = tc("tcMintImage").value.trim() || "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=85";
  const desc = tc("tcMintDesc").value.trim() || "Mô tả trải nghiệm tour du lịch mới.";

  const newTour = {
    id: BigInt(tcState.tours.length),
    name: name,
    departureTime: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    price: BigInt(Math.floor(priceEth * 1e18)),
    totalTickets: BigInt(supply),
    soldTickets: 0n,
    location: location,
    tag: tag,
    image: image,
    description: desc
  };

  tcState.tours.unshift(newTour);
  tcRenderTours();
  tcShowToast(`Đã Mint & Phát hành Tour "${name}" thành công!`);

  e.target.reset();
  switchAdminTab('overview');
}

function tcAdminDoCheckin() {
  const input = tc("tcCheckinTokenId");
  const val = input.value.trim();
  if (!val) {
    tcShowToast("Vui lòng nhập Token ID!");
    return;
  }

  const logList = tc("tcCheckinLog");
  const newItem = document.createElement("div");
  newItem.className = "tc-log-item";
  newItem.innerHTML = `<span>Token ${val} (Xác thực On-chain)</span> <span class="tc-tag-success">Thành công</span>`;
  logList.prepend(newItem);

  tcShowToast(`Token ${val} Check-in thành công!`);
  input.value = "";
}

function tcAdminTogglePause() {
  tcState.isAdminPaused = !tcState.isAdminPaused;
  const btn = tc("tcPauseContractBtn");
  const text = tc("tcContractStateText");

  if (tcState.isAdminPaused) {
    btn.textContent = "Kích hoạt lại Contract";
    btn.className = "tc-btn tc-btn-light";
    text.textContent = "ĐÃ TẠM DỪNG (Paused) - Toàn bộ giao dịch Mint & Mua vé bị ngắt";
    text.style.color = "#f87171";
    tcShowToast("Smart Contract đã chuyển sang trạng thái Paused!");
  } else {
    btn.textContent = "Tạm dừng Smart Contract";
    btn.className = "tc-btn tc-btn-danger";
    text.textContent = "Ngăn chặn toàn bộ giao dịch Mint và chuyển nhượng khi có sự cố.";
    text.style.color = "#94a3b8";
    tcShowToast("Smart Contract đã được kích hoạt lại!");
  }
}

function tcAdminWithdraw() {
  tcShowToast("Đã gửi yêu cầu Withdraw 42.8 ETH về ví Owner thành công!");
}

// Chart Instance Tracking
let salesChartInst = null;
let categoryChartInst = null;

function initAdminCharts() {
  if (typeof Chart === 'undefined') return;

  const ctxSales = tc('tcAdminSalesChart');
  if (ctxSales && !salesChartInst) {
    salesChartInst = new Chart(ctxSales, {
      type: 'line',
      data: {
        labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
        datasets: [{
          label: 'Doanh thu (ETH)',
          data: [12, 19, 15, 25, 22, 30, 28],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#233554' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: '#233554' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  const ctxCategory = tc('tcAdminCategoryChart');
  if (ctxCategory && !categoryChartInst) {
    categoryChartInst = new Chart(ctxCategory, {
      type: 'doughnut',
      data: {
        labels: ['Vịnh Hạ Long', 'Đà Nẵng', 'Đà Lạt', 'Khác'],
        datasets: [{
          data: [45, 25, 20, 10],
          backgroundColor: ['#06b6d4', '#3b82f6', '#10b981', '#8b5cf6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } }
      }
    });
  }
}

// --- EVENT LISTENERS ---
tc("tc-tour-grid").addEventListener("click", event => {
  const button = event.target.closest("[data-tc-tour]");
  if (button) tcOpenTour(button.dataset.tcTour);
});

tc("tc-search").addEventListener("input", tcRenderTours);
tc("tc-clear-search").addEventListener("click", () => { tc("tc-search").value = ""; tcRenderTours(); });
tc("tc-connect").addEventListener("click", tcConnectWallet);

tc("tc-close-dialog").addEventListener("click", () => tc("tc-tour-dialog").close());
tc("tc-tour-dialog").addEventListener("click", event => { if (event.target === tc("tc-tour-dialog")) tc("tc-tour-dialog").close(); });

tc("tc-login-modal").addEventListener("click", event => { if (event.target === tc("tc-login-modal")) closeLoginModal(); });

tc("tc-buy").addEventListener("click", async () => {
  if (!tcState.account) { await tcConnectWallet(); return; }
  if (tcState.isAdminPaused) {
    tcShowToast("Smart Contract hiện đang bị TẠM DỪNG bởi Admin. Không thể mua vé.");
    return;
  }
  tc("tc-dialog-message").textContent = "Ví đã kết nối. Đây vẫn là bản demo: cần ABI và địa chỉ contract trước khi mua.";
  tcShowToast("Chưa gửi giao dịch thật. Cần tích hợp Smart Contract.");
});

if (window.ethereum && window.ethereum.on) {
  window.ethereum.on("accountsChanged", accounts => {
    tcState.account = accounts && accounts[0] ? accounts[0] : null;
    tcUpdateWallet();
    tcShowToast(tcState.account ? "Đã cập nhật tài khoản ví." : "Ví đã ngắt kết nối.");
  });
  window.ethereum.on("chainChanged", () => tcShowToast("Mạng ví vừa thay đổi."));
}

// Initial Run
tcRenderTours();
