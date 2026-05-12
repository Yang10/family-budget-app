// ==========================================
// 1. Google Sheets 設定區
// ==========================================
// ⚠️ 請將這裡替換為您的 Google Apps Script Web App 網址
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwAcAkqzooVTI9E0uAEvM6Yl6iLwqs69l-eQMWFd4SrvopphazrsZnWciT8CQ61b0r5/exec";

// 安全鎖設定
const SECURITY_PIN = "1234"; // 您可以在這裡修改您的 4 位數密碼

// ==========================================
// 2. 系統變數與初始化
// ==========================================
const defaultAccounts = [
    // 銀行帳戶
    { id: 'bank1', name: '揚國泰', balance: 0 },
    { id: 'bank2', name: '妡永豐', balance: 0 },
    { id: 'bank3', name: '妡Line', balance: 0 },
    { id: 'bank4', name: '妡HSBC', balance: 0 },
    { id: 'bank5', name: '妡台銀', balance: 0 },
    { id: 'bank6', name: '妡王道', balance: 0 },
    // 其他資產
    { id: 'asset1', name: '避難包', balance: 0 },
    { id: 'asset2', name: '日幣', balance: 0 },
    { id: 'asset3', name: '韓幣', balance: 0 },
    { id: 'asset4', name: '紐幣', balance: 0 },
    { id: 'asset5', name: '投資', balance: 0 },
    { id: 'asset6', name: 'S證券', balance: 0 },
    { id: 'asset7', name: 'R證券', balance: 0 },
    { id: 'asset8', name: 'Y證券', balance: 0 }
];

const categories = {
    expense: ['房貸', '車貸', '學費', '水電瓦斯', '信用卡', '餐飲', '日常用品', '交通', '購物', '娛樂', '帳務校正'],
    income: ['薪水', '獎金', '投資獲利', '利息', '帳務校正']
};

const categoryIcon = {
    '房貸': 'fa-house', '車貸': 'fa-car', '學費': 'fa-graduation-cap', '水電瓦斯': 'fa-bolt',
    '信用卡': 'fa-credit-card', '餐飲': 'fa-utensils', '日常用品': 'fa-cart-shopping', '交通': 'fa-bus',
    '購物': 'fa-bag-shopping', '娛樂': 'fa-gamepad', '帳務校正': 'fa-pen-ruler',
    '薪水': 'fa-sack-dollar', '獎金': 'fa-gift', '投資獲利': 'fa-chart-line', '利息': 'fa-building-columns'
};

const categoryColor = {
    '房貸': '#4f46e5', '車貸': '#0ea5e9', '學費': '#8b5cf6', '水電瓦斯': '#f59e0b',
    '信用卡': '#ec4899', '餐飲': '#e11d48', '日常用品': '#059669', '交通': '#06b6d4',
    '購物': '#d946ef', '娛樂': '#6366f1', '帳務校正': '#64748b',
    '薪水': '#059669', '獎金': '#f59e0b', '投資獲利': '#10b981', '利息': '#3b82f6'
};

let state = {
    transactions: [],
    accounts: [],
    lastInventoryDate: null,
    inventoryHistory: [],
    savingsGoals: []
};

// 報表狀態
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth();
let selectedPayer = 'all';

// 判斷是否已設定 Google Sheets
function isSheetsConfigured() {
    return SCRIPT_URL && SCRIPT_URL !== "YOUR_SCRIPT_URL_HERE";
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tx-date').valueAsDate = new Date();
    initChart();
});

// ==========================================
// 3. 安全鎖邏輯
// ==========================================
function checkPin() {
    const input = document.getElementById('pin-input').value;
    const errorMsg = document.getElementById('pin-error');

    if (input === SECURITY_PIN) {
        document.getElementById('lock-screen').style.display = 'none';
        loadData();
    } else {
        errorMsg.style.display = 'block';
        document.getElementById('pin-input').value = '';
    }
}

// 支援按 Enter 解鎖
document.getElementById('pin-input')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') checkPin();
});

// ==========================================
// 4. 資料讀取 (Google Sheets / LocalStorage)
// ==========================================
async function loadData() {
    showLoading(true);

    if (isSheetsConfigured()) {
        try {
            const response = await fetch(SCRIPT_URL);
            const data = await response.json();

            state.transactions = data.transactions || [];
            state.accounts = (data.accounts && data.accounts.length > 0) ? data.accounts : defaultAccounts;
            state.lastInventoryDate = data.lastInventoryDate || null;

            // 同步到 localStorage 作為離線備份
            saveLocalData();
        } catch (error) {
            console.error("雲端載入失敗:", error);
            loadFromLocal();
            showToast('⚠️ 無法連線雲端，顯示本機快取', 'warning');
        }
    } else {
        loadFromLocal();
        showToast('ℹ️ 尚未連結 Google 試算表，使用本機儲存', 'info');
    }

    renderTransactions();
    updateDashboard();
    renderInventory();
    initNetWorthChart();
    renderGoals();
    showLoading(false);
}

function loadFromLocal() {
    state.transactions = JSON.parse(localStorage.getItem('fb_transactions')) || [];
    state.accounts = JSON.parse(localStorage.getItem('fb_accounts')) || defaultAccounts;
    state.lastInventoryDate = localStorage.getItem('fb_last_inventory') || null;
    state.inventoryHistory = JSON.parse(localStorage.getItem('fb_inventory_history')) || [];
    state.savingsGoals = JSON.parse(localStorage.getItem('fb_savings_goals')) || [];
}

// ==========================================
// 5. 資料寫入 (Google Sheets 背景同步)
// ==========================================
async function syncToSheets(action, payload) {
    if (!isSheetsConfigured()) return;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action, ...payload })
        });
    } catch (error) {
        console.error("同步失敗:", error);
        showToast('⚠️ 雲端同步失敗，資料已暫存本機', 'warning');
    }
}

// ==========================================
// 6. UI 控制 (頁籤與 Modal)
// ==========================================
function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    const titles = { record: '日常收支', dashboard: '本月報表', inventory: '資產盤點' };
    document.getElementById('header-title').textContent = titles[tabId] || '日常收支';

    const balanceDisplay = document.querySelector('.balance-display');
    if (balanceDisplay) {
        if (tabId === 'inventory') {
            // 盤點頁：顯示總資產
            const total = state.accounts.reduce((sum, a) => sum + a.balance, 0);
            document.getElementById('current-month-balance').textContent = `$${total.toLocaleString()}`;
            document.querySelector('.balance-label').textContent = '總資產淨值';
            balanceDisplay.style.display = 'flex';
        } else {
            document.querySelector('.balance-label').textContent = '本月結餘';
            balanceDisplay.style.display = 'flex';
            if (tabId === 'dashboard') { updateDashboard(); }
        }
    }
}

function openModal(type) {
    document.getElementById('tx-type').value = type;
    document.getElementById('modal-title').textContent = type === 'expense' ? '新增支出' : '新增收入';
    document.getElementById('modal-title').style.color = type === 'expense' ? 'var(--expense)' : 'var(--income)';

    const select = document.getElementById('tx-category');
    select.innerHTML = categories[type].map(cat => `<option value="${cat}">${cat}</option>`).join('');

    document.getElementById('transaction-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('transaction-modal').classList.remove('active');
    document.getElementById('transaction-form').reset();
    document.getElementById('tx-date').valueAsDate = new Date();
}

// ==========================================
// 7. 記帳功能 (新增 / 刪除)
// ==========================================
function handleTransactionSubmit(e) {
    e.preventDefault();

    const type = document.getElementById('tx-type').value;
    const amount = parseInt(document.getElementById('tx-amount').value);
    const category = document.getElementById('tx-category').value;
    const date = document.getElementById('tx-date').value;
    const note = document.getElementById('tx-note').value;

    // 取得選中的記帳人
    let payer = "揚";
    const payerOptions = document.getElementsByName('tx-payer');
    for (let i = 0; i < payerOptions.length; i++) {
        if (payerOptions[i].checked) {
            payer = payerOptions[i].value;
            break;
        }
    }

    // 防連點：停用按鈕
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const id = 'tx_' + Date.now();
    const newTx = { id, type, amount, category, date, note, payer, timestamp: new Date().toISOString() };

    // 1. 立即更新本地狀態與畫面（零延遲體驗）
    state.transactions.unshift(newTx);
    saveLocalData();
    renderTransactions();
    updateDashboard();
    closeModal();
    showToast('✅ 已儲存！', 'success');

    // 2. 背景同步到 Google Sheets
    syncToSheets('addTransaction', { data: newTx });

    // 恢復按鈕
    if (submitBtn) setTimeout(() => { submitBtn.disabled = false; }, 300);
}

function deleteTransaction(id) {
    if (!confirm("確定要刪除這筆紀錄嗎？")) return;

    // 1. 立即更新本地狀態與畫面
    state.transactions = state.transactions.filter(tx => tx.id !== id);
    saveLocalData();
    renderTransactions();
    updateDashboard();
    showToast('🗑️ 已刪除', 'success');

    // 2. 背景同步到 Google Sheets
    syncToSheets('deleteTransaction', { id });
}

// ==========================================
// 8. 渲染記帳列表
// ==========================================
function renderTransactions(txList) {
    const list = document.getElementById('recent-transactions');
    const source = txList || state.transactions;
    const sortedTx = [...source].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);

    if (sortedTx.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding: 20px;">尚無紀錄，開始記帳吧！</p>';
        return;
    }

    list.innerHTML = sortedTx.map(tx => {
        const isExpense = tx.type === 'expense';
        const typeClass = isExpense ? 'expense' : 'income';
        const sign = isExpense ? '-' : '+';
        const icon = categoryIcon[tx.category] || 'fa-receipt';
        const color = categoryColor[tx.category] || '#64748b';
        const payerIcon = tx.payer === '揚' ? 'fa-mars' : 'fa-venus';
        const payerColor = tx.payer === '揚' ? '#3b82f6' : '#ec4899';

        return `
            <div class="tx-item card">
                <div class="tx-info">
                    <div class="tx-icon-svg" style="background:${color}15;color:${color}">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div class="tx-details">
                        <h4>${tx.category} <span class="payer-badge" style="background:${payerColor}15;color:${payerColor}"><i class="fa-solid ${payerIcon}"></i> ${tx.payer}</span></h4>
                        <p>${tx.date} ${tx.note ? '· ' + tx.note : ''}</p>
                    </div>
                </div>
                <div class="tx-amount-group">
                    <span class="tx-amount ${typeClass}-text">${sign}$${tx.amount.toLocaleString()}</span>
                    <button class="tx-delete-btn" onclick="deleteTransaction('${tx.id}')" title="刪除此紀錄">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// 9. 儀表板與圖表
// ==========================================
let expenseChart = null;
let yearlyChart = null;

// 月份切換
function changeMonth(delta) {
    selectedMonth += delta;
    if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; }
    if (selectedMonth < 0) { selectedMonth = 11; selectedYear--; }
    updateMonthLabel();
    updateDashboard();
}

function updateMonthLabel() {
    const label = document.getElementById('current-month-label');
    if (label) label.textContent = `${selectedYear}年${selectedMonth + 1}月`;
}

// 記帳人篩選
function filterByPayer(payer) {
    selectedPayer = payer;
    document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
    event.currentTarget.classList.add('active');
    updateDashboard();
}

// 篩選交易（月份 + 記帳人）
function getFilteredTx() {
    return state.transactions.filter(tx => {
        const d = new Date(tx.date);
        const monthMatch = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        const payerMatch = selectedPayer === 'all' || tx.payer === selectedPayer;
        return monthMatch && payerMatch;
    });
}

function updateDashboard() {
    const filtered = getFilteredTx();
    let totalIncome = 0, totalExpense = 0;
    filtered.forEach(tx => {
        if (tx.type === 'income') totalIncome += tx.amount;
        if (tx.type === 'expense') totalExpense += tx.amount;
    });
    const balance = totalIncome - totalExpense;

    document.getElementById('current-month-balance').textContent = `$${balance.toLocaleString()}`;
    document.getElementById('avg-income').textContent = `$${totalIncome.toLocaleString()}`;
    document.getElementById('avg-expense').textContent = `$${totalExpense.toLocaleString()}`;
    document.getElementById('avg-savings').textContent = `$${balance.toLocaleString()}`;
    updateMonthLabel();

    if (expenseChart) updateChart();
    if (yearlyChart) updateYearlyChart();
}

function initChart() {
    Chart.defaults.color = '#64748b';
    Chart.defaults.font.family = "'Inter', 'Noto Sans TC', sans-serif";

    // 圓餅圖
    expenseChart = new Chart(document.getElementById('expenseChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0, cutout: '75%' }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#1e293b', padding: 12, font: { size: 11 } } },
                title: { display: true, text: '支出分佈', color: '#1e293b' }
            }
        }
    });

    // 年度長條圖
    yearlyChart = new Chart(document.getElementById('yearlyChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
            datasets: [
                { label: '收入', data: Array(12).fill(0), backgroundColor: 'rgba(5, 150, 105, 0.7)', borderRadius: 4 },
                { label: '支出', data: Array(12).fill(0), backgroundColor: 'rgba(225, 29, 72, 0.7)', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: '年度收支概覽', color: '#1e293b' },
                legend: { labels: { color: '#1e293b', font: { size: 11 } } }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, ticks: { callback: v => v >= 10000 ? (v/10000)+'萬' : v.toLocaleString() } }
            }
        }
    });

    // 自動跳到最近有資料的月份
    autoSelectLatestMonth();
}

function autoSelectLatestMonth() {
    if (state.transactions.length === 0) return;
    const dates = state.transactions.map(tx => new Date(tx.date)).sort((a, b) => b - a);
    selectedYear = dates[0].getFullYear();
    selectedMonth = dates[0].getMonth();
}

const chartColors = ['#4f46e5','#8b5cf6','#ec4899','#e11d48','#f59e0b','#059669','#3b82f6','#64748b','#06b6d4','#84cc16','#f97316'];

function updateChart() {
    const filtered = getFilteredTx();
    const categoryTotals = {};
    filtered.forEach(tx => {
        if (tx.type === 'expense') categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    if (labels.length === 0) {
        expenseChart.data.labels = ['無資料'];
        expenseChart.data.datasets[0].data = [1];
        expenseChart.data.datasets[0].backgroundColor = ['#e2e8f0'];
    } else {
        expenseChart.data.labels = labels;
        expenseChart.data.datasets[0].data = data;
        expenseChart.data.datasets[0].backgroundColor = chartColors.slice(0, labels.length);
    }
    expenseChart.options.plugins.title.text = `${selectedYear}年${selectedMonth + 1}月 支出分佈`;
    expenseChart.update();
}

function updateYearlyChart() {
    const incomeByMonth = Array(12).fill(0);
    const expenseByMonth = Array(12).fill(0);

    state.transactions.forEach(tx => {
        const d = new Date(tx.date);
        if (d.getFullYear() === selectedYear && (selectedPayer === 'all' || tx.payer === selectedPayer)) {
            if (tx.type === 'income') incomeByMonth[d.getMonth()] += tx.amount;
            if (tx.type === 'expense') expenseByMonth[d.getMonth()] += tx.amount;
        }
    });

    yearlyChart.data.datasets[0].data = incomeByMonth;
    yearlyChart.data.datasets[1].data = expenseByMonth;
    yearlyChart.options.plugins.title.text = `${selectedYear}年 收支概覽`;
    yearlyChart.update();
}

// ==========================================
// 10. 盤點功能與動態帳戶
// ==========================================
let inventoryEditing = false;

function renderInventory() {
    const list = document.getElementById('account-list');
    let total = 0;
    const isEditing = inventoryEditing;

    list.innerHTML = state.accounts.map(acc => {
        total += acc.balance;
        return `
            <div class="account-item card">
                <span class="account-name">${acc.name}</span>
                ${isEditing
                    ? `<input type="number" class="account-input" data-id="${acc.id}" value="${acc.balance}" onchange="updateAccountBalance(this)" inputmode="numeric">
                       <button class="delete-account-btn" onclick="deleteAccount('${acc.id}')" title="刪除"><i class="fa-solid fa-trash-can"></i></button>`
                    : `<span class="account-value">$${acc.balance.toLocaleString()}</span>`
                }
            </div>
        `;
    }).join('');

    document.getElementById('current-month-balance').textContent = `$${total.toLocaleString()}`;

    const addSection = document.querySelector('.add-account-section');
    const saveBtn = document.getElementById('btn-save-inventory');
    const editBtn = document.getElementById('btn-edit-inventory');
    if (addSection) addSection.style.display = isEditing ? 'flex' : 'none';
    if (saveBtn) saveBtn.style.display = isEditing ? 'block' : 'none';
    if (editBtn) editBtn.style.display = isEditing ? 'none' : 'block';

    if (state.lastInventoryDate) {
        const date = new Date(state.lastInventoryDate);
        document.getElementById('last-inventory-date').textContent = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    }
}

function toggleInventoryEdit() {
    inventoryEditing = true;
    renderInventory();
}

function updateAccountBalance(input) {
    const id = input.dataset.id;
    const value = parseInt(input.value) || 0;
    const acc = state.accounts.find(a => a.id === id);
    if (acc) acc.balance = value;
    let total = state.accounts.reduce((sum, a) => sum + a.balance, 0);
    document.getElementById('current-month-balance').textContent = `$${total.toLocaleString()}`;
}

function addNewAccount() {
    const input = document.getElementById('new-account-name');
    const name = input.value.trim();
    if (!name) return;
    state.accounts.push({ id: 'acc_' + Date.now(), name: name, balance: 0 });
    input.value = '';
    renderInventory();
}

function deleteAccount(id) {
    if (confirm("確定要刪除這個帳戶嗎？")) {
        state.accounts = state.accounts.filter(acc => acc.id !== id);
        renderInventory();
    }
}

function saveInventory() {
    document.querySelectorAll('.account-input').forEach(input => {
        const id = input.dataset.id;
        const value = parseInt(input.value) || 0;
        const acc = state.accounts.find(a => a.id === id);
        if (acc) acc.balance = value;
    });
    state.lastInventoryDate = new Date().toISOString();
    saveLocalData();
    inventoryEditing = false;
    renderInventory();
    syncToSheets('saveInventory', {
        accounts: state.accounts,
        lastInventoryDate: state.lastInventoryDate
    });
    showToast('✅ 盤點已儲存！', 'success');

    // 記錄歷史淨資產
    const total = state.accounts.reduce((sum, a) => sum + a.balance, 0);
    const today = new Date().toISOString().slice(0, 10);
    const existing = state.inventoryHistory.findIndex(h => h.date === today);
    if (existing >= 0) {
        state.inventoryHistory[existing].total = total;
    } else {
        state.inventoryHistory.push({ date: today, total });
    }
    saveLocalData();
    renderNetWorthChart();
}

// ==========================================
// 11. 搜尋與篩選
// ==========================================
function filterTransactions() {
    const keyword = document.getElementById('tx-search').value.trim().toLowerCase();
    if (!keyword) { renderTransactions(); return; }
    const filtered = state.transactions.filter(tx =>
        tx.category.toLowerCase().includes(keyword) ||
        (tx.note && tx.note.toLowerCase().includes(keyword)) ||
        (tx.payer && tx.payer.toLowerCase().includes(keyword))
    );
    renderTransactions(filtered);
}

// ==========================================
// 12. 複製上月固定支出
// ==========================================
const fixedCategories = ['房貸', '車貸', '學費', '水電瓦斯', '信用卡'];

function copyLastMonth() {
    const now = new Date();
    let targetMonth = now.getMonth() - 1;
    let targetYear = now.getFullYear();
    if (targetMonth < 0) { targetMonth = 11; targetYear--; }

    const lastMonthFixed = state.transactions.filter(tx => {
        const d = new Date(tx.date);
        return tx.type === 'expense' && fixedCategories.includes(tx.category) &&
               d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    if (lastMonthFixed.length === 0) {
        showToast('⚠️ 上月沒有固定支出可複製', 'warning');
        return;
    }

    if (!confirm(`將複製 ${lastMonthFixed.length} 筆上月固定支出到本月，確定嗎？`)) return;

    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const dateStr = `${thisYear}-${String(thisMonth).padStart(2,'0')}-05`;

    lastMonthFixed.forEach(tx => {
        const newTx = {
            id: 'tx_' + Date.now() + Math.random().toString(36).slice(2, 5),
            type: 'expense',
            amount: tx.amount,
            category: tx.category,
            date: dateStr,
            note: tx.note || '',
            payer: tx.payer,
            timestamp: new Date().toISOString()
        };
        state.transactions.unshift(newTx);
        syncToSheets('addTransaction', { data: newTx });
    });

    saveLocalData();
    renderTransactions();
    updateDashboard();
    showToast(`✅ 已複製 ${lastMonthFixed.length} 筆固定支出`, 'success');
}

// ==========================================
// 13. 淨資產走勢圖
// ==========================================
let netWorthChart = null;

function initNetWorthChart() {
    const ctx = document.getElementById('netWorthChart');
    if (!ctx) return;
    netWorthChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{
            label: '淨資產',
            data: [],
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#8b5cf6'
        }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: '淨資產走勢', color: '#1e293b' },
                legend: { display: false }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: false, ticks: { callback: v => (v/10000).toFixed(0)+'萬' } }
            }
        }
    });
    renderNetWorthChart();
}

function renderNetWorthChart() {
    if (!netWorthChart) return;
    const history = state.inventoryHistory.sort((a, b) => a.date.localeCompare(b.date));
    if (history.length === 0) {
        netWorthChart.data.labels = ['尚無資料'];
        netWorthChart.data.datasets[0].data = [0];
    } else {
        netWorthChart.data.labels = history.map(h => h.date.slice(5));
        netWorthChart.data.datasets[0].data = history.map(h => h.total);
    }
    netWorthChart.update();
}

// ==========================================
// 14. 儲蓄目標
// ==========================================
function renderGoals() {
    const list = document.getElementById('goals-list');
    if (!list) return;
    if (!state.savingsGoals || state.savingsGoals.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.9rem">尚未設定目標</p>';
        return;
    }
    list.innerHTML = state.savingsGoals.map(g => {
        const pct = Math.min(100, Math.round((g.current / g.target) * 100));
        const color = pct >= 80 ? '#059669' : pct >= 50 ? '#f59e0b' : '#e11d48';
        return `
            <div class="goal-card card">
                <div class="goal-header">
                    <span class="goal-name">🎯 ${g.name}</span>
                    <button class="tx-delete-btn" onclick="deleteGoal('${g.id}')" title="刪除"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div class="goal-amounts">$${g.current.toLocaleString()} / $${g.target.toLocaleString()} (${pct}%)</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
            </div>
        `;
    }).join('');
}

function openGoalModal() {
    document.getElementById('goal-modal').classList.add('active');
}
function closeGoalModal() {
    document.getElementById('goal-modal').classList.remove('active');
}

function handleGoalSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('goal-name').value.trim();
    const target = parseInt(document.getElementById('goal-target').value) || 0;
    const current = parseInt(document.getElementById('goal-current').value) || 0;
    if (!name || !target) return;

    state.savingsGoals.push({ id: 'goal_' + Date.now(), name, target, current });
    saveLocalData();
    renderGoals();
    closeGoalModal();
    document.getElementById('goal-name').value = '';
    document.getElementById('goal-target').value = '';
    document.getElementById('goal-current').value = '';
    showToast('✅ 目標已新增', 'success');
}

function deleteGoal(id) {
    if (!confirm('確定刪除這個目標嗎？')) return;
    state.savingsGoals = state.savingsGoals.filter(g => g.id !== id);
    saveLocalData();
    renderGoals();
}

// ==========================================
// 12. 本機備用儲存 (Fallback / 離線快取)
// ==========================================
function saveLocalData() {
    localStorage.setItem('fb_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('fb_accounts', JSON.stringify(state.accounts));
    localStorage.setItem('fb_inventory_history', JSON.stringify(state.inventoryHistory || []));
    localStorage.setItem('fb_savings_goals', JSON.stringify(state.savingsGoals || []));
    if (state.lastInventoryDate) {
        localStorage.setItem('fb_last_inventory', state.lastInventoryDate);
    }
}

// ==========================================
// 13. Toast 通知 & Loading
// ==========================================
function showToast(message, type = 'info') {
    // 移除舊 toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.querySelector('.app-container').appendChild(toast);

    // 觸發動畫
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function showLoading(show) {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = show ? 'flex' : 'none';
}
