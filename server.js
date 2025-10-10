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
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

let currentUser = null;
let otpStorage = {}; // In production, use Redis or database

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
        
        // Insert only super admin user if not exists
        const superAdmin = ['rathorekishor88@gmail.com', 'rathorekishor88@gmail.com', 'Jaipur#1992', 'super_admin'];
        db.run(`INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
            superAdmin, (err) => {
            if (err) console.log('Error creating super admin:', err.message);
            else console.log('✅ Super Admin ensured: rathorekishor88@gmail.com');
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

// Login API - Updated for email login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, 
    [email, password], (err, row) => {
        if (err) {
            console.log('Database error:', err.message);
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
                expires: Date.now() + 10 * 60 * 1000 // 10 minutes
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
                        <p>If you didn't request this, please ignore this email.</p>
                    `
                });
                res.json({ success: true, message: 'OTP sent to your email' });
            } catch (error) {
                console.error('Email error:', error.message);
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

// Create User API with validation
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

// Get business analytics data
app.get('/api/analytics', (req, res) => {
    const fiveMonthsAgo = new Date();
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
    const query = `
        SELECT 
            strftime('%Y-%m', created_at) as month,
            COUNT(*) as total_cases,
            SUM(finance_amount) as total_amount,
            case_book_at,
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

// Remove binding to '0.0.0.0' for better compatibility
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Swastik Financial Solutions DSA Loan System Ready!`);
    console.log(`👑 Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`💾 Database: ${dbPath}`);
});
