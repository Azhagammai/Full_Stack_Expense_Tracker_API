// API Configuration
const API_BASE_URL = 'http://127.0.0.1:5000';

// Global Variables
let currentUser = null;
let authToken = null;
let categories = [];
let expenses = [];
let currentFilter = 'all';
let expenseChart = null;

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!checkAuth()) {
        return;
    }

    // Initialize dashboard
    await initializeDashboard();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set today's date as default for expense form
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
});

// Authentication Check
function checkAuth() {
    authToken = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!authToken || !userStr) {
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        currentUser = JSON.parse(userStr);
        document.getElementById('userName').textContent = `Welcome, ${currentUser.first_name}!`;
        return true;
    } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
        return false;
    }
}

// Logout Function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// API Request Helper
async function makeAPIRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (response.status === 401) {
            // Token expired or invalid
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// Initialize Dashboard Data
async function initializeDashboard() {
    showLoading(true);
    
    try {
        // Load all data in parallel
        await Promise.all([
            loadCategories(),
            loadIncome(),
            loadExpenses(),
            loadSavings()
        ]);
        
        // Update UI
        updateCategoriesDisplay();
        updateExpensesDisplay();
        updateExpenseChart();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

// Load Categories
async function loadCategories() {
    try {
        const data = await makeAPIRequest(`${API_BASE_URL}/api/categories`);
        if (data.status === 'success') {
            categories = data.data.categories;
            updateCategorySelects();
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showToast('Error loading categories', 'error');
    }
}

// Load Income
async function loadIncome() {
    try {
        const data = await makeAPIRequest(`${API_BASE_URL}/api/income`);
        if (data.status === 'success') {
            const income = data.data.income.amount || 0;
            document.getElementById('monthlyIncome').textContent = formatCurrency(income);
        }
    } catch (error) {
        console.error('Error loading income:', error);
    }
}

// Load Expenses
async function loadExpenses(filter = 'all') {
    try {
        let url = `${API_BASE_URL}/api/expenses`;
        
        if (filter !== 'all') {
            url += `?filter=${filter}`;
        }
        
        const data = await makeAPIRequest(url);
        if (data.status === 'success') {
            expenses = data.data.expenses;
        }
    } catch (error) {
        console.error('Error loading expenses:', error);
        showToast('Error loading expenses', 'error');
    }
}

// Load Savings
async function loadSavings() {
    try {
        const data = await makeAPIRequest(`${API_BASE_URL}/api/savings`);
        if (data.status === 'success') {
            const summary = data.data.monthly_summary;
            
            document.getElementById('totalExpenses').textContent = formatCurrency(summary.total_expenses);
            document.getElementById('totalSavings').textContent = formatCurrency(summary.savings);
            document.getElementById('savingsPercentage').textContent = `${summary.savings_percentage}% saved`;
            
            // Update expense count
            const totalCount = Object.values(data.data.expense_breakdown).reduce((sum, cat) => sum + cat.monthly_count, 0);
            document.getElementById('expenseCount').textContent = `${totalCount} transactions`;
        }
    } catch (error) {
        console.error('Error loading savings:', error);
    }
}

// Update Categories Display
function updateCategoriesDisplay() {
    const container = document.getElementById('categoriesList');
    
    if (categories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tags"></i>
                <h3>No Categories Yet</h3>
                <p>Create your first category to start tracking expenses</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = categories.map(category => `
        <div class="category-item" onclick="filterByCategory('${category.id}')">
            <h4>${category.title}</h4>
            <p>${category.description}</p>
            <div class="category-amount">${formatCurrency(category.total_amount || 0)}</div>
            <small>${category.expense_count || 0} expenses</small>
        </div>
    `).join('');
}

// Update Category Selects
function updateCategorySelects() {
    const selects = ['expenseCategory', 'editExpenseCategory'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Select Category</option>' +
                categories.map(cat => `<option value="${cat.id}">${cat.title}</option>`).join('');
        }
    });
}

// Update Expenses Display
function updateExpensesDisplay() {
    const container = document.getElementById('expensesList');
    
    if (expenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>No Expenses Found</h3>
                <p>Add your first expense to start tracking your spending</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = expenses.map(expense => {
        const category = categories.find(cat => cat.id === expense.category_id);
        const categoryName = category ? category.title : 'Unknown';
        const date = new Date(expense.expense_date).toLocaleDateString();
        
        return `
            <div class="expense-item">
                <div class="expense-info">
                    <h4>${expense.note}</h4>
                    <p>${categoryName} • ${date}</p>
                </div>
                <div class="expense-amount">${formatCurrency(expense.amount)}</div>
                <div class="expense-actions">
                    <button class="btn-icon btn-edit" onclick="editExpense('${expense.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteExpense('${expense.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Update Expense Chart
function updateExpenseChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    // Destroy existing chart
    if (expenseChart) {
        expenseChart.destroy();
    }
    
    // Calculate category totals
    const categoryTotals = {};
    expenses.forEach(expense => {
        const category = categories.find(cat => cat.id === expense.category_id);
        const categoryName = category ? category.title : 'Unknown';
        
        if (!categoryTotals[categoryName]) {
            categoryTotals[categoryName] = 0;
        }
        categoryTotals[categoryName] += expense.amount;
    });
    
    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    
    if (labels.length === 0) {
        // Show empty chart message
        ctx.font = '16px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No expense data to display', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
    ];
    
    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

// Event Listeners Setup
function setupEventListeners() {
    // Income Form
    document.getElementById('incomeForm').addEventListener('submit', handleIncomeSubmit);
    
    // Category Form
    document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);
    
    // Add Expense Form
    document.getElementById('addExpenseForm').addEventListener('submit', handleAddExpenseSubmit);
    
    // Edit Expense Form
    document.getElementById('editExpenseForm').addEventListener('submit', handleEditExpenseSubmit);
    
    // Modal close events
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// Handle Income Form Submit
async function handleIncomeSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('incomeAmount').value);
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid income amount', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const data = await makeAPIRequest(`${API_BASE_URL}/api/income`, {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
        
        if (data.status === 'success') {
            showToast('Monthly income updated successfully', 'success');
            closeModal('incomeModal');
            await loadIncome();
            await loadSavings();
        }
    } catch (error) {
        showToast(error.message || 'Error updating income', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle Category Form Submit
async function handleCategorySubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('categoryTitle').value;
    const description = document.getElementById('categoryDescription').value;
    
    if (!title || !description) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const data = await makeAPIRequest(`${API_BASE_URL}/api/categories`, {
            method: 'POST',
            body: JSON.stringify({ title, description })
        });
        
        if (data.status === 'success') {
            showToast('Category created successfully', 'success');
            closeModal('categoryModal');
            document.getElementById('categoryForm').reset();
            await loadCategories();
            updateCategoriesDisplay();
        }
    } catch (error) {
        showToast(error.message || 'Error creating category', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle Add Expense Form Submit
async function handleAddExpenseSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const note = document.getElementById('expenseNote').value;
    const categoryId = document.getElementById('expenseCategory').value;
    const date = document.getElementById('expenseDate').value;
    
    if (!amount || !note || !categoryId || !date) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const expenseDate = new Date(date).toISOString();
        
        const data = await makeAPIRequest(`${API_BASE_URL}/api/expenses`, {
            method: 'POST',
            body: JSON.stringify({
                amount,
                note,
                category_id: categoryId,
                expense_date: expenseDate
            })
        });
        
        if (data.status === 'success') {
            showToast('Expense added successfully', 'success');
            document.getElementById('addExpenseForm').reset();
            document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
            
            // Refresh data
            await Promise.all([
                loadCategories(),
                loadExpenses(currentFilter),
                loadSavings()
            ]);
            
            updateCategoriesDisplay();
            updateExpensesDisplay();
            updateExpenseChart();
        }
    } catch (error) {
        showToast(error.message || 'Error adding expense', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle Edit Expense Form Submit
async function handleEditExpenseSubmit(e) {
    e.preventDefault();
    
    const expenseId = document.getElementById('editExpenseId').value;
    const amount = parseFloat(document.getElementById('editExpenseAmount').value);
    const note = document.getElementById('editExpenseNote').value;
    const categoryId = document.getElementById('editExpenseCategory').value;
    const date = document.getElementById('editExpenseDate').value;
    
    if (!amount || !note || !categoryId || !date) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const expenseDate = new Date(date).toISOString();
        
        const data = await makeAPIRequest(`${API_BASE_URL}/api/expenses/${expenseId}`, {
            method: 'PUT',
            body: JSON.stringify({
                amount,
                note,
                category_id: categoryId,
                expense_date: expenseDate
            })
        });
        
        if (data.status === 'success') {
            showToast('Expense updated successfully', 'success');
            closeModal('editExpenseModal');
            
            // Refresh data
            await Promise.all([
                loadCategories(),
                loadExpenses(currentFilter),
                loadSavings()
            ]);
            
            updateCategoriesDisplay();
            updateExpensesDisplay();
            updateExpenseChart();
        }
    } catch (error) {
        showToast(error.message || 'Error updating expense', 'error');
    } finally {
        showLoading(false);
    }
}

// Edit Expense
async function editExpense(expenseId) {
    const expense = expenses.find(exp => exp.id === expenseId);
    if (!expense) {
        showToast('Expense not found', 'error');
        return;
    }
    
    // Populate form
    document.getElementById('editExpenseId').value = expense.id;
    document.getElementById('editExpenseAmount').value = expense.amount;
    document.getElementById('editExpenseNote').value = expense.note;
    document.getElementById('editExpenseCategory').value = expense.category_id;
    document.getElementById('editExpenseDate').value = new Date(expense.expense_date).toISOString().split('T')[0];
    
    // Show modal
    showModal('editExpenseModal');
}

// Delete Expense
async function deleteExpense(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const data = await makeAPIRequest(`${API_BASE_URL}/api/expenses/${expenseId}`, {
            method: 'DELETE'
        });
        
        if (data.status === 'success') {
            showToast('Expense deleted successfully', 'success');
            
            // Refresh data
            await Promise.all([
                loadCategories(),
                loadExpenses(currentFilter),
                loadSavings()
            ]);
            
            updateCategoriesDisplay();
            updateExpensesDisplay();
            updateExpenseChart();
        }
    } catch (error) {
        showToast(error.message || 'Error deleting expense', 'error');
    } finally {
        showLoading(false);
    }
}

// Filter Functions
async function filterExpenses(filter) {
    currentFilter = filter;
    
    // Update active button
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });
    
    try {
        showLoading(true);
        await loadExpenses(filter);
        updateExpensesDisplay();
        updateExpenseChart();
    } catch (error) {
        showToast('Error filtering expenses', 'error');
    } finally {
        showLoading(false);
    }
}

async function filterByCustomDate() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        showToast('Please select both start and end dates', 'error');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        showToast('Start date must be before end date', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const startISO = new Date(startDate).toISOString();
        const endISO = new Date(endDate).toISOString();
        
        const url = `${API_BASE_URL}/api/expenses?filter=custom&start_date=${startISO}&end_date=${endISO}`;
        const data = await makeAPIRequest(url);
        
        if (data.status === 'success') {
            expenses = data.data.expenses;
            updateExpensesDisplay();
            updateExpenseChart();
            
            // Update filter buttons
            document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
        }
    } catch (error) {
        showToast('Error filtering by date range', 'error');
    } finally {
        showLoading(false);
    }
}

async function filterByCategory(categoryId) {
    try {
        showLoading(true);
        
        const url = `${API_BASE_URL}/api/expenses?category_id=${categoryId}`;
        const data = await makeAPIRequest(url);
        
        if (data.status === 'success') {
            expenses = data.data.expenses;
            updateExpensesDisplay();
            updateExpenseChart();
            
            // Update filter buttons
            document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
            
            const category = categories.find(cat => cat.id === categoryId);
            showToast(`Showing expenses for ${category?.title || 'category'}`, 'info');
        }
    } catch (error) {
        showToast('Error filtering by category', 'error');
    } finally {
        showLoading(false);
    }
}

// Refresh Functions
async function refreshExpenses() {
    try {
        showLoading(true);
        await Promise.all([
            loadCategories(),
            loadExpenses(currentFilter),
            loadSavings()
        ]);
        
        updateCategoriesDisplay();
        updateExpensesDisplay();
        updateExpenseChart();
        
        showToast('Data refreshed successfully', 'success');
    } catch (error) {
        showToast('Error refreshing data', 'error');
    } finally {
        showLoading(false);
    }
}

// Modal Functions
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Reset forms
    const modal = document.getElementById(modalId);
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => form.reset());
}

function showIncomeModal() {
    // Pre-fill with current income
    const currentIncome = document.getElementById('monthlyIncome').textContent.replace('$', '').replace(',', '');
    if (currentIncome && currentIncome !== '0.00') {
        document.getElementById('incomeAmount').value = currentIncome;
    }
    showModal('incomeModal');
}

function showCategoryModal() {
    showModal('categoryModal');
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-triangle' : 
                 'info-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
    
    // Allow manual removal
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape key to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.style.display === 'block') {
                closeModal(modal.id);
            }
        });
    }
    
    // Ctrl/Cmd + N for new expense
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('expenseAmount').focus();
    }
    
    // Ctrl/Cmd + R for refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        refreshExpenses();
    }
});

// Auto-refresh data every 5 minutes
setInterval(async () => {
    try {
        await Promise.all([
            loadCategories(),
            loadExpenses(currentFilter),
            loadSavings()
        ]);
        
        updateCategoriesDisplay();
        updateExpensesDisplay();
        updateExpenseChart();
    } catch (error) {
        console.error('Auto-refresh failed:', error);
    }
}, 5 * 60 * 1000); // 5 minutes
