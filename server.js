const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

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

// Email configuration (for OTP)
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

let currentUser = null;
let otpStorage = {};

function initializeDatabase() {
    // Create enhanced users table with email
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
        console.log('✅ Users table ready');
        
        // Insert only super admin user
        const superAdmin = ['rathorekishor88@gmail.com', 'rathorekishor88@gmail.com', 'Jaipur#1992', 'super_admin'];
        
        db.run(`INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
            superAdmin, (err) => {
            if (err) console.log('Error creating super admin:', err);
            else console.log('✅ Super Admin created: rathorekishor88@gmail.com');
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
        sourcing_by TEXT,
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
        sourcing_by TEXT,
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
        sourcing TEXT,
        sourcing_by TEXT,
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
        payout_date TEXT,
        disbursement_date TEXT,
        product TEXT,
        case_book_at TEXT,
        customer_name TEXT,
        mobile TEXT,
        finance_amount REAL,
        irr REAL,
        payout_status TEXT,
        payout_percent REAL,
        payout_amount REAL,
        gst REAL,
        tds REAL,
        net_amount_received REAL,
        payout_given_to_referrals TEXT,
        net_payout REAL,
        case_type TEXT,
        case_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Enhanced Payouts table ready'));
}

// Password validation function
function validatePassword(password) {
    const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$!^%*])[A-Za-z\d@#$!^%*]{8,}$/;
    return regex.test(password);
}

// Email validation function
function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to add to payouts
function addToPayouts(data, caseType, caseId) {
    const payoutPercent = 0.5;
    const payoutAmount = (data.finance_amount || data.loan_amount || 0) * (payoutPercent / 100);
    const gst = payoutAmount * 0.18;
    const tds = payoutAmount * 0.05;
    const netAmountReceived = payoutAmount - gst - tds;
    
    db.run(`INSERT INTO payouts (
        payout_date, disbursement_date, product, case_book_at, customer_name, mobile,
        finance_amount, irr, payout_status, payout_percent, payout_amount, gst, tds,
        net_amount_received, payout_given_to_referrals, net_payout, case_type, case_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        new Date().toISOString().split('T')[0],
        data.disbursement_date || data.disbursed_date,
        caseType,
        data.case_book_at,
        data.customer_name,
        data.mobile || data.contact_no,
        data.finance_amount || data.loan_amount,
        data.irr || data.roi,
        'Pending',
        payoutPercent,
        payoutAmount,
        gst,
        tds,
        netAmountReceived,
        data.sourcing_by,
        netAmountReceived,
        caseType,
        caseId
    ]);
}

// Login API
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, 
    [email, password], (err, row) => {
        if (err) {
            res.json({ success: false, message: 'Database error' });
        } else if (row) {
            currentUser = row;
            res.json({ 
                success: true, 
                user: {
                    username: row.username,
                    email: row.email,
                    role: row.role
                }
            });
        } else {
            res.json({ success: false, message: 'Invalid email or password' });
        }
    });
});

// Forgot Password - Send OTP
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    if (!validateEmail(email)) {
        return res.json({ success: false, message: 'Invalid email format' });
    }
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, row) => {
        if (err) {
            res.json({ success: false, message: 'Database error' });
        } else if (row) {
            const otp = generateOTP();
            otpStorage[email] = {
                otp: otp,
                expires: Date.now() + 10 * 60 * 1000
            };
            
            try {
                await emailTransporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'Password Reset OTP - Swastik Financial Solutions',
                    html: `
                        <h2>Password Reset Request</h2>
                        <p>Your OTP for password reset is: <strong>${otp}</strong></p>
                        <p>This OTP will expire in 10 minutes.</p>
                    `
                });
                res.json({ success: true, message: 'OTP sent to your email' });
            } catch (error) {
                res.json({ success: false, message: 'Failed to send OTP' });
            }
        } else {
            res.json({ success: false, message: 'Email not found' });
        }
    });
});

// Verify OTP and Reset Password
app.post('/api/reset-password', (req, res) => {
    const { email, otp, newPassword } = req.body;
    
    if (!validatePassword(newPassword)) {
        return res.json({ 
            success: false, 
            message: 'Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character (@#$!^%*)' 
        });
    }
    
    const otpData = otpStorage[email];
    
    if (!otpData || otpData.expires < Date.now()) {
        return res.json({ success: false, message: 'OTP expired or invalid' });
    }
    
    if (otpData.otp !== otp) {
        return res.json({ success: false, message: 'Invalid OTP' });
    }
    
    db.run(`UPDATE users SET password = ? WHERE email = ?`, [newPassword, email], function(err) {
        if (err) {
            res.json({ success: false, message: 'Database error' });
        } else if (this.changes > 0) {
            delete otpStorage[email];
            res.json({ success: true, message: 'Password reset successfully' });
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    });
});

// Create User API
app.post('/api/create-user', (req, res) => {
    const { username, email, password, role } = req.body;
    
    if (!currentUser || currentUser.role !== 'super_admin') {
        return res.json({ success: false, message: 'Unauthorized' });
    }
    
    if (!validateEmail(email)) {
        return res.json({ success: false, message: 'Invalid email format' });
    }
    
    if (!validatePassword(password)) {
        return res.json({ 
            success: false, 
            message: 'Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character (@#$!^%*)' 
        });
    }
    
    db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
    [username, email, password, role], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                res.json({ success: false, message: 'Email already exists' });
            } else {
                res.json({ success: false, message: err.message });
            }
        } else {
            res.json({ success: true, message: 'User created successfully' });
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
        status, disbursement_date, sourcing, sourcing_by, rc_limit_amount, charges, rto_hold, bt_amount, 
        deferral_hold_company, deferral_hold_our_side, release_amount, deferral_release_amount, 
        rto_release_amount, insurance_amount, total_disbursal, extra_fund, rto_released_name, 
        insurance_type, insurance_end_date, pdd_rc, emi_amount, tenure, co_applicants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        data.date, data.month, data.product, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.vehicle_end_used, data.mobile, data.vehicle_no, data.model_year,
        data.vehicle_model, data.irr, data.finance_amount, data.status, data.disbursement_date,
        data.sourcing, data.sourcing_by, data.rc_limit_amount, data.charges, data.rto_hold, data.bt_amount,
        data.deferral_hold_company, data.deferral_hold_our_side, data.release_amount, data.deferral_release_amount,
        data.rto_release_amount, data.insurance_amount, data.total_disbursal, data.extra_fund,
        data.rto_released_name, data.insurance_type, data.insurance_end_date, data.pdd_rc, data.emi_amount,
        data.tenure, JSON.stringify(data.co_applicants || [])
    ];
    
    db.run(query, values, function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            if (data.status === 'Disbursed') {
                addToPayouts(data, 'Vehicle', this.lastID);
            }
            res.json({ success: true, message: 'Vehicle case saved successfully', id: this.lastID });
        }
    });
});

// Update Vehicle Case API
app.put('/api/vehicle-cases/:id', (req, res) => {
    const id = req.params.id;
    const data = req.body;
    
    const query = `UPDATE vehicle_cases SET 
        date = ?, month = ?, product = ?, case_book_at = ?, customer_name = ?, address = ?, applicant_occupation = ?, 
        vehicle_end_used = ?, mobile = ?, vehicle_no = ?, model_year = ?, vehicle_model = ?, irr = ?, finance_amount = ?, 
        status = ?, disbursement_date = ?, sourcing = ?, sourcing_by = ?, rc_limit_amount = ?, charges = ?, rto_hold = ?, bt_amount = ?, 
        deferral_hold_company = ?, deferral_hold_our_side = ?, release_amount = ?, deferral_release_amount = ?, 
        rto_release_amount = ?, insurance_amount = ?, total_disbursal = ?, extra_fund = ?, rto_released_name = ?, 
        insurance_type = ?, insurance_end_date = ?, pdd_rc = ?, emi_amount = ?, tenure = ?, co_applicants = ?
        WHERE id = ?`;
    
    db.run(query, [
        data.date, data.month, data.product, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.vehicle_end_used, data.mobile, data.vehicle_no, data.model_year,
        data.vehicle_model, data.irr, data.finance_amount, data.status, data.disbursement_date,
        data.sourcing, data.sourcing_by, data.rc_limit_amount, data.charges, data.rto_hold, data.bt_amount,
        data.deferral_hold_company, data.deferral_hold_our_side, data.release_amount, data.deferral_release_amount,
        data.rto_release_amount, data.insurance_amount, data.total_disbursal, data.extra_fund,
        data.rto_released_name, data.insurance_type, data.insurance_end_date, data.pdd_rc, data.emi_amount,
        data.tenure, JSON.stringify(data.co_applicants || []), id
    ], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'Vehicle case updated successfully' });
        }
    });
});

// Get Vehicle Case by ID
app.get('/api/vehicle-cases/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM vehicle_cases WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else if (row) {
            row.co_applicants = row.co_applicants ? JSON.parse(row.co_applicants) : [];
            res.json({ success: true, data: row });
        } else {
            res.json({ success: false, message: 'Case not found' });
        }
    });
});

// Enhanced MSME Cases API
app.post('/api/msme-cases', (req, res) => {
    const data = req.body;
    
    const query = `INSERT INTO msme_cases (
        date, month, product, case_book_at, customer_name, address, applicant_occupation,
        loan_end_used, mobile, property_type, irr, finance_amount, status, disbursement_date,
        sourcing, sourcing_by, charges, bt_amount, net_amount, extra_fund, total_loan_amount, emi_amount,
        tenure, co_applicants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        data.date, data.month, data.product, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.mobile, data.property_type, data.irr,
        data.finance_amount, data.status, data.disbursement_date, data.sourcing, data.sourcing_by, 
        data.charges, data.bt_amount, data.net_amount, data.extra_fund, data.total_loan_amount, 
        data.emi_amount, data.tenure, JSON.stringify(data.co_applicants || [])
    ];
    
    db.run(query, values, function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            if (data.status === 'Disbursed') {
                addToPayouts(data, 'MSME', this.lastID);
            }
            res.json({ success: true, message: 'MSME case saved successfully', id: this.lastID });
        }
    });
});

// Update MSME Case API
app.put('/api/msme-cases/:id', (req, res) => {
    const id = req.params.id;
    const data = req.body;
    
    const query = `UPDATE msme_cases SET 
        date = ?, month = ?, product = ?, case_book_at = ?, customer_name = ?, address = ?, applicant_occupation = ?,
        loan_end_used = ?, mobile = ?, property_type = ?, irr = ?, finance_amount = ?, status = ?, disbursement_date = ?,
        sourcing = ?, sourcing_by = ?, charges = ?, bt_amount = ?, net_amount = ?, extra_fund = ?, total_loan_amount = ?, emi_amount = ?,
        tenure = ?, co_applicants = ?
        WHERE id = ?`;
    
    db.run(query, [
        data.date, data.month, data.product, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.mobile, data.property_type, data.irr,
        data.finance_amount, data.status, data.disbursement_date, data.sourcing, data.sourcing_by, 
        data.charges, data.bt_amount, data.net_amount, data.extra_fund, data.total_loan_amount, 
        data.emi_amount, data.tenure, JSON.stringify(data.co_applicants || []), id
    ], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'MSME case updated successfully' });
        }
    });
});

// Get MSME Case by ID
app.get('/api/msme-cases/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM msme_cases WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else if (row) {
            row.co_applicants = row.co_applicants ? JSON.parse(row.co_applicants) : [];
            res.json({ success: true, data: row });
        } else {
            res.json({ success: false, message: 'Case not found' });
        }
    });
});

// Enhanced PL Cases API
app.post('/api/pl-cases', (req, res) => {
    const data = req.body;
    
    const query = `INSERT INTO pl_cases (
        date, month, case_book_at, customer_name, address, applicant_occupation,
        loan_end_used, contact_no, roi, loan_amount, status, disbursed_date,
        sourcing, sourcing_by, total_charges, bt_amount, extra_fund, tenure_months, emi_amount,
        co_applicants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        data.date, data.month, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.contact_no, data.roi,
        data.loan_amount, data.status, data.disbursed_date, data.sourcing, data.sourcing_by,
        data.total_charges, data.bt_amount, data.extra_fund, data.tenure_months,
        data.emi_amount, JSON.stringify(data.co_applicants || [])
    ];
    
    db.run(query, values, function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            if (data.status === 'Disbursed') {
                addToPayouts(data, 'Personal Loan', this.lastID);
            }
            res.json({ success: true, message: 'PL case saved successfully', id: this.lastID });
        }
    });
});

// Update PL Case API
app.put('/api/pl-cases/:id', (req, res) => {
    const id = req.params.id;
    const data = req.body;
    
    const query = `UPDATE pl_cases SET 
        date = ?, month = ?, case_book_at = ?, customer_name = ?, address = ?, applicant_occupation = ?,
        loan_end_used = ?, contact_no = ?, roi = ?, loan_amount = ?, status = ?, disbursed_date = ?,
        sourcing = ?, sourcing_by = ?, total_charges = ?, bt_amount = ?, extra_fund = ?, tenure_months = ?, emi_amount = ?,
        co_applicants = ?
        WHERE id = ?`;
    
    db.run(query, [
        data.date, data.month, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.contact_no, data.roi,
        data.loan_amount, data.status, data.disbursed_date, data.sourcing, data.sourcing_by,
        data.total_charges, data.bt_amount, data.extra_fund, data.tenure_months,
        data.emi_amount, JSON.stringify(data.co_applicants || []), id
    ], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'PL case updated successfully' });
        }
    });
});

// Get PL Case by ID
app.get('/api/pl-cases/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM pl_cases WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else if (row) {
            row.co_applicants = row.co_applicants ? JSON.parse(row.co_applicants) : [];
            res.json({ success: true, data: row });
        } else {
            res.json({ success: false, message: 'Case not found' });
        }
    });
});

// Payouts API
app.post('/api/payouts', (req, res) => {
    const data = req.body;
    
    const query = `INSERT INTO payouts (
        payout_date, disbursement_date, product, case_book_at, customer_name, mobile, 
        finance_amount, irr, payout_status, payout_percent, payout_amount, gst, tds, 
        net_amount_received, payout_given_to_referrals, net_payout
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        data.payout_date, data.disbursement_date, data.product, data.case_book_at, 
        data.customer_name, data.mobile, data.finance_amount, data.irr, data.payout_status,
        data.payout_percent, data.payout_amount, data.gst, data.tds, data.net_amount_received,
        data.payout_given_to_referrals, data.net_payout
    ];
    
    db.run(query, values, function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'Payout saved successfully', id: this.lastID });
        }
    });
});

// Get business analytics data
app.get('/api/analytics', (req, res) => {
    const fiveMonthsAgo = new Date();
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
    
    const query = `
        SELECT 
            strftime('%Y-%m', created_at) as month,
            COUNT(*) as total_cases,
            SUM(finance_amount) as total_amount,
            CASE_BOOK_AT,
            COUNT(CASE WHEN status = 'Disbursed' THEN 1 END) as disbursed_cases
        FROM (
            SELECT created_at, finance_amount, case_book_at, status FROM vehicle_cases
            UNION ALL
            SELECT created_at, finance_amount, case_book_at, status FROM msme_cases
            UNION ALL
            SELECT created_at, loan_amount as finance_amount, case_book_at, status FROM pl_cases
        )
        WHERE created_at >= ?
        GROUP BY strftime('%Y-%m', created_at), case_book_at
        ORDER BY month DESC, total_cases DESC
    `;
    
    db.all(query, [fiveMonthsAgo.toISOString()], (err, rows) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            const monthlyData = {};
            const caseBookAtData = {};
            
            rows.forEach(row => {
                if (!monthlyData[row.month]) {
                    monthlyData[row.month] = {
                        month: row.month,
                        total_cases: 0,
                        total_amount: 0,
                        disbursed_cases: 0
                    };
                }
                monthlyData[row.month].total_cases += row.total_cases;
                monthlyData[row.month].total_amount += row.total_amount;
                monthlyData[row.month].disbursed_cases += row.disbursed_cases;
                
                if (!caseBookAtData[row.case_book_at]) {
                    caseBookAtData[row.case_book_at] = 0;
                }
                caseBookAtData[row.case_book_at] += row.total_cases;
            });
            
            res.json({
                success: true,
                data: {
                    monthly: Object.values(monthlyData),
                    caseBookAt: Object.entries(caseBookAtData)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                }
            });
        }
    });
});

// Export data API
app.get('/api/export/:type', (req, res) => {
    const { type } = req.params;
    let tableName = '';

    switch(type) {
        case 'vehicle':
            tableName = 'vehicle_cases';
            break;
        case 'msme':
            tableName = 'msme_cases';
            break;
        case 'pl':
            tableName = 'pl_cases';
            break;
        case 'payout':
            tableName = 'payouts';
            break;
        default:
            return res.status(400).json({ success: false, message: 'Invalid export type' });
    }

    db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, message: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
