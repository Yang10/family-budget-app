// ==========================================
// 1. Firebase 設定區 (已填入您的設定)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBjvyzNJOzzJ5Iw4nP6UZH0M64YsWAEmGw",
    authDomain: "family-budget-app-5bc73.firebaseapp.com",
    projectId: "family-budget-app-5bc73",
    storageBucket: "family-budget-app-5bc73.firebasestorage.app",
    messagingSenderId: "515553502120",
    appId: "1:515553502120:web:9f467ff964bb8bfa9fb39d"
};

// 安全鎖設定
const SECURITY_PIN = "1234"; // 您可以在這裡修改您的 4 位數密碼

// ==========================================
// 2. 系統變數與初始化
// ==========================================
let db = null;
let useFirebase = Object.keys(firebaseConfig).length > 0;

const defaultAccounts = [
    { id: 'acc1', name: '揚國泰', balance: 0 },
    { id: 'acc2', name: '妡永豐', balance: 0 },
    { id: 'acc3', name: '妡Line', balance: 0 },
    { id: 'acc4', name: '外幣(日/韓/紐)', balance: 0 },
    { id: 'acc5', name: '證券(S/R/Y)', balance: 0 }
];

const categories = {
    expense: ['餐飲', '日常用品', '交通', '購物', '娛樂', '固定支出 (房貸/水電等)', '帳務校正 / 漏記 / 匯損'],
    income: ['薪水', '獎金', '投資獲利', '利息', '帳務校正 / 溢出']
};

let state = {
    transactions: [],
    accounts: [],
    lastInventoryDate: null
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 預設日期為今天
    document.getElementById('tx-date').valueAsDate = new Date();
    
    // 初始化 Chart.js
    initChart();
    
    // 檢查 Firebase 是否已設定
    if (useFirebase) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        // 如果有 Firebase，需等待解鎖後再 listen
    } else {
        // Fallback to LocalStorage
        console.log("尚未設定 Firebase，目前使用本機儲存");
        state.transactions = JSON.parse(localStorage.getItem('fb_transactions')) || [];
        state.accounts = JSON.parse(localStorage.getItem('fb_accounts')) || defaultAccounts;
        state.lastInventoryDate = localStorage.getItem('fb_last_inventory') || null;
    }
});

// ==========================================
// 3. 安全鎖邏輯
// ==========================================
function checkPin() {
    const input = document.getElementById('pin-input').value;
    const errorMsg = document.getElementById('pin-error');
    
    if (input === SECURITY_PIN) {
        document.getElementById('lock-screen').style.display = 'none';
        
        // 解鎖後載入資料
        if (useFirebase) {
            setupFirebaseListeners();
        } else {
            renderTransactions();
            updateDashboard();
            renderInventory();
        }
    } else {
        errorMsg.style.display = 'block';
        document.getElementById('pin-input').value = '';
    }
}

// 支援按 Enter 解鎖
document.getElementById('pin-input')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkPin();
    }
});

// ==========================================
// 4. Firebase 同步邏輯
// ==========================================
function setupFirebaseListeners() {
    // 監聽流水帳
    db.collection("transactions").orderBy("date", "desc").onSnapshot((snapshot) => {
        const txs = [];
        snapshot.forEach((doc) => {
            txs.push({ id: doc.id, ...doc.data() });
        });
        state.transactions = txs;
        renderTransactions();
        updateDashboard();
    });

    // 監聽盤點帳戶與狀態
    db.collection("inventory").doc("status").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            state.accounts = data.accounts || defaultAccounts;
            state.lastInventoryDate = data.lastInventoryDate || null;
            renderInventory();
        } else {
            // 初始化預設帳戶到 Firebase
            db.collection("inventory").doc("status").set({
                accounts: defaultAccounts,
                lastInventoryDate: null
            });
        }
    });
}

// ==========================================
// 5. UI 控制 (頁籤與 Modal)
// ==========================================
function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    if (tabId === 'dashboard') updateChart();
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
// 6. 記帳功能
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
    for(let i=0; i<payerOptions.length; i++) {
        if(payerOptions[i].checked) {
            payer = payerOptions[i].value;
            break;
        }
    }
    
    const newTx = { type, amount, category, date, note, payer, timestamp: new Date().toISOString() };
    
    if (useFirebase) {
        db.collection("transactions").add(newTx).then(() => closeModal());
    } else {
        newTx.id = Date.now().toString();
        state.transactions.unshift(newTx);
        saveLocalData();
        renderTransactions();
        updateDashboard();
        closeModal();
    }
}

function renderTransactions() {
    const list = document.getElementById('recent-transactions');
    const sortedTx = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
    
    if (sortedTx.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding: 20px;">尚無紀錄，開始記帳吧！</p>';
        return;
    }
    
    list.innerHTML = sortedTx.map(tx => {
        const isExpense = tx.type === 'expense';
        const iconClass = isExpense ? 'fa-minus' : 'fa-plus';
        const typeClass = isExpense ? 'expense' : 'income';
        const sign = isExpense ? '-' : '+';
        const payerBadge = tx.payer ? `<span class="payer-badge badge-${tx.payer}">${tx.payer}</span>` : '';
        
        return `
            <div class="tx-item card">
                <div class="tx-info">
                    <div class="tx-icon ${typeClass}">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div class="tx-details">
                        <h4>${tx.category} ${payerBadge}</h4>
                        <p>${tx.date} ${tx.note ? '· ' + tx.note : ''}</p>
                    </div>
                </div>
                <div class="tx-amount ${typeClass}-text">
                    ${sign}$${tx.amount.toLocaleString()}
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// 7. 儀表板與圖表
// ==========================================
let expenseChart = null;

function updateDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            if (tx.type === 'income') totalIncome += tx.amount;
            if (tx.type === 'expense') totalExpense += tx.amount;
        }
    });
    
    const balance = totalIncome - totalExpense;
    
    document.getElementById('current-month-balance').textContent = `$${balance.toLocaleString()}`;
    document.getElementById('avg-income').textContent = `$${totalIncome.toLocaleString()}`;
    document.getElementById('avg-expense').textContent = `$${totalExpense.toLocaleString()}`;
    document.getElementById('avg-savings').textContent = `$${balance.toLocaleString()}`;
    
    if(expenseChart) updateChart();
}

function initChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    Chart.defaults.color = '#64748b';
    Chart.defaults.font.family = "'Inter', 'Noto Sans TC', sans-serif";
    
    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#4f46e5', '#8b5cf6', '#ec4899', '#e11d48', '#f59e0b', '#059669', '#3b82f6', '#64748b'],
                borderWidth: 0, cutout: '75%'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#1e293b', padding: 15, font: {size: 11} } },
                title: { display: true, text: '本月支出分佈', color: '#1e293b' }
            }
        }
    });
}

function updateChart() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const categoryTotals = {};
    
    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (tx.type === 'expense' && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
        }
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
        expenseChart.data.datasets[0].backgroundColor = ['#4f46e5', '#8b5cf6', '#ec4899', '#e11d48', '#f59e0b', '#059669', '#3b82f6', '#64748b'];
    }
    expenseChart.update();
}

// ==========================================
// 8. 盤點功能與動態帳戶
// ==========================================
function renderInventory() {
    const list = document.getElementById('account-list');
    let total = 0;
    
    list.innerHTML = state.accounts.map(acc => {
        total += acc.balance;
        return `
            <div class="account-item card">
                <span class="account-name">${acc.name}</span>
                <input type="number" class="account-input" data-id="${acc.id}" value="${acc.balance}" onchange="updateAccountBalance(this)">
                <button class="delete-account-btn" onclick="deleteAccount('${acc.id}')" title="刪除此帳戶">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
    }).join('');
    
    document.getElementById('net-worth-total').textContent = `$${total.toLocaleString()}`;
    
    if (state.lastInventoryDate) {
        const date = new Date(state.lastInventoryDate);
        document.getElementById('last-inventory-date').textContent = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
    }
}

function updateAccountBalance(input) {
    const id = input.dataset.id;
    const value = parseInt(input.value) || 0;
    const acc = state.accounts.find(a => a.id === id);
    if (acc) acc.balance = value;
    
    let total = state.accounts.reduce((sum, a) => sum + a.balance, 0);
    document.getElementById('net-worth-total').textContent = `$${total.toLocaleString()}`;
}

function addNewAccount() {
    const input = document.getElementById('new-account-name');
    const name = input.value.trim();
    if (!name) return;
    
    const newAcc = {
        id: 'acc_' + Date.now(),
        name: name,
        balance: 0
    };
    
    state.accounts.push(newAcc);
    input.value = '';
    
    // 立即渲染畫面，等待 User 按「儲存」才寫入資料庫
    renderInventory();
}

function deleteAccount(id) {
    if (confirm("確定要刪除這個帳戶嗎？（這只會從盤點清單移除，不會刪除日常記帳紀錄）")) {
        state.accounts = state.accounts.filter(acc => acc.id !== id);
        renderInventory();
        // 刪除後立即儲存
        saveInventory();
    }
}

function saveInventory() {
    // 同步所有的 input 值
    document.querySelectorAll('.account-input').forEach(input => {
        const id = input.dataset.id;
        const value = parseInt(input.value) || 0;
        const acc = state.accounts.find(a => a.id === id);
        if (acc) acc.balance = value;
    });

    state.lastInventoryDate = new Date().toISOString();
    
    if (useFirebase) {
        db.collection("inventory").doc("status").set({
            accounts: state.accounts,
            lastInventoryDate: state.lastInventoryDate
        }).then(() => showSaveSuccess());
    } else {
        saveLocalData();
        renderInventory();
        showSaveSuccess();
    }
}

function showSaveSuccess() {
    const btn = document.querySelector('#tab-inventory .btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check-double"></i> 已儲存成功！';
    btn.style.background = 'var(--income)';
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
    }, 2000);
}

// ==========================================
// 9. 本機備用儲存 (Fallback)
// ==========================================
function saveLocalData() {
    localStorage.setItem('fb_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('fb_accounts', JSON.stringify(state.accounts));
    if (state.lastInventoryDate) {
        localStorage.setItem('fb_last_inventory', state.lastInventoryDate);
    }
}
