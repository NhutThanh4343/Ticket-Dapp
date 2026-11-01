// Preserve the incoming admin layout while admin contract integration is deferred.
// This view switch never grants a role, changes tours or submits transactions.
export function mountAdminPreview(document) {
  const $ = (id) => document.getElementById(id);
  const abort = new AbortController();
  const charts = [];
  let role = 'user';
  let chartsInitialized = false;
  const on = (node, event, callback) => node.addEventListener(event, callback, { signal: abort.signal });

  function tab(id) {
    document.querySelectorAll('.tc-admin-tab-content').forEach((node) => { node.hidden = node.id !== `tc-admin-tab-${id}`; node.style.removeProperty('display'); });
    document.querySelectorAll('[data-tc-admin-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tcAdminTab === id));
  }

  function initCharts() {
    if (chartsInitialized) return;
    chartsInitialized = true;
    const Chart = document.defaultView.Chart;
    if (!Chart) {
      document.querySelectorAll('.tc-chart-wrapper').forEach((node) => { node.textContent = 'Biểu đồ minh họa chưa tải được. Dữ liệu admin chưa được kết nối.'; });
      return;
    }
    charts.push(new Chart($('tcAdminSalesChart'), {
      type: 'line',
      data: { labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], datasets: [{
        label: 'Doanh thu minh họa (ETH)', data: [12, 19, 15, 25, 22, 30, 28],
        borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4,
      }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    }));
    charts.push(new Chart($('tcAdminCategoryChart'), {
      type: 'doughnut',
      data: { labels: ['Vịnh Hạ Long', 'Đà Nẵng', 'Đà Lạt', 'Khác'], datasets: [{
        data: [45, 25, 20, 10], backgroundColor: ['#06b6d4', '#3b82f6', '#10b981', '#8b5cf6'], borderWidth: 0,
      }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } },
    }));
  }

  function show(next) {
    role = next;
    const admin = role === 'admin';
    document.body.classList.toggle('tc-admin-mode', admin);
    $('tc-customer-nav').hidden = admin;
    $('tc-admin-nav').style.removeProperty('display');
    $('tc-admin-nav').hidden = !admin;
    $('tc-customer-view').hidden = admin;
    $('tc-admin-view').style.removeProperty('display');
    $('tc-admin-view').hidden = !admin;
    $('tc-user-badge').textContent = admin ? 'Admin · minh họa' : '👤 User';
    $('tc-user-badge').className = admin ? 'tc-badge-admin' : 'tc-badge-customer';
    $('tc-brand-sub').textContent = admin ? 'ADMIN PREVIEW' : 'TRAVEL ON CHAIN';
    if (admin) { tab('overview'); initCharts(); }
    $('tc-login-modal').close();
  }

  on($('tc-login-btn'), 'click', () => $('tc-login-modal').showModal());
  on($('tc-close-preview'), 'click', () => $('tc-login-modal').close());
  on($('tc-login-modal'), 'click', (event) => { if (event.target === $('tc-login-modal')) $('tc-login-modal').close(); });
  document.querySelectorAll('[data-tc-preview]').forEach((button) => on(button, 'click', () => show(button.dataset.tcPreview)));
  document.querySelectorAll('[data-tc-admin-tab]').forEach((button) => on(button, 'click', () => tab(button.dataset.tcAdminTab)));
  on(document.querySelector('[data-tc-home]'), 'click', () => { if (role === 'admin') tab('overview'); });
  on($('tc-admin-mint-form'), 'submit', (event) => event.preventDefault());
  document.querySelectorAll('#tc-admin-view input, #tc-admin-view textarea, #tc-admin-view button').forEach((node) => {
    node.disabled = true;
    node.title = 'Chức năng admin sẽ được tích hợp sau.';
  });

  return { destroy() { abort.abort(); charts.forEach((chart) => chart.destroy()); } };
}
