const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Ensure data directory exists for persistent storage
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Database setup with persistent storage
const dbPath = path.join(dataDir, 'dsa_loan.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

let currentUser = null;

function initializeDatabase() {
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
        console.log('✅ Users table ready');
        
        // Insert default users
        const defaultUsers = [
            ['admin', 'admin123', 'super_admin'],
            ['Kishor', 'Jaipur@2025', 'admin'],
            ['loan_user', 'Loan@2025', 'loan_only'],
            ['edit_user', 'Edit@2025', 'edit_delete'],
            ['view_user', 'View@2025', 'view_only']
        ];

        defaultUsers.forEach(user => {
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`, user, (err) => {
                if (err) console.log('User exists:', user[0]);
            });
        });
    });

    // Enhanced Vehicle Cases table
    db.run(`CREATE TABLE IF NOT EXISTS vehicle_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        month TEXT,
        product TEXT,
        case_book_at TEXT,
        customer_name TEXT,
        address TEXT,
        applicant_occupation TEXT,
        vehicle_end_used TEXT,
        mobile TEXT,
        vehicle_no TEXT,
        model_year TEXT,
        vehicle_model TEXT,
        irr REAL,
        finance_amount REAL,
        status TEXT,
        disbursement_date TEXT,
        sourcing TEXT,
        rc_limit_amount REAL,
        charges REAL,
        rto_hold TEXT,
        bt_amount REAL,
        deferral_hold_company TEXT,
        deferral_hold_our_side TEXT,
        release_amount REAL,
        deferral_release_amount REAL,
        rto_release_amount REAL,
        insurance_amount REAL,
        total_disbursal REAL,
        extra_fund REAL,
        rto_released_name TEXT,
        insurance_type TEXT,
        insurance_end_date TEXT,
        pdd_rc TEXT,
        emi_amount REAL,
        tenure INTEGER,
        co_applicants TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Enhanced Vehicle cases table ready'));

    // Enhanced MSME Cases table
    db.run(`CREATE TABLE IF NOT EXISTS msme_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        month TEXT,
        product TEXT,
        case_book_at TEXT,
        customer_name TEXT,
        address TEXT,
        applicant_occupation TEXT,
        loan_end_used TEXT,
        mobile TEXT,
        property_type TEXT,
        irr REAL,
        finance_amount REAL,
        status TEXT,
        disbursement_date TEXT,
        sourcing TEXT,
        charges REAL,
        bt_amount REAL,
        net_amount REAL,
        extra_fund REAL,
        total_loan_amount REAL,
        emi_amount REAL,
        tenure INTEGER,
        co_applicants TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Enhanced MSME cases table ready'));

    // Enhanced PL Cases table
    db.run(`CREATE TABLE IF NOT EXISTS pl_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        month TEXT,
        case_book_at TEXT,
        customer_name TEXT,
        address TEXT,
        applicant_occupation TEXT,
        loan_end_used TEXT,
        contact_no TEXT,
        roi REAL,
        loan_amount REAL,
        status TEXT,
        disbursed_date TEXT,
        sourcing_from TEXT,
        total_charges REAL,
        bt_amount REAL,
        extra_fund REAL,
        tenure_months INTEGER,
        emi_amount REAL,
        co_applicants TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Enhanced PL cases table ready'));

    // Enhanced Payouts table
    db.run(`CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        month TEXT,
        product TEXT,
        case_book_at TEXT,
        customer_name TEXT,
        address TEXT,
        applicant_occupation TEXT,
        loan_end_used TEXT,
        mobile TEXT,
        property_type TEXT,
        irr REAL,
        finance_amount REAL,
        status TEXT,
        disbursement_date TEXT,
        sourcing TEXT,
        charges REAL,
        bt_amount REAL,
        net_amount REAL,
        extra_fund REAL,
        total_loan_amount REAL,
        emi_amount REAL,
        tenure INTEGER,
        payout_status TEXT,
        case_type TEXT,
        case_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Enhanced Payouts table ready'));
}

// Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('Login attempt:', username);
    
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, 
    [username, password], (err, row) => {
        if (err) {
            console.log('Database error:', err);
            res.json({ success: false, message: 'Database error' });
        } else if (row) {
            console.log('Login successful for:', username);
            currentUser = row;
            res.json({ 
                success: true, 
                user: {
                    username: row.username,
                    role: row.role
                }
            });
        } else {
            console.log('Invalid login for:', username);
            res.json({ success: false, message: 'Invalid username or password' });
        }
    });
});

// Get all enhanced data
app.get('/api/all-data', (req, res) => {
    Promise.all([
        new Promise((resolve) => db.all('SELECT * FROM vehicle_cases', (err, rows) => resolve(rows || []))),
        new Promise((resolve) => db.all('SELECT * FROM msme_cases', (err, rows) => resolve(rows || []))),
        new Promise((resolve) => db.all('SELECT * FROM pl_cases', (err, rows) => resolve(rows || []))),
        new Promise((resolve) => db.all('SELECT * FROM payouts', (err, rows) => resolve(rows || [])))
    ]).then(([vehicle, msme, pl, payout]) => {
        res.json({
            success: true,
            data: {
                vehicle: vehicle,
                msme: msme,
                pl: pl,
                payout: payout
            }
        });
    }).catch(err => {
        res.json({ success: false, message: err.message });
    });
});

// Enhanced Vehicle Cases API
app.post('/api/vehicle-cases', (req, res) => {
    const data = req.body;
    const query = `INSERT INTO vehicle_cases (
        date, month, product, case_book_at, customer_name, address, applicant_occupation, 
        vehicle_end_used, mobile, vehicle_no, model_year, vehicle_model, irr, finance_amount, 
        status, disbursement_date, sourcing, rc_limit_amount, charges, rto_hold, bt_amount, 
        deferral_hold_company, deferral_hold_our_side, release_amount, deferral_release_amount, 
        rto_release_amount, insurance_amount, total_disbursal, extra_fund, rto_released_name, 
        insurance_type, insurance_end_date, pdd_rc, emi_amount, tenure, co_applicants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [
        data.date, data.month, data.product, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.vehicle_end_used, data.mobile, data.vehicle_no, data.model_year,
        data.vehicle_model, data.irr, data.finance_amount, data.status, data.disbursement_date,
        data.sourcing, data.rc_limit_amount, data.charges, data.rto_hold, data.bt_amount,
        data.deferral_hold_company, data.deferral_hold_our_side, data.release_amount, data.deferral_release_amount,
        data.rto_release_amount, data.insurance_amount, data.total_disbursal, data.extra_fund,
        data.rto_released_name, data.insurance_type, data.insurance_end_date, data.pdd_rc, data.emi_amount,
        data.tenure, JSON.stringify(data.co_applicants || [])
    ], function(err) {
        if (!err && data.status === 'Disbursed') {
            addToPayouts(data, 'Vehicle', this.lastID);
        }
        res.json({ success: !err, message: err ? err.message : 'Vehicle case saved', id: this.lastID });
    });
});

// Enhanced MSME Cases API
app.post('/api/msme-cases', (req, res) => {
    const data = req.body;
    const query = `INSERT INTO msme_cases (
        date, month, product, case_book_at, customer_name, address, applicant_occupation,
        loan_end_used, mobile, property_type, irr, finance_amount, status, disbursement_date,
        sourcing, charges, bt_amount, net_amount, extra_fund, total_loan_amount, emi_amount,
        tenure, co_applicants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [
        data.date, data.month, data.product, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.mobile, data.property_type, data.irr,
        data.finance_amount, data.status, data.disbursement_date, data.sourcing, data.charges,
        data.bt_amount, data.net_amount, data.extra_fund, data.total_loan_amount, data.emi_amount,
        data.tenure, JSON.stringify(data.co_applicants || [])
    ], function(err) {
        if (!err && data.status === 'Disbursed') {
            addToPayouts(data, 'MSME', this.lastID);
        }
        res.json({ success: !err, message: err ? err.message : 'MSME case saved', id: this.lastID });
    });
});

// Enhanced PL Cases API
app.post('/api/pl-cases', (req, res) => {
    const data = req.body;
    const query = `INSERT INTO pl_cases (
        date, month, case_book_at, customer_name, address, applicant_occupation,
        loan_end_used, contact_no, roi, loan_amount, status, disbursed_date,
        sourcing_from, total_charges, bt_amount, extra_fund, tenure_months, emi_amount,
        co_applicants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [
        data.date, data.month, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.contact_no, data.roi,
        data.loan_amount, data.status, data.disbursed_date, data.sourcing_from,
        data.total_charges, data.bt_amount, data.extra_fund, data.tenure_months,
        data.emi_amount, JSON.stringify(data.co_applicants || [])
    ], function(err) {
        if (!err && data.status === 'Disbursed') {
            addToPayouts(data, 'Personal Loan', this.lastID);
        }
        res.json({ success: !err, message: err ? err.message : 'PL case saved', id: this.lastID });
    });
});

// Payouts API
app.post('/api/payouts', (req, res) => {
    const data = req.body;
    const query = `INSERT INTO payouts (
        customer_name, mobile, finance_amount, payout_status
    ) VALUES (?, ?, ?, ?)`;
    db.run(query, [data.customerName, data.mobile, data.financeAmount, data.payoutStatus], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Payout saved' });
    });
});

// User Management APIs
app.post('/api/create-user', (req, res) => {
    const { username, password, role } = req.body;
    
    if (!currentUser || currentUser.role !== 'super_admin') {
        return res.json({ success: false, message: 'Unauthorized' });
    }
    
    db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, 
    [username, password, role], function(err) {
        res.json({ success: !err, message: err ? err.message : 'User created successfully' });
    });
});

app.get('/api/users', (req, res) => {
    if (!currentUser || currentUser.role !== 'super_admin') {
        return res.json({ success: false, message: 'Unauthorized' });
    }
    
    db.all('SELECT id, username, role, created_at FROM users', (err, rows) => {
        res.json({ success: !err, users: rows || [] });
    });
});

// Export data API
app.get('/api/export/:type', (req, res) => {
    const { type } = req.params;
    let tableName = '';
    
    switch(type) {
        case 'vehicle': tableName = 'vehicle_cases'; break;
        case 'msme': tableName = 'msme_cases'; break;
        case 'pl': tableName = 'pl_cases'; break;
        case 'payout': tableName = 'payouts'; break;
        default: return res.json({ success: false, message: 'Invalid type' });
    }
    
    db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            const csv = convertToCSV(rows);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${type}-data-${Date.now()}.csv`);
            res.send(csv);
        }
    });
});

// Helper function to add to payouts
function addToPayouts(data, productType, caseId) {
    const query = `INSERT INTO payouts (
        date, month, product, case_book_at, customer_name, address, applicant_occupation,
        loan_end_used, mobile, property_type, irr, finance_amount, status, disbursement_date,
        sourcing, charges, bt_amount, net_amount, extra_fund, total_loan_amount, emi_amount,
        tenure, payout_status, case_type, case_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [
        data.date, data.month, productType, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used || data.vehicle_end_used, data.mobile,
        data.property_type || '', data.irr || data.roi, data.finance_amount || data.loan_amount, 
        data.status, data.disbursement_date || data.disbursed_date,
        data.sourcing || data.sourcing_from, data.charges || data.total_charges, 
        data.bt_amount, data.net_amount, data.extra_fund,
        data.total_loan_amount, data.emi_amount, data.tenure || data.tenure_months, 
        'Pending', productType, caseId
    ]);
}

// Helper function to convert to CSV
function convertToCSV(data) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header] === null || row[header] === undefined ? '' : row[header];
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
}

// Delete case APIs
app.delete('/api/vehicle-cases/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM vehicle_cases WHERE id = ?', [id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Vehicle case deleted' });
    });
});

app.delete('/api/msme-cases/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM msme_cases WHERE id = ?', [id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'MSME case deleted' });
    });
});

app.delete('/api/pl-cases/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM pl_cases WHERE id = ?', [id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'PL case deleted' });
    });
});

app.delete('/api/payouts/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM payouts WHERE id = ?', [id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Payout deleted' });
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Swastik Financial Solutions DSA Loan System Ready!`);
    console.log(`👑 Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`💾 Database: ${dbPath}`);
});
