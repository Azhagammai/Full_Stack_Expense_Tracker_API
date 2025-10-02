// API Configuration
const API_BASE_URL = 'http://127.0.0.1:5000';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginFormElement = document.getElementById('loginFormElement');
const signupFormElement = document.getElementById('signupFormElement');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const errorText = document.getElementById('errorText');
const successText = document.getElementById('successText');

// Show/Hide Forms
function showLogin() {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    hideMessages();
}

function showSignup() {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    hideMessages();
}

// Show/Hide Messages
function showLoading() {
    loadingSpinner.style.display = 'block';
    hideMessages();
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showError(message) {
    hideLoading();
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    successMessage.style.display = 'none';
}

function showSuccess(message) {
    hideLoading();
    successText.textContent = message;
    successMessage.style.display = 'flex';
    errorMessage.style.display = 'none';
}

function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// API Functions
async function makeAPIRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// Login Function
async function login(email, password) {
    showLoading();
    
    try {
        const data = await makeAPIRequest(`${API_BASE_URL}/api/users/login`, {
            method: 'POST',
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        if (data.status === 'success') {
            // Store user data and token
            localStorage.setItem('token', data.data.token);
            localStorage.setItem('user', JSON.stringify(data.data.user));
            
            showSuccess('Login successful! Redirecting to dashboard...');
            
            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            throw new Error(data.message || 'Login failed');
        }
    } catch (error) {
        showError(error.message || 'Login failed. Please try again.');
    }
}

// Signup Function
async function signup(firstName, lastName, email, password) {
    showLoading();
    
    try {
        const data = await makeAPIRequest(`${API_BASE_URL}/api/users/register`, {
            method: 'POST',
            body: JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                email: email,
                password: password
            })
        });

        if (data.status === 'success') {
            // Store user data and token
            localStorage.setItem('token', data.data.token);
            localStorage.setItem('user', JSON.stringify(data.data.user));
            
            showSuccess('Account created successfully! Redirecting to dashboard...');
            
            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            throw new Error(data.message || 'Signup failed');
        }
    } catch (error) {
        showError(error.message || 'Signup failed. Please try again.');
    }
}

// Form Event Listeners
loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    await login(email, password);
});

signupFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    
    if (!firstName || !lastName || !email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }
    
    await signup(firstName, lastName, email, password);
});

// Check if user is already logged in
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        // User is already logged in, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    
    // Show login form by default
    showLogin();
    
    // Add some demo data for testing
    if (window.location.search.includes('demo=true')) {
        document.getElementById('loginEmail').value = 'demo@example.com';
        document.getElementById('loginPassword').value = 'demo123';
    }
});

// Add input validation and better UX
document.querySelectorAll('input[type="email"]').forEach(input => {
    input.addEventListener('blur', function() {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (this.value && !emailRegex.test(this.value)) {
            this.style.borderColor = '#dc3545';
        } else {
            this.style.borderColor = '#e1e5e9';
        }
    });
});

document.querySelectorAll('input[type="password"]').forEach(input => {
    input.addEventListener('input', function() {
        if (this.value.length > 0 && this.value.length < 6) {
            this.style.borderColor = '#ffc107';
        } else if (this.value.length >= 6) {
            this.style.borderColor = '#28a745';
        } else {
            this.style.borderColor = '#e1e5e9';
        }
    });
});

// Add Enter key support for better UX
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const activeForm = loginForm.style.display !== 'none' ? loginFormElement : signupFormElement;
        const submitButton = activeForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.click();
        }
    }
});

// Add loading states to buttons
function setButtonLoading(button, loading = true) {
    if (loading) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait...';
    } else {
        button.disabled = false;
        // Restore original content based on form
        if (button.closest('#loginFormElement')) {
            button.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        } else {
            button.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        }
    }
}

// Update form submissions to show button loading
const originalLogin = login;
const originalSignup = signup;

login = async function(email, password) {
    const button = loginFormElement.querySelector('button[type="submit"]');
    setButtonLoading(button, true);
    
    try {
        await originalLogin(email, password);
    } finally {
        setButtonLoading(button, false);
    }
};

signup = async function(firstName, lastName, email, password) {
    const button = signupFormElement.querySelector('button[type="submit"]');
    setButtonLoading(button, true);
    
    try {
        await originalSignup(firstName, lastName, email, password);
    } finally {
        setButtonLoading(button, false);
    }
};
