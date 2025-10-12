// Global variables
let currentUser = null;
let currentEditingId = null;
let currentEditingType = null;
let appData = {
    vehicle: [],
    msme: [],
    pl: [],
    payout: []
};

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    setupFormCalculations();
    setupAutoMonth();
    setupMobileValidation();
});

// Authentication functions
function checkAuth() {
    const loginSection = document.getElementById('loginSection');
    const mainApp = document.getElementById('mainApp');
    
    if (currentUser) {
        loginSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        document.getElementById('userName').textContent = currentUser.username;
        document.getElementById('userRole').textContent = currentUser.role;
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
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Form submissions
    document.getElementById('vehicleForm').addEventListener('submit', handleVehicleSubmit);
    document.getElementById('msmeForm').addEventListener('submit', handleMsmeSubmit);
    document.getElementById('plForm').addEventListener('submit', handlePlSubmit);
    
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

function setupMobileValidation() {
    // Real-time mobile number validation
    document.addEventListener('input', function(e) {
        if (e.target.type === 'tel' || e.target.name?.includes('mobile') || e.target.name?.includes('contact')) {
            const input = e.target;
            const value = input.value.replace(/\D/g, '');
            
            if (value.length > 10) {
                input.value = value.slice(0, 10);
            }
            
            // Real-time validation feedback
            if (value.length === 10 && !validateMobileNumber(value)) {
                input.style.borderColor = '#dc3545';
                showFieldError(input, 'Mobile number must start with 6, 7, 8, or 9');
            } else {
                input.style.borderColor = value.length === 10 ? '#28a745' : '#ccc';
                clearFieldError(input);
            }
        }
    });
}

function validateMobileNumber(mobile) {
    const regex = /^[6-9]\d{9}$/;
    return regex.test(mobile);
}

function showFieldError(input, message) {
    clearFieldError(input);
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    errorMsg.textContent = message;
    input.parentNode.appendChild(errorMsg);
}

function clearFieldError(input) {
    const errorMsg = input.parentNode.querySelector('.error-message');
    if (errorMsg) {
        errorMsg.remove();
    }
}

// Vehicle Loan Calculations
function calculateVehicleEMI() {
    const financeAmount = parseFloat(document.getElementById('vehicleFinanceAmount').value) || 0;
    const irr = parseFloat(document.getElementById('vehicleIrr').value) || 0;
    const tenure = parseInt(document.getElementById('vehicleTenure').value) || 0;
    
    if (financeAmount > 0 && irr > 0 && tenure > 0) {
        const monthlyRate = irr / 100 / 12;
        const emi = financeAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1);
        document.getElementById('vehicleEmiAmount').value = emi.toFixed(2);
    } else {
        document.getElementById('vehicleEmiAmount').value = '';
    }
    
    calculateVehicleTotals();
}

function calculateVehicleTotals() {
    const financeAmount = parseFloat(document.getElementById('vehicleFinanceAmount').value) || 0;
    
    // Hold amounts (subtract from total)
    const rcLimitAmount = parseFloat(document.getElementById('vehicleRcLimitAmount').value) || 0;
    const charges = parseFloat(document.getElementById('vehicleCharges').value) || 0;
    const rtoHold = parseFloat(document.getElementById('vehicleRtoHold').value) || 0;
    const btAmount = parseFloat(document.getElementById('vehicleBtAmount').value) || 0;
    const deferralHoldCompany = parseFloat(document.getElementById('vehicleDeferralHoldCompany').value) || 0;
    const deferralHoldOurSide = parseFloat(document.getElementById('vehicleDeferralHoldOurSide').value) || 0;
    const insuranceAmount = parseFloat(document.getElementById('vehicleInsuranceAmount').value) || 0;
    
    // Release amounts (add to total)
    const extraFund = parseFloat(document.getElementById('vehicleExtraFund').value) || 0;
    const deferralReleaseAmount = parseFloat(document.getElementById('vehicleDeferralReleaseAmount').value) || 0;
    const rtoReleaseAmount = parseFloat(document.getElementById('vehicleRtoReleaseAmount').value) || 0;
    
    // Calculate total disbursal
    const totalDisbursal = financeAmount + charges + btAmount + extraFund;
    document.getElementById('vehicleTotalDisbursal').value = totalDisbursal.toFixed(2);
    
    // Calculate net release amount
    const totalHolds = rcLimitAmount + rtoHold + deferralHoldCompany + deferralHoldOurSide + insuranceAmount;
    const totalReleases = deferralReleaseAmount + rtoReleaseAmount;
    const netReleaseAmount = financeAmount - totalHolds + totalReleases;
    document.getElementById('vehicleNetReleaseAmount').value = netReleaseAmount.toFixed(2);
}

// Update the existing setupFormCalculations function
function setupFormCalculations() {
    // Vehicle form calculations
    const vehicleForm = document.getElementById('vehicleForm');
    vehicleForm.addEventListener('input', function(e) {
        if (e.target.name === 'finance_amount' || e.target.name === 'irr' || e.target.name === 'tenure' ||
            e.target.name === 'rc_limit_amount' || e.target.name === 'charges' || e.target.name === 'rto_hold' ||
            e.target.name === 'bt_amount' || e.target.name === 'deferral_hold_company' || 
            e.target.name === 'deferral_hold_our_side' || e.target.name === 'insurance_amount' ||
            e.target.name === 'extra_fund' || e.target.name === 'deferral_release_amount' ||
            e.target.name === 'rto_release_amount') {
            calculateVehicleTotals();
        }
    });
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
    
    // Find and activate the correct nav button
    const activeBtn = document.querySelector(`[onclick*="${sectionId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
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
    updateDashboardSummary();
}

// Data loading functions
async function loadAllData() {
    try {
        const response = await fetch('/api/all-data');
        const result = await response.json();
        
        if (result.success) {
            appData = result.data;
            updateDashboardSummary();
        } else {
            showNotification('Failed to load data', 'error');
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Error loading data: ' + error.message, 'error');
    }
}

async function loadVehicleData() {
    if (!appData.vehicle) await loadAllData();
    displayVehicleData(appData.vehicle);
}

async function loadMsmeData() {
    if (!appData.msme) await loadAllData();
    displayMsmeData(appData.msme);
}

async function loadPlData() {
    if (!appData.pl) await loadAllData();
    displayPlData(appData.pl);
}

async function loadPayoutData() {
    if (!appData.payout) await loadAllData();
    displayPayoutData(appData.payout);
}

// Form handlers
async function handleVehicleSubmit(e) {
    e.preventDefault();
    
    // Validate mobile number
    const mobileInput = document.getElementById('vehicleMobile');
    if (!validateMobileNumber(mobileInput.value)) {
        showNotification('Please enter a valid 10-digit mobile number starting with 6-9', 'error');
        return;
    }
    
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
            resetEditState();
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
    
    // Validate mobile number
    const mobileInput = document.getElementById('msmeMobile');
    if (!validateMobileNumber(mobileInput.value)) {
        showNotification('Please enter a valid 10-digit mobile number starting with 6-9', 'error');
        return;
    }
    
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
            resetEditState();
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
    
    // Validate contact number
    const contactInput = document.getElementById('plContactNo');
    if (!validateMobileNumber(contactInput.value)) {
        showNotification('Please enter a valid 10-digit contact number starting with 6-9', 'error');
        return;
    }
    
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
            resetEditState();
            await loadAllData();
            loadPlData();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Error saving PL case: ' + error.message, 'error');
    }
}

// Edit functions
async function editVehicleCase(id) {
    try {
        const response = await fetch(`/api/vehicle-cases/${id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch case data');
        }
        
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
        document.getElementById('cancelEditBtn').style.display = 'block';
        
        // Show vehicle section and scroll to form
        showSection('vehicleSection');
        form.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error editing vehicle case:', error);
        showNotification('Error loading vehicle case: ' + error.message, 'error');
    }
}

async function editMsmeCase(id) {
    try {
        const response = await fetch(`/api/msme-cases/${id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch case data');
        }
        
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
        document.getElementById('cancelEditBtnMsme').style.display = 'block';
        
        // Show msme section and scroll to form
        showSection('msmeSection');
        form.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error editing MSME case:', error);
        showNotification('Error loading MSME case: ' + error.message, 'error');
    }
}

async function editPlCase(id) {
    try {
        const response = await fetch(`/api/pl-cases/${id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch case data');
        }
        
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
        document.getElementById('cancelEditBtnPl').style.display = 'block';
        
        // Show pl section and scroll to form
        showSection('plSection');
        form.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error editing PL case:', error);
        showNotification('Error loading PL case: ' + error.message, 'error');
    }
}

async function editPayout(id) {
    try {
        const response = await fetch(`/api/payouts/${id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch payout data');
        }
        
        // For now, just show a message since we don't have a payout form
        showNotification('Payout edit functionality coming soon!', 'info');
        
    } catch (error) {
        console.error('Error editing payout:', error);
        showNotification('Error loading payout data: ' + error.message, 'error');
    }
}

// Process Payout Function
async function processPayout(id) {
    try {
        if (!confirm('Are you sure you want to process this payout?')) {
            return;
        }
        
        const response = await fetch(`/api/process-payout/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to process payout');
        }
        
        showNotification('Payout processed successfully!', 'success');
        loadAllData(); // Refresh data
        
    } catch (error) {
        console.error('Error processing payout:', error);
        showNotification('Error processing payout: ' + error.message, 'error');
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

function resetEditState() {
    currentEditingId = null;
    currentEditingType = null;
    document.getElementById('vehicleFormTitle').textContent = 'Add Vehicle Loan Case';
    document.getElementById('msmeFormTitle').textContent = 'Add MSME Loan Case';
    document.getElementById('plFormTitle').textContent = 'Add Personal Loan Case';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('cancelEditBtnMsme').style.display = 'none';
    document.getElementById('cancelEditBtnPl').style.display = 'none';
}

function cancelEdit() {
    const form = document.getElementById(`${currentEditingType}Form`);
    if (form) {
        form.reset();
    }
    resetEditState();
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
            <td>₹${(item.finance_amount || 0).toLocaleString()}</td>
            <td><span class="status-${item.status?.toLowerCase()}">${item.status || ''}</span></td>
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
            <td>₹${(item.finance_amount || 0).toLocaleString()}</td>
            <td><span class="status-${item.status?.toLowerCase()}">${item.status || ''}</span></td>
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
            <td>₹${(item.loan_amount || 0).toLocaleString()}</td>
            <td><span class="status-${item.status?.toLowerCase()}">${item.status || ''}</span></td>
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
            <td>₹${(item.finance_amount || 0).toLocaleString()}</td>
            <td>₹${(item.payout_amount || 0).toLocaleString()}</td>
            <td><span class="status-${item.payout_status?.toLowerCase()}">${item.payout_status || ''}</span></td>
            <td>
                ${item.payout_status === 'Pending' ? 
                    `<button class="btn-process" onclick="processPayout(${item.id})">Process</button>` : 
                    `<button class="btn-edit" onclick="editPayout(${item.id})">Edit</button>`
                }
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Dashboard functions
function updateDashboardSummary() {
    const totalCases = appData.vehicle.length + appData.msme.length + appData.pl.length;
    const totalAmount = appData.vehicle.reduce((sum, item) => sum + (item.finance_amount || 0), 0) +
                       appData.msme.reduce((sum, item) => sum + (item.finance_amount || 0), 0) +
                       appData.pl.reduce((sum, item) => sum + (item.loan_amount || 0), 0);
    
    const disbursedCases = appData.vehicle.filter(item => item.status === 'Disbursed').length +
                          appData.msme.filter(item => item.status === 'Disbursed').length +
                          appData.pl.filter(item => item.status === 'Disbursed').length;

    document.getElementById('totalCases').textContent = totalCases;
    document.getElementById('totalAmount').textContent = '₹' + totalAmount.toLocaleString();
    document.getElementById('disbursedCases').textContent = disbursedCases;
    document.getElementById('pendingCases').textContent = totalCases - disbursedCases;
}

function refreshDashboard() {
    loadAllData();
    showNotification('Dashboard refreshed!', 'success');
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

async function exportAllData() {
    await exportData('vehicle');
    await exportData('msme');
    await exportData('pl');
    await exportData('payout');
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

// Search functions (basic implementation)
function searchVehicleCases() {
    const searchTerm = document.getElementById('vehicleSearch').value.toLowerCase();
    const filteredData = appData.vehicle.filter(item => 
        (item.customer_name && item.customer_name.toLowerCase().includes(searchTerm)) ||
        (item.mobile && item.mobile.includes(searchTerm)) ||
        (item.vehicle_no && item.vehicle_no.toLowerCase().includes(searchTerm))
    );
    displayVehicleData(filteredData);
}

function searchMsmeCases() {
    const searchTerm = document.getElementById('msmeSearch').value.toLowerCase();
    const filteredData = appData.msme.filter(item => 
        (item.customer_name && item.customer_name.toLowerCase().includes(searchTerm)) ||
        (item.mobile && item.mobile.includes(searchTerm)) ||
        (item.property_type && item.property_type.toLowerCase().includes(searchTerm))
    );
    displayMsmeData(filteredData);
}

function searchPlCases() {
    const searchTerm = document.getElementById('plSearch').value.toLowerCase();
    const filteredData = appData.pl.filter(item => 
        (item.customer_name && item.customer_name.toLowerCase().includes(searchTerm)) ||
        (item.contact_no && item.contact_no.includes(searchTerm))
    );
    displayPlData(filteredData);
}

function searchPayouts() {
    const searchTerm = document.getElementById('payoutSearch').value.toLowerCase();
    const filteredData = appData.payout.filter(item => 
        (item.customer_name && item.customer_name.toLowerCase().includes(searchTerm)) ||
        (item.product && item.product.toLowerCase().includes(searchTerm))
    );
    displayPayoutData(filteredData);
}

// Utility functions
function showNotification(message, type) {
    // Remove existing notifications
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

function clearVehicleForm() {
    document.getElementById('vehicleForm').reset();
    document.getElementById('vehicleCoApplicants').innerHTML = '';
    resetEditState();
}

function clearMsmeForm() {
    document.getElementById('msmeForm').reset();
    document.getElementById('msmeCoApplicants').innerHTML = '';
    resetEditState();
}

function clearPlForm() {
    document.getElementById('plForm').reset();
    document.getElementById('plCoApplicants').innerHTML = '';
    resetEditState();
}

// Make functions globally available
window.editVehicleCase = editVehicleCase;
window.editMsmeCase = editMsmeCase;
window.editPlCase = editPlCase;
window.editPayout = editPayout;
window.processPayout = processPayout;
window.addNewCoApplicant = addNewCoApplicant;
window.removeCoApplicantField = removeCoApplicantField;
window.exportData = exportData;
window.exportAllData = exportAllData;
window.refreshDashboard = refreshDashboard;
window.showSection = showSection;
window.cancelEdit = cancelEdit;
window.clearVehicleForm = clearVehicleForm;
window.clearMsmeForm = clearMsmeForm;
window.clearPlForm = clearPlForm;
window.searchVehicleCases = searchVehicleCases;
window.searchMsmeCases = searchMsmeCases;
window.searchPlCases = searchPlCases;
window.searchPayouts = searchPayouts;
