// Global variables
let currentUser = null;
let currentEditingId = null;
let currentEditingType = null;

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    setupFormCalculations();
    setupAutoMonth();
});

// Authentication functions
function checkAuth() {
    const loginSection = document.getElementById('loginSection');
    const mainApp = document.getElementById('mainApp');
    
    if (currentUser) {
        loginSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        document.getElementById('userName').textContent = currentUser.username;
        loadAllData();
        showDashboard();
    } else {
        loginSection.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
}

function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Navigation
    document.getElementById('dashboardBtn').addEventListener('click', () => showDashboard());
    document.getElementById('vehicleBtn').addEventListener('click', () => showSection('vehicleSection'));
    document.getElementById('msmeBtn').addEventListener('click', () => showSection('msmeSection'));
    document.getElementById('plBtn').addEventListener('click', () => showSection('plSection'));
    document.getElementById('payoutBtn').addEventListener('click', () => showSection('payoutSection'));
    document.getElementById('userManagementBtn').addEventListener('click', () => showSection('userManagementSection'));
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Form submissions
    document.getElementById('vehicleForm').addEventListener('submit', handleVehicleSubmit);
    document.getElementById('msmeForm').addEventListener('submit', handleMsmeSubmit);
    document.getElementById('plForm').addEventListener('submit', handlePlSubmit);
    document.getElementById('payoutForm').addEventListener('submit', handlePayoutSubmit);
    document.getElementById('createUserForm').addEventListener('submit', handleCreateUser);
    
    // Forgot password
    document.getElementById('forgotPasswordLink').addEventListener('click', showForgotPassword);
    document.getElementById('backToLogin').addEventListener('click', showLoginForm);
    document.getElementById('backToLogin2').addEventListener('click', showLoginForm);
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
}

function setupFormCalculations() {
    // Vehicle form calculations
    const vehicleForm = document.getElementById('vehicleForm');
    vehicleForm.addEventListener('input', function(e) {
        if (e.target.name === 'finance_amount' || e.target.name === 'charges' || 
            e.target.name === 'bt_amount' || e.target.name === 'extra_fund') {
            calculateVehicleTotals();
        }
    });

    // MSME form calculations
    const msmeForm = document.getElementById('msmeForm');
    msmeForm.addEventListener('input', function(e) {
        if (e.target.name === 'finance_amount' || e.target.name === 'charges' || 
            e.target.name === 'bt_amount' || e.target.name === 'extra_fund') {
            calculateMsmeTotals();
        }
    });

    // PL form calculations
    const plForm = document.getElementById('plForm');
    plForm.addEventListener('input', function(e) {
        if (e.target.name === 'loan_amount' || e.target.name === 'total_charges' || 
            e.target.name === 'bt_amount' || e.target.name === 'extra_fund') {
            calculatePlTotals();
        }
    });
}

function setupAutoMonth() {
    // Auto-populate month from date
    document.querySelectorAll('input[type="date"]').forEach(dateInput => {
        dateInput.addEventListener('change', function() {
            if (this.value) {
                const dateObj = new Date(this.value);
                const monthField = this.closest('form').querySelector('input[name="month"]');
                if (monthField) {
                    monthField.value = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
                }
            }
        });
    });
}

function calculateVehicleTotals() {
    const financeAmount = parseFloat(document.getElementById('vehicleFinanceAmount').value) || 0;
    const charges = parseFloat(document.getElementById('vehicleCharges').value) || 0;
    const btAmount = parseFloat(document.getElementById('vehicleBtAmount').value) || 0;
    const extraFund = parseFloat(document.getElementById('vehicleExtraFund').value) || 0;
    
    const totalDisbursal = financeAmount + charges + btAmount + extraFund;
    document.getElementById('vehicleTotalDisbursal').value = totalDisbursal.toFixed(2);
}

function calculateMsmeTotals() {
    const financeAmount = parseFloat(document.getElementById('msmeFinanceAmount').value) || 0;
    const charges = parseFloat(document.getElementById('msmeCharges').value) || 0;
    const btAmount = parseFloat(document.getElementById('msmeBtAmount').value) || 0;
    const extraFund = parseFloat(document.getElementById('msmeExtraFund').value) || 0;
    
    const netAmount = financeAmount - charges;
    const totalLoanAmount = netAmount + btAmount + extraFund;
    
    document.getElementById('msmeNetAmount').value = netAmount.toFixed(2);
    document.getElementById('msmeTotalLoanAmount').value = totalLoanAmount.toFixed(2);
}

function calculatePlTotals() {
    const loanAmount = parseFloat(document.getElementById('plLoanAmount').value) || 0;
    const totalCharges = parseFloat(document.getElementById('plTotalCharges').value) || 0;
    const btAmount = parseFloat(document.getElementById('plBtAmount').value) || 0;
    const extraFund = parseFloat(document.getElementById('plExtraFund').value) || 0;
    
    const netAmount = loanAmount - totalCharges;
    document.getElementById('plNetAmount').value = netAmount.toFixed(2);
}

// Authentication handlers
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        
        if (result.success) {
            currentUser = result.user;
            showNotification('Login successful!', 'success');
            checkAuth();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Login failed: ' + error.message, 'error');
    }
}

function handleLogout() {
    currentUser = null;
    showNotification('Logged out successfully', 'success');
    checkAuth();
}

function showForgotPassword() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('forgotPasswordForm').classList.remove('hidden');
}

function showLoginForm() {
    document.getElementById('forgotPasswordForm').classList.add('hidden');
    document.getElementById('resetPasswordForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;

    try {
        const response = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const result = await response.json();
        
        if (result.success) {
            document.getElementById('forgotPasswordForm').classList.add('hidden');
            document.getElementById('resetPasswordForm').classList.remove('hidden');
            document.getElementById('resetEmail').value = email;
            showNotification('OTP sent to your email', 'success');
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to send OTP: ' + error.message, 'error');
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;
    const otp = document.getElementById('otp').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    try {
        const response = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, newPassword })
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification('Password reset successfully', 'success');
            showLoginForm();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to reset password: ' + error.message, 'error');
    }
}

// Navigation functions
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show target section
    document.getElementById(sectionId).classList.remove('hidden');
    
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Load section-specific data
    switch(sectionId) {
        case 'vehicleSection':
            loadVehicleData();
            break;
        case 'msmeSection':
            loadMsmeData();
            break;
        case 'plSection':
            loadPlData();
            break;
        case 'payoutSection':
            loadPayoutData();
            break;
    }
}

function showDashboard() {
    showSection('dashboardSection');
    loadAnalytics();
}

// Data loading functions
async function loadAllData() {
    try {
        const response = await fetch('/api/all-data');
        const result = await response.json();
        
        if (result.success) {
            window.appData = result.data;
            updateDashboardSummary(result.data);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function loadVehicleData() {
    if (!window.appData) await loadAllData();
    displayVehicleData(window.appData.vehicle);
}

async function loadMsmeData() {
    if (!window.appData) await loadAllData();
    displayMsmeData(window.appData.msme);
}

async function loadPlData() {
    if (!window.appData) await loadAllData();
    displayPlData(window.appData.pl);
}

async function loadPayoutData() {
    if (!window.appData) await loadAllData();
    displayPayoutData(window.appData.payout);
}

// Form handlers
async function handleVehicleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Convert number fields
    const numberFields = ['irr', 'finance_amount', 'rc_limit_amount', 'charges', 'bt_amount', 
                         'release_amount', 'deferral_release_amount', 'rto_release_amount', 
                         'insurance_amount', 'total_disbursal', 'extra_fund', 'emi_amount', 'tenure'];
    numberFields.forEach(field => {
        if (data[field]) data[field] = parseFloat(data[field]);
    });

    // Handle co-applicants
    data.co_applicants = [];
    let index = 0;
    while (data[`co_applicant_name_${index}`]) {
        if (data[`co_applicant_name_${index}`].trim() !== '') {
            data.co_applicants.push({
                name: data[`co_applicant_name_${index}`],
                relationship: data[`co_applicant_relationship_${index}`]
            });
        }
        delete data[`co_applicant_name_${index}`];
        delete data[`co_applicant_relationship_${index}`];
        index++;
    }

    try {
        const url = currentEditingId ? `/api/vehicle-cases/${currentEditingId}` : '/api/vehicle-cases';
        const method = currentEditingId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification(currentEditingId ? 'Vehicle case updated successfully!' : 'Vehicle case saved successfully!', 'success');
            e.target.reset();
            currentEditingId = null;
            currentEditingType = null;
            document.getElementById('vehicleFormTitle').textContent = 'Add Vehicle Loan Case';
            await loadAllData();
            loadVehicleData();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Error saving vehicle case: ' + error.message, 'error');
    }
}

async function handleMsmeSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Convert number fields
    const numberFields = ['irr', 'finance_amount', 'charges', 'bt_amount', 'net_amount', 
                         'extra_fund', 'total_loan_amount', 'emi_amount', 'tenure'];
    numberFields.forEach(field => {
        if (data[field]) data[field] = parseFloat(data[field]);
    });

    // Handle co-applicants
    data.co_applicants = [];
    let index = 0;
    while (data[`co_applicant_name_${index}`]) {
        if (data[`co_applicant_name_${index}`].trim() !== '') {
            data.co_applicants.push({
                name: data[`co_applicant_name_${index}`],
                relationship: data[`co_applicant_relationship_${index}`]
            });
        }
        delete data[`co_applicant_name_${index}`];
        delete data[`co_applicant_relationship_${index}`];
        index++;
    }

    try {
        const url = currentEditingId ? `/api/msme-cases/${currentEditingId}` : '/api/msme-cases';
        const method = currentEditingId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification(currentEditingId ? 'MSME case updated successfully!' : 'MSME case saved successfully!', 'success');
            e.target.reset();
            currentEditingId = null;
            currentEditingType = null;
            document.getElementById('msmeFormTitle').textContent = 'Add MSME Loan Case';
            await loadAllData();
            loadMsmeData();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Error saving MSME case: ' + error.message, 'error');
    }
}

async function handlePlSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Convert number fields
    const numberFields = ['roi', 'loan_amount', 'total_charges', 'bt_amount', 'extra_fund', 
                         'tenure_months', 'emi_amount'];
    numberFields.forEach(field => {
        if (data[field]) data[field] = parseFloat(data[field]);
    });

    // Handle co-applicants
    data.co_applicants = [];
    let index = 0;
    while (data[`co_applicant_name_${index}`]) {
        if (data[`co_applicant_name_${index}`].trim() !== '') {
            data.co_applicants.push({
                name: data[`co_applicant_name_${index}`],
                relationship: data[`co_applicant_relationship_${index}`]
            });
        }
        delete data[`co_applicant_name_${index}`];
        delete data[`co_applicant_relationship_${index}`];
        index++;
    }

    try {
        const url = currentEditingId ? `/api/pl-cases/${currentEditingId}` : '/api/pl-cases';
        const method = currentEditingId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification(currentEditingId ? 'PL case updated successfully!' : 'PL case saved successfully!', 'success');
            e.target.reset();
            currentEditingId = null;
            currentEditingType = null;
            document.getElementById('plFormTitle').textContent = 'Add Personal Loan Case';
            await loadAllData();
            loadPlData();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Error saving PL case: ' + error.message, 'error');
    }
}

async function handlePayoutSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Convert number fields
    const numberFields = ['finance_amount', 'irr', 'payout_percent', 'payout_amount', 
                         'gst', 'tds', 'net_amount_received', 'net_payout'];
    numberFields.forEach(field => {
        if (data[field]) data[field] = parseFloat(data[field]);
    });

    try {
        const response = await fetch('/api/payouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification('Payout saved successfully!', 'success');
            e.target.reset();
            await loadAllData();
            loadPayoutData();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Error saving payout: ' + error.message, 'error');
    }
}

async function handleCreateUser(e) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'super_admin') {
        showNotification('Unauthorized', 'error');
        return;
    }

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        const response = await fetch('/api/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification('User created successfully!', 'success');
            e.target.reset();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Error creating user: ' + error.message, 'error');
    }
}

// Edit functions
async function editVehicleCase(id) {
    try {
        const response = await fetch(`/api/vehicle-cases/${id}`);
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            const form = document.getElementById('vehicleForm');
            
            // Fill form with data
            Object.keys(data).forEach(key => {
                if (form.elements[key] && key !== 'co_applicants') {
                    form.elements[key].value = data[key] || '';
                }
            });
            
            // Handle co-applicants
            const coApplicantsContainer = document.getElementById('vehicleCoApplicants');
            coApplicantsContainer.innerHTML = '';
            
            if (data.co_applicants && data.co_applicants.length > 0) {
                data.co_applicants.forEach((applicant, index) => {
                    addCoApplicantField('vehicle', index, applicant.name, applicant.relationship);
                });
            }
            
            // Set editing state
            currentEditingId = id;
            currentEditingType = 'vehicle';
            document.getElementById('vehicleFormTitle').textContent = 'Edit Vehicle Loan Case';
            
            // Show vehicle section and scroll to form
            showSection('vehicleSection');
            form.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        showNotification('Error loading vehicle case: ' + error.message, 'error');
    }
}

async function editMsmeCase(id) {
    try {
        const response = await fetch(`/api/msme-cases/${id}`);
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            const form = document.getElementById('msmeForm');
            
            // Fill form with data
            Object.keys(data).forEach(key => {
                if (form.elements[key] && key !== 'co_applicants') {
                    form.elements[key].value = data[key] || '';
                }
            });
            
            // Handle co-applicants
            const coApplicantsContainer = document.getElementById('msmeCoApplicants');
            coApplicantsContainer.innerHTML = '';
            
            if (data.co_applicants && data.co_applicants.length > 0) {
                data.co_applicants.forEach((applicant, index) => {
                    addCoApplicantField('msme', index, applicant.name, applicant.relationship);
                });
            }
            
            // Set editing state
            currentEditingId = id;
            currentEditingType = 'msme';
            document.getElementById('msmeFormTitle').textContent = 'Edit MSME Loan Case';
            
            // Show msme section and scroll to form
            showSection('msmeSection');
            form.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        showNotification('Error loading MSME case: ' + error.message, 'error');
    }
}

async function editPlCase(id) {
    try {
        const response = await fetch(`/api/pl-cases/${id}`);
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            const form = document.getElementById('plForm');
            
            // Fill form with data
            Object.keys(data).forEach(key => {
                if (form.elements[key] && key !== 'co_applicants') {
                    form.elements[key].value = data[key] || '';
                }
            });
            
            // Handle co-applicants
            const coApplicantsContainer = document.getElementById('plCoApplicants');
            coApplicantsContainer.innerHTML = '';
            
            if (data.co_applicants && data.co_applicants.length > 0) {
                data.co_applicants.forEach((applicant, index) => {
                    addCoApplicantField('pl', index, applicant.name, applicant.relationship);
                });
            }
            
            // Set editing state
            currentEditingId = id;
            currentEditingType = 'pl';
            document.getElementById('plFormTitle').textContent = 'Edit Personal Loan Case';
            
            // Show pl section and scroll to form
            showSection('plSection');
            form.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        showNotification('Error loading PL case: ' + error.message, 'error');
    }
}

// Co-applicant functions
function addCoApplicantField(formType, index, name = '', relationship = '') {
    const container = document.getElementById(`${formType}CoApplicants`);
    const div = document.createElement('div');
    div.className = 'co-applicant-field';
    div.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label>Co-applicant Name</label>
                <input type="text" name="co_applicant_name_${index}" value="${name}" required>
            </div>
            <div class="form-group">
                <label>Relationship</label>
                <input type="text" name="co_applicant_relationship_${index}" value="${relationship}" required>
            </div>
            <button type="button" class="btn-danger" onclick="removeCoApplicantField(this)">Remove</button>
        </div>
    `;
    container.appendChild(div);
}

function removeCoApplicantField(button) {
    button.closest('.co-applicant-field').remove();
}

function addNewCoApplicant(formType) {
    const container = document.getElementById(`${formType}CoApplicants`);
    const index = container.children.length;
    addCoApplicantField(formType, index);
}

// Data display functions
function displayVehicleData(data) {
    const tbody = document.getElementById('vehicleTableBody');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.date || ''}</td>
            <td>${item.customer_name || ''}</td>
            <td>${item.mobile || ''}</td>
            <td>${item.vehicle_no || ''}</td>
            <td>${item.finance_amount || 0}</td>
            <td>${item.status || ''}</td>
            <td>
                <button class="btn-edit" onclick="editVehicleCase(${item.id})">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function displayMsmeData(data) {
    const tbody = document.getElementById('msmeTableBody');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.date || ''}</td>
            <td>${item.customer_name || ''}</td>
            <td>${item.mobile || ''}</td>
            <td>${item.property_type || ''}</td>
            <td>${item.finance_amount || 0}</td>
            <td>${item.status || ''}</td>
            <td>
                <button class="btn-edit" onclick="editMsmeCase(${item.id})">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function displayPlData(data) {
    const tbody = document.getElementById('plTableBody');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.date || ''}</td>
            <td>${item.customer_name || ''}</td>
            <td>${item.contact_no || ''}</td>
            <td>${item.loan_amount || 0}</td>
            <td>${item.status || ''}</td>
            <td>
                <button class="btn-edit" onclick="editPlCase(${item.id})">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function displayPayoutData(data) {
    const tbody = document.getElementById('payoutTableBody');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.payout_date || ''}</td>
            <td>${item.customer_name || ''}</td>
            <td>${item.product || ''}</td>
            <td>${item.finance_amount || 0}</td>
            <td>${item.payout_amount || 0}</td>
            <td>${item.payout_status || ''}</td>
        `;
        tbody.appendChild(row);
    });
}

// Analytics functions
async function loadAnalytics() {
    try {
        const response = await fetch('/api/analytics');
        const result = await response.json();
        
        if (result.success) {
            updateCharts(result.data);
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function updateDashboardSummary(data) {
    const totalCases = data.vehicle.length + data.msme.length + data.pl.length;
    const totalAmount = data.vehicle.reduce((sum, item) => sum + (item.finance_amount || 0), 0) +
                       data.msme.reduce((sum, item) => sum + (item.finance_amount || 0), 0) +
                       data.pl.reduce((sum, item) => sum + (item.loan_amount || 0), 0);
    
    const disbursedCases = data.vehicle.filter(item => item.status === 'Disbursed').length +
                          data.msme.filter(item => item.status === 'Disbursed').length +
                          data.pl.filter(item => item.status === 'Disbursed').length;

    document.getElementById('totalCases').textContent = totalCases;
    document.getElementById('totalAmount').textContent = '₹' + totalAmount.toLocaleString();
    document.getElementById('disbursedCases').textContent = disbursedCases;
    document.getElementById('pendingCases').textContent = totalCases - disbursedCases;
}

function updateCharts(analyticsData) {
    console.log('Analytics data:', analyticsData);
}

// Export functions
async function exportData(type) {
    try {
        const response = await fetch(`/api/export/${type}`);
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            const csv = convertToCSV(data);
            downloadCSV(csv, `${type}_export_${new Date().toISOString().split('T')[0]}.csv`);
            showNotification('Data exported successfully!', 'success');
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Error exporting data: ' + error.message, 'error');
    }
}

function convertToCSV(data) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + row[header]).replace(/"/g, '\\"');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Utility functions
function showNotification(message, type) {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Make functions globally available
window.editVehicleCase = editVehicleCase;
window.editMsmeCase = editMsmeCase;
window.editPlCase = editPlCase;
window.addNewCoApplicant = addNewCoApplicant;
window.removeCoApplicantField = removeCoApplicantField;
window.exportData = exportData;
