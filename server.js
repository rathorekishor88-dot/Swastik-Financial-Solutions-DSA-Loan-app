const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Database setup
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

// Initialize database tables
function initializeDatabase() {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
        console.log('✅ Users table ready');
        
        // Create super admin user
        const superAdmin = ['admin', 'rathorekishor88@gmail.com', 'Jaipur#1992', 'super_admin'];
        db.run(`INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
            superAdmin, (err) => {
            if (err) console.log('Error creating super admin:', err);
            else console.log('✅ Super Admin created: rathorekishor88@gmail.com / Jaipur#1992');
        });
    });

    // Enhanced Vehicle Cases table with payout fields
    db.run(`CREATE TABLE IF NOT EXISTS vehicle_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        month TEXT,
        product TEXT,
        loan_type TEXT,
        case_book_at TEXT,
        customer_name TEXT,
        address TEXT,
        applicant_occupation TEXT,
        vehicle_end_used TEXT,
        mobile TEXT,
        sourcing TEXT,
        sourcing_by TEXT,
        brand TEXT,
        vehicle_model TEXT,
        model_year TEXT,
        vehicle_no TEXT,
        insurance_type TEXT,
        insurance_end_date TEXT,
        irr REAL,
        finance_amount REAL,
        tenure INTEGER,
        emi_amount REAL,
        rc_limit_amount REAL,
        charges REAL,
        rto_hold REAL,
        bt_amount REAL,
        deferral_hold_company REAL,
        deferral_hold_our_side REAL,
        insurance_amount REAL,
        extra_fund REAL,
        deferral_release_amount REAL,
        rto_release_amount REAL,
        total_disbursal REAL,
        net_release_amount REAL,
        pdd_rc TEXT,
        rto_released_name TEXT,
        status TEXT,
        disbursement_date TEXT,
        payout_percent REAL,
        payout_amount REAL,
        co_applicants TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Enhanced Vehicle cases table ready'));

    // MSME Cases table
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
        payout_percent REAL,
        payout_amount REAL,
        co_applicants TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ MSME cases table ready'));

    // Personal Loan Cases table
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
        payout_percent REAL,
        payout_amount REAL,
        co_applicants TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ PL cases table ready'));

    // Payouts table
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
    )`, () => console.log('✅ Payouts table ready'));
}

// Validation functions
function validatePassword(password) {
    const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$!^%*])[A-Za-z\d@#$!^%*]{8,}$/;
    return regex.test(password);
}

function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function validateMobile(mobile) {
    const regex = /^[6-9]\d{9}$/;
    return regex.test(mobile);
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to add to payouts
function addToPayouts(data, caseType, caseId) {
    const payoutPercent = data.payout_percent || 0.5;
    const payoutAmount = data.payout_amount || ((data.finance_amount || data.loan_amount || 0) * (payoutPercent / 100));
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

// ==================== API ROUTES ====================

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

// Reset Password
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

// Get all data
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

// Vehicle Cases API - FIXED COLUMN COUNT
app.post('/api/vehicle-cases', (req, res) => {
    const data = req.body;
    
    if (data.mobile && !validateMobile(data.mobile)) {
        return res.json({ success: false, message: 'Mobile number must be 10 digits and start with 6-9' });
    }
    
    const query = `INSERT INTO vehicle_cases (
        date, month, product, loan_type, case_book_at, customer_name, address, applicant_occupation, 
        vehicle_end_used, mobile, sourcing, sourcing_by, brand, vehicle_model, model_year, vehicle_no,
        insurance_type, insurance_end_date, irr, finance_amount, tenure, emi_amount, rc_limit_amount, 
        charges, rto_hold, bt_amount, deferral_hold_company, deferral_hold_our_side, insurance_amount,
        extra_fund, deferral_release_amount, rto_release_amount, total_disbursal, net_release_amount,
        pdd_rc, rto_released_name, status, disbursement_date, payout_percent, payout_amount, co_applicants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        data.date, data.month, data.product, data.loan_type, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.vehicle_end_used, data.mobile, data.sourcing, data.sourcing_by,
        data.brand, data.vehicle_model, data.model_year, data.vehicle_no, data.insurance_type, data.insurance_end_date,
        data.irr, data.finance_amount, data.tenure, data.emi_amount, data.rc_limit_amount, data.charges,
        data.rto_hold, data.bt_amount, data.deferral_hold_company, data.deferral_hold_our_side, data.insurance_amount,
        data.extra_fund, data.deferral_release_amount, data.rto_release_amount, data.total_disbursal,
        data.net_release_amount, data.pdd_rc, data.rto_released_name, data.status, data.disbursement_date,
        data.payout_percent || 0, data.payout_amount || 0, JSON.stringify(data.co_applicants || [])
    ];
    
    db.run(query, values, function(err) {
        if (err) {
            console.error('Database error:', err);
            res.json({ success: false, message: err.message });
        } else {
            if (data.status === 'Disbursed') {
                addToPayouts(data, 'Vehicle', this.lastID);
            }
            res.json({ success: true, message: 'Vehicle case saved successfully', id: this.lastID });
        }
    });
});

// Get Vehicle Case by ID
app.get('/api/vehicle-cases/:id', (req, res) => {
    const id = req.params.id;
    
    if (!id || isNaN(id)) {
        return res.json({ success: false, message: 'Invalid case ID' });
    }
    
    db.get('SELECT * FROM vehicle_cases WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.json({ success: false, message: 'Database error' });
        } else if (row) {
            try {
                row.co_applicants = row.co_applicants ? JSON.parse(row.co_applicants) : [];
                res.json({ success: true, data: row });
            } catch (parseError) {
                row.co_applicants = [];
                res.json({ success: true, data: row });
            }
        } else {
            res.json({ success: false, message: 'Case not found' });
        }
    });
});

// Update Vehicle Case
app.put('/api/vehicle-cases/:id', (req, res) => {
    const id = req.params.id;
    const data = req.body;
    
    if (data.mobile && !validateMobile(data.mobile)) {
        return res.json({ success: false, message: 'Mobile number must be 10 digits and start with 6-9' });
    }
    
    const query = `UPDATE vehicle_cases SET 
        date = ?, month = ?, product = ?, loan_type = ?, case_book_at = ?, customer_name = ?, address = ?, applicant_occupation = ?, 
        vehicle_end_used = ?, mobile = ?, sourcing = ?, sourcing_by = ?, brand = ?, vehicle_model = ?, model_year = ?, vehicle_no = ?,
        insurance_type = ?, insurance_end_date = ?, irr = ?, finance_amount = ?, tenure = ?, emi_amount = ?, rc_limit_amount = ?, 
        charges = ?, rto_hold = ?, bt_amount = ?, deferral_hold_company = ?, deferral_hold_our_side = ?, insurance_amount = ?,
        extra_fund = ?, deferral_release_amount = ?, rto_release_amount = ?, total_disbursal = ?, net_release_amount = ?,
        pdd_rc = ?, rto_released_name = ?, status = ?, disbursement_date = ?, payout_percent = ?, payout_amount = ?, co_applicants = ?
        WHERE id = ?`;
    
    db.run(query, [
        data.date, data.month, data.product, data.loan_type, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.vehicle_end_used, data.mobile, data.sourcing, data.sourcing_by,
        data.brand, data.vehicle_model, data.model_year, data.vehicle_no, data.insurance_type, data.insurance_end_date,
        data.irr, data.finance_amount, data.tenure, data.emi_amount, data.rc_limit_amount, data.charges,
        data.rto_hold, data.bt_amount, data.deferral_hold_company, data.deferral_hold_our_side, data.insurance_amount,
        data.extra_fund, data.deferral_release_amount, data.rto_release_amount, data.total_disbursal,
        data.net_release_amount, data.pdd_rc, data.rto_released_name, data.status, data.disbursement_date,
        data.payout_percent || 0, data.payout_amount || 0, JSON.stringify(data.co_applicants || []), id
    ], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'Vehicle case updated successfully' });
        }
    });
});

// Delete Vehicle Case
app.delete('/api/vehicle-cases/:id', (req, res) => {
    const id = req.params.id;
    
    db.run('DELETE FROM vehicle_cases WHERE id = ?', [id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else if (this.changes > 0) {
            res.json({ success: true, message: 'Vehicle case deleted successfully' });
        } else {
            res.json({ success: false, message: 'Case not found' });
        }
    });
});

// MSME Cases API
app.post('/api/msme-cases', (req, res) => {
    const data = req.body;
    
    if (data.mobile && !validateMobile(data.mobile)) {
        return res.json({ success: false, message: 'Mobile number must be 10 digits and start with 6-9' });
    }
    
    const query = `INSERT INTO msme_cases (
        date, month, product, case_book_at, customer_name, address, applicant_occupation,
        loan_end_used, mobile, property_type, irr, finance_amount, status, disbursement_date,
        sourcing, sourcing_by, charges, bt_amount, net_amount, extra_fund, total_loan_amount, emi_amount,
        tenure, payout_percent, payout_amount, co_applicants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        data.date, data.month, data.product, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.mobile, data.property_type, data.irr,
        data.finance_amount, data.status, data.disbursement_date, data.sourcing, data.sourcing_by, 
        data.charges, data.bt_amount, data.net_amount, data.extra_fund, data.total_loan_amount, 
        data.emi_amount, data.tenure, data.payout_percent || 0, data.payout_amount || 0, 
        JSON.stringify(data.co_applicants || [])
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

app.get('/api/msme-cases/:id', (req, res) => {
    const id = req.params.id;
    
    if (!id || isNaN(id)) {
        return res.json({ success: false, message: 'Invalid case ID' });
    }
    
    db.get('SELECT * FROM msme_cases WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.json({ success: false, message: 'Database error' });
        } else if (row) {
            try {
                row.co_applicants = row.co_applicants ? JSON.parse(row.co_applicants) : [];
                res.json({ success: true, data: row });
            } catch (parseError) {
                row.co_applicants = [];
                res.json({ success: true, data: row });
            }
        } else {
            res.json({ success: false, message: 'Case not found' });
        }
    });
});

app.put('/api/msme-cases/:id', (req, res) => {
    const id = req.params.id;
    const data = req.body;
    
    if (data.mobile && !validateMobile(data.mobile)) {
        return res.json({ success: false, message: 'Mobile number must be 10 digits and start with 6-9' });
    }
    
    const query = `UPDATE msme_cases SET 
        date = ?, month = ?, product = ?, case_book_at = ?, customer_name = ?, address = ?, applicant_occupation = ?,
        loan_end_used = ?, mobile = ?, property_type = ?, irr = ?, finance_amount = ?, status = ?, disbursement_date = ?,
        sourcing = ?, sourcing_by = ?, charges = ?, bt_amount = ?, net_amount = ?, extra_fund = ?, total_loan_amount = ?, emi_amount = ?,
        tenure = ?, payout_percent = ?, payout_amount = ?, co_applicants = ?
        WHERE id = ?`;
    
    db.run(query, [
        data.date, data.month, data.product, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.mobile, data.property_type, data.irr,
        data.finance_amount, data.status, data.disbursement_date, data.sourcing, data.sourcing_by, 
        data.charges, data.bt_amount, data.net_amount, data.extra_fund, data.total_loan_amount, 
        data.emi_amount, data.tenure, data.payout_percent || 0, data.payout_amount || 0, 
        JSON.stringify(data.co_applicants || []), id
    ], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'MSME case updated successfully' });
        }
    });
});

// Delete MSME Case
app.delete('/api/msme-cases/:id', (req, res) => {
    const id = req.params.id;
    
    db.run('DELETE FROM msme_cases WHERE id = ?', [id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else if (this.changes > 0) {
            res.json({ success: true, message: 'MSME case deleted successfully' });
        } else {
            res.json({ success: false, message: 'Case not found' });
        }
    });
});

// PL Cases API
app.post('/api/pl-cases', (req, res) => {
    const data = req.body;
    
    if (data.contact_no && !validateMobile(data.contact_no)) {
        return res.json({ success: false, message: 'Contact number must be 10 digits and start with 6-9' });
    }
    
    const query = `INSERT INTO pl_cases (
        date, month, case_book_at, customer_name, address, applicant_occupation,
        loan_end_used, contact_no, roi, loan_amount, status, disbursed_date,
        sourcing, sourcing_by, total_charges, bt_amount, extra_fund, tenure_months, emi_amount,
        payout_percent, payout_amount, co_applicants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        data.date, data.month, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.contact_no, data.roi,
        data.loan_amount, data.status, data.disbursed_date, data.sourcing, data.sourcing_by,
        data.total_charges, data.bt_amount, data.extra_fund, data.tenure_months,
        data.emi_amount, data.payout_percent || 0, data.payout_amount || 0,
        JSON.stringify(data.co_applicants || [])
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

app.get('/api/pl-cases/:id', (req, res) => {
    const id = req.params.id;
    
    if (!id || isNaN(id)) {
        return res.json({ success: false, message: 'Invalid case ID' });
    }
    
    db.get('SELECT * FROM pl_cases WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.json({ success: false, message: 'Database error' });
        } else if (row) {
            try {
                row.co_applicants = row.co_applicants ? JSON.parse(row.co_applicants) : [];
                res.json({ success: true, data: row });
            } catch (parseError) {
                row.co_applicants = [];
                res.json({ success: true, data: row });
            }
        } else {
            res.json({ success: false, message: 'Case not found' });
        }
    });
});

app.put('/api/pl-cases/:id', (req, res) => {
    const id = req.params.id;
    const data = req.body;
    
    if (data.contact_no && !validateMobile(data.contact_no)) {
        return res.json({ success: false, message: 'Contact number must be 10 digits and start with 6-9' });
    }
    
    const query = `UPDATE pl_cases SET 
        date = ?, month = ?, case_book_at = ?, customer_name = ?, address = ?, applicant_occupation = ?,
        loan_end_used = ?, contact_no = ?, roi = ?, loan_amount = ?, status = ?, disbursed_date = ?,
        sourcing = ?, sourcing_by = ?, total_charges = ?, bt_amount = ?, extra_fund = ?, tenure_months = ?, emi_amount = ?,
        payout_percent = ?, payout_amount = ?, co_applicants = ?
        WHERE id = ?`;
    
    db.run(query, [
        data.date, data.month, data.case_book_at, data.customer_name, data.address,
        data.applicant_occupation, data.loan_end_used, data.contact_no, data.roi,
        data.loan_amount, data.status, data.disbursed_date, data.sourcing, data.sourcing_by,
        data.total_charges, data.bt_amount, data.extra_fund, data.tenure_months,
        data.emi_amount, data.payout_percent || 0, data.payout_amount || 0,
        JSON.stringify(data.co_applicants || []), id
    ], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'PL case updated successfully' });
        }
    });
});

// Delete PL Case
app.delete('/api/pl-cases/:id', (req, res) => {
    const id = req.params.id;
    
    db.run('DELETE FROM pl_cases WHERE id = ?', [id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else if (this.changes > 0) {
            res.json({ success: true, message: 'PL case deleted successfully' });
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

app.get('/api/payouts/:id', (req, res) => {
    const id = req.params.id;
    
    if (!id || isNaN(id)) {
        return res.json({ success: false, message: 'Invalid payout ID' });
    }
    
    db.get('SELECT * FROM payouts WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.json({ success: false, message: 'Database error' });
        } else if (row) {
            res.json({ success: true, data: row });
        } else {
            res.json({ success: false, message: 'Payout not found' });
        }
    });
});

app.put('/api/payouts/:id', (req, res) => {
    const id = req.params.id;
    const data = req.body;
    
    const query = `UPDATE payouts SET 
        payout_date = ?, disbursement_date = ?, product = ?, case_book_at = ?, customer_name = ?, mobile = ?, 
        finance_amount = ?, irr = ?, payout_status = ?, payout_percent = ?, payout_amount = ?, gst = ?, tds = ?, 
        net_amount_received = ?, payout_given_to_referrals = ?, net_payout = ?
        WHERE id = ?`;
    
    db.run(query, [
        data.payout_date, data.disbursement_date, data.product, data.case_book_at, 
        data.customer_name, data.mobile, data.finance_amount, data.irr, data.payout_status,
        data.payout_percent, data.payout_amount, data.gst, data.tds, data.net_amount_received,
        data.payout_given_to_referrals, data.net_payout, id
    ], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'Payout updated successfully' });
        }
    });
});

app.delete('/api/payouts/:id', (req, res) => {
    const id = req.params.id;
    
    db.run('DELETE FROM payouts WHERE id = ?', [id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else if (this.changes > 0) {
            res.json({ success: true, message: 'Payout deleted successfully' });
        } else {
            res.json({ success: false, message: 'Payout not found' });
        }
    });
});

// Process Payout API
app.post('/api/process-payout/:id', (req, res) => {
    const id = req.params.id;
    
    db.run(`UPDATE payouts SET payout_status = 'Processed' WHERE id = ?`, [id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else if (this.changes > 0) {
            res.json({ success: true, message: 'Payout processed successfully' });
        } else {
            res.json({ success: false, message: 'Payout not found' });
        }
    });
});

// Analytics API
app.get('/api/analytics', (req, res) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const query = `
        SELECT 
            strftime('%Y-%m', created_at) as month,
            COUNT(*) as total_cases,
            SUM(finance_amount) as total_amount,
            COUNT(CASE WHEN status = 'Disbursed' THEN 1 END) as disbursed_cases
        FROM (
            SELECT created_at, finance_amount, status FROM vehicle_cases
            UNION ALL
            SELECT created_at, finance_amount, status FROM msme_cases
            UNION ALL
            SELECT created_at, loan_amount as finance_amount, status FROM pl_cases
        )
        WHERE created_at >= ?
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month DESC
    `;
    
    db.all(query, [sixMonthsAgo.toISOString()], (err, rows) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, data: rows });
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

// Catch-all route for undefined API endpoints
app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Serve the main application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Super Admin Login: rathorekishor88@gmail.com / Jaipur#1992`);
});
