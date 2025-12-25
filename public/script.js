// API Configuration
const API_URL = 'http://localhost:3000/api';

// Current User
let currentUser = null;

// ======================
// LOGIN & AUTHENTICATION
// ======================

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login error. Please try again.');
    }
});

function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').classList.add('active');
    
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userRole').textContent = currentUser.role.toUpperCase();
    
    // Show/hide elements based on role
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.user-only').forEach(el => el.classList.add('hidden'));
        document.getElementById('adminDashboard').classList.remove('hidden');
        loadAdminDashboard();
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.user-only').forEach(el => el.classList.remove('hidden'));
        document.getElementById('userDashboard').classList.remove('hidden');
        loadUserDashboard();
    }
    
    loadLeads();
}

function logout() {
    localStorage.removeItem('currentUser');
    location.reload();
}

// Check if user is already logged in
window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
    }
});

// ======================
// NAVIGATION
// ======================

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
    
    if (sectionId === 'leads') loadLeads();
    if (sectionId === 'finance') loadFinanceDetails();
    if (sectionId === 'payouts') loadPayouts();
    if (sectionId === 'expenses') loadExpenses();
    if (sectionId === 'users') loadUsers();
}

// ======================
// EXPORT FUNCTIONALITY
// ======================

function exportData(type) {
    const url = `${API_URL}/export/${type}?userId=${currentUser.id}&role=${currentUser.role}`;
    window.open(url, '_blank');
}

// ======================
// DASHBOARD
// ======================

async function loadAdminDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard/admin`);
        const data = await response.json();
        
        if (data.success) {
            const d = data.data;
            
            // Main cards
            document.getElementById('adminTotalLeads').textContent = d.totalLeads || 0;
            document.getElementById('adminTotalDisbursed').textContent = formatCurrency(d.totalDisbursed || 0);
            document.getElementById('adminTotalPayout').textContent = formatCurrency(d.totalPayout || 0);
            document.getElementById('adminPendingPayout').textContent = formatCurrency(d.pendingPayout || 0);
            document.getElementById('adminPendingCount').textContent = `${d.pendingCount || 0} cases`;
            
            // Monthly summary
            const latestMonth = Object.keys(d.totals).sort().reverse()[0];
            if (latestMonth && d.totals[latestMonth]) {
                const m = d.totals[latestMonth];
                document.getElementById('totalDisbursement').textContent = formatCurrency(m.disbursement || 0);
                document.getElementById('grossPayout').textContent = formatCurrency(m.gross || 0);
                document.getElementById('referralPaid').textContent = formatCurrency(m.referral || 0);
                document.getElementById('totalExpenses').textContent = formatCurrency(m.expenses || 0);
                const netProfit = (m.net || 0) - (m.expenses || 0);
                document.getElementById('netProfit').textContent = formatCurrency(netProfit);
            }
        }
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
    }
}

async function loadUserDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard/user/${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            const d = data.data;
            
            document.getElementById('userTotalLeads').textContent = d.totalLeads || 0;
            
            // Calculate this month's leads
            const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
            const thisMonthData = d.monthlyLeads.find(m => m.month === currentMonth);
            document.getElementById('userMonthLeads').textContent = thisMonthData ? thisMonthData.count : 0;
            
            // Status breakdown
            const draftData = d.statusBreakdown.find(s => s.status === 'Draft');
            const approvedData = d.statusBreakdown.find(s => s.status === 'Approved');
            document.getElementById('userDraftLeads').textContent = draftData ? draftData.count : 0;
            document.getElementById('userApprovedLeads').textContent = approvedData ? approvedData.count : 0;
            
            // Monthly table
            const tbody = document.getElementById('userMonthlyTable');
            tbody.innerHTML = d.monthlyLeads.map(m => `
                <tr>
                    <td>${m.month}</td>
                    <td>${m.count}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading user dashboard:', error);
    }
}

// ======================
// LEADS MANAGEMENT
// ======================

let editingLeadId = null;

document.getElementById('leadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = getLeadFormData();
    formData.created_by = currentUser.id;
    
    try {
        const url = editingLeadId ? `${API_URL}/leads/${editingLeadId}` : `${API_URL}/leads`;
        const method = editingLeadId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(editingLeadId ? 'Lead updated successfully' : 'Lead created successfully');
            document.getElementById('leadForm').reset();
            editingLeadId = null;
            showSection('leads');
            loadLeads();
        } else {
            alert(data.message || 'Error saving lead');
        }
    } catch (error) {
        console.error('Error saving lead:', error);
        alert('Error saving lead');
    }
});

function getLeadFormData() {
    return {
        lead_date: document.getElementById('leadDate').value,
        month: document.getElementById('month').value,
        loan_type: document.getElementById('loanType').value,
        sourcing: document.getElementById('sourcing').value,
        sourcing_name: document.getElementById('sourcingName').value,
        case_book_at: document.getElementById('caseBookAt').value,
        customer_name: document.getElementById('customerName').value,
        contact_no: document.getElementById('contactNo').value,
        address: document.getElementById('address').value,
        pin_code: document.getElementById('pinCode').value,
        district: document.getElementById('district').value,
        occupation: document.getElementById('occupation').value,
        co_applicants: JSON.stringify(getCoApplicants()),
        guarantors: JSON.stringify(getGuarantors()),
        references: getReferences(),
        msme_loan_amount: document.getElementById('msmeLoanAmount')?.value || null,
        msme_loan_end_use: document.getElementById('msmeLoanEndUse')?.value || null,
        msme_property_type: document.getElementById('msmePropertyType')?.value || null,
        vehicle_product: document.getElementById('vehicleProduct')?.value || null,
        vehicle_loan_type: document.getElementById('vehicleLoanType')?.value || null,
        vehicle_loan_amount: document.getElementById('vehicleLoanAmount')?.value || null,
        vehicle_loan_end_use: document.getElementById('vehicleLoanEndUse')?.value || null,
        vehicle_brand: document.getElementById('vehicleBrand')?.value || null,
        vehicle_model: document.getElementById('vehicleModel')?.value || null,
        model_year: document.getElementById('modelYear')?.value || null,
        vehicle_no: document.getElementById('vehicleNo')?.value || null,
        insurance_type: document.getElementById('insuranceType')?.value || null,
        insurance_end_date: document.getElementById('insuranceEndDate')?.value || null,
        pl_loan_amount: document.getElementById('plLoanAmount')?.value || null,
        pl_loan_end_use: document.getElementById('plLoanEndUse')?.value || null,
        status: 'Draft'
    };
}

function getCoApplicants() {
    const items = document.querySelectorAll('#coApplicants .dynamic-item');
    return Array.from(items).map(item => ({
        name: item.querySelector('.co-name').value,
        contact: item.querySelector('.co-contact').value,
        relation: item.querySelector('.co-relation').value
    })).filter(item => item.name);
}

function getGuarantors() {
    const items = document.querySelectorAll('#guarantors .dynamic-item');
    return Array.from(items).map(item => ({
        name: item.querySelector('.guar-name').value,
        contact: item.querySelector('.guar-contact').value,
        address: item.querySelector('.guar-address').value
    })).filter(item => item.name);
}

function getReferences() {
    const items = document.querySelectorAll('#references .dynamic-item');
    const refs = Array.from(items).map(item => ({
        name: item.querySelector('.ref-name').value,
        contact: item.querySelector('.ref-contact').value,
        address: item.querySelector('.ref-address').value
    })).filter(item => item.name);
    return JSON.stringify(refs);
}

async function loadLeads() {
    try {
        const response = await fetch(`${API_URL}/leads?userId=${currentUser.id}&role=${currentUser.role}`);
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.querySelector('#leads table tbody');
            tbody.innerHTML = data.data.map(lead => `
                <tr>
                    <td>${lead.lead_date}</td>
                    <td>${lead.customer_name}</td>
                    <td>${lead.contact_no}</td>
                    <td>${lead.loan_type}</td>
                    <td>${lead.sourcing}</td>
                    <td><span class="status-badge status-${lead.status.toLowerCase()}">${lead.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="viewLead(${lead.id})">View</button>
                        <button class="btn btn-sm btn-secondary" onclick="editLead(${lead.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteLead(${lead.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading leads:', error);
    }
}

async function viewLead(id) {
    // Implementation for viewing lead details
    alert('View lead functionality - Lead ID: ' + id);
}

async function editLead(id) {
    try {
        const response = await fetch(`${API_URL}/leads/${id}`);
        const data = await response.json();
        
        if (data.success) {
            editingLeadId = id;
            populateLeadForm(data.data);
            showSection('createLead');
        }
    } catch (error) {
        console.error('Error loading lead:', error);
    }
}

function populateLeadForm(lead) {
    document.getElementById('leadDate').value = lead.lead_date;
    document.getElementById('month').value = lead.month;
    document.getElementById('loanType').value = lead.loan_type;
    document.getElementById('sourcing').value = lead.sourcing;
    document.getElementById('sourcingName').value = lead.sourcing_name || '';
    document.getElementById('caseBookAt').value = lead.case_book_at;
    document.getElementById('customerName').value = lead.customer_name;
    document.getElementById('contactNo').value = lead.contact_no;
    document.getElementById('address').value = lead.address;
    document.getElementById('pinCode').value = lead.pin_code;
    document.getElementById('district').value = lead.district;
    document.getElementById('occupation').value = lead.occupation;
    
    // Trigger loan type change to show relevant fields
    document.getElementById('loanType').dispatchEvent(new Event('change'));
}

async function deleteLead(id) {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    try {
        const response = await fetch(`${API_URL}/leads/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            alert('Lead deleted successfully');
            loadLeads();
        }
    } catch (error) {
        console.error('Error deleting lead:', error);
    }
}

// ======================
// FINANCE DETAILS
// ======================

async function loadFinanceDetails() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') return;
    
    try {
        const response = await fetch(`${API_URL}/finance`);
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.querySelector('#finance table tbody');
            tbody.innerHTML = data.data.map(finance => `
                <tr>
                    <td>${finance.customer_name || 'N/A'}</td>
                    <td>${finance.loan_type || 'N/A'}</td>
                    <td>${formatCurrency(finance.disbursed_amount || 0)}</td>
                    <td>${finance.disbursement_date || 'N/A'}</td>
                    <td>${finance.tenure_months || 0} months</td>
                    <td>${formatCurrency(finance.emi_amount || 0)}</td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="viewFinance(${finance.id})">View</button>
                        <button class="btn btn-sm btn-secondary" onclick="editFinance(${finance.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteFinance(${finance.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading finance details:', error);
    }
}

// ======================
// PAYOUTS
// ======================

async function loadPayouts() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') return;
    
    try {
        const response = await fetch(`${API_URL}/payouts`);
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.querySelector('#payouts table tbody');
            tbody.innerHTML = data.data.map(payout => `
                <tr>
                    <td>${payout.customer_name || 'N/A'}</td>
                    <td>${payout.disbursement_month}</td>
                    <td>${formatCurrency(payout.gross_payout_amount || 0)}</td>
                    <td>${formatCurrency(payout.referral_dsa_paid || 0)}</td>
                    <td>${formatCurrency(payout.net_payout_received || 0)}</td>
                    <td><span class="status-badge status-${payout.payout_status.toLowerCase()}">${payout.payout_status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="viewPayout(${payout.id})">View</button>
                        <button class="btn btn-sm btn-secondary" onclick="editPayout(${payout.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deletePayout(${payout.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading payouts:', error);
    }
}

// ======================
// EXPENSES
// ======================

async function loadExpenses() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') return;
    
    try {
        const response = await fetch(`${API_URL}/expenses`);
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.querySelector('#expenses table tbody');
            tbody.innerHTML = data.data.map(expense => `
                <tr>
                    <td>${expense.expense_date}</td>
                    <td>${expense.category}</td>
                    <td>${expense.description}</td>
                    <td>${formatCurrency(expense.amount)}</td>
                    <td>${expense.payment_mode || 'N/A'}</td>
                    <td>${expense.created_by_name}</td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="viewExpense(${expense.id})">View</button>
                        <button class="btn btn-sm btn-secondary" onclick="editExpense(${expense.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteExpense(${expense.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

// ======================
// USER MANAGEMENT
// ======================

async function loadUsers() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') return;
    
    try {
        const response = await fetch(`${API_URL}/users`);
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.querySelector('#users table tbody');
            tbody.innerHTML = data.data.map(user => `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td><span class="status-badge">${user.role}</span></td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                    <td>
                        ${user.role !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">Delete</button>` : ''}
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const response = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            alert('User deleted successfully');
            loadUsers();
        }
    } catch (error) {
        console.error('Error deleting user:', error);
    }
}

// ======================
// UTILITY FUNCTIONS
// ======================

function formatCurrency(amount) {
    return '₹' + parseFloat(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Loan type change handler
document.getElementById('loanType')?.addEventListener('change', function() {
    const loanType = this.value;
    
    document.getElementById('loanDetailsSection').style.display = loanType ? 'block' : 'none';
    document.getElementById('msmeFields').style.display = loanType === 'MSME' ? 'block' : 'none';
    document.getElementById('vehicleFields').style.display = (loanType === 'Vehicle Loan' || loanType === 'Two Wheeler Loan') ? 'block' : 'none';
    document.getElementById('plFields').style.display = loanType === 'Personal Loan' ? 'block' : 'none';
});

// Sourcing change handler
document.getElementById('sourcing')?.addEventListener('change', function() {
    const sourcingNameField = document.getElementById('sourcingName');
    if (this.value === 'DSA' || this.value === 'Referral') {
        sourcingNameField.style.display = 'block';
        sourcingNameField.required = true;
    } else {
        sourcingNameField.style.display = 'none';
        sourcingNameField.required = false;
    }
});

// Dynamic list handlers
function addCoApplicant() {
    const container = document.getElementById('coApplicants');
    const item = document.createElement('div');
    item.className = 'dynamic-item';
    item.innerHTML = `
        <div class="form-group">
            <input type="text" placeholder="Co-Applicant Name *" class="co-name" required>
        </div>
        <div class="form-group">
            <input type="tel" placeholder="Contact No. *" class="co-contact" maxlength="10" required>
        </div>
        <div class="form-group">
            <input type="text" placeholder="Relation *" class="co-relation" required>
        </div>
        <div>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">Remove</button>
        </div>
    `;
    container.appendChild(item);
}

function addGuarantor() {
    const container = document.getElementById('guarantors');
    const item = document.createElement('div');
    item.className = 'dynamic-item';
    item.innerHTML = `
        <div class="form-group">
            <input type="text" placeholder="Guarantor Name *" class="guar-name" required>
        </div>
        <div class="form-group">
            <input type="tel" placeholder="Contact No. *" class="guar-contact" maxlength="10" required>
        </div>
        <div class="form-group">
            <input type="text" placeholder="Address *" class="guar-address" required>
        </div>
        <div>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">Remove</button>
        </div>
    `;
    container.appendChild(item);
}

// Set default month to current month
window.addEventListener('load', () => {
    const monthField = document.getElementById('month');
    if (monthField) {
        const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        monthField.value = currentMonth;
    }
});
