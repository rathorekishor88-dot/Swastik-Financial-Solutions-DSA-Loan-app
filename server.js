// ===== server.js =====
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
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'dsa_loan.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database error:', err);
    else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

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
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
        const superAdmin = ['rathorekishor88@gmail.com', 'rathorekishor88@gmail.com', 'Jaipur#1992', 'super_admin'];
        db.run(`INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, superAdmin);
    });

    db.run(`CREATE TABLE IF NOT EXISTS vehicle_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, month TEXT, product TEXT, case_book_at TEXT, customer_name TEXT, address TEXT,
        applicant_occupation TEXT, vehicle_end_used TEXT, mobile TEXT, vehicle_no TEXT, model_year TEXT,
        vehicle_model TEXT, irr REAL, finance_amount REAL, status TEXT, disbursement_date TEXT, sourcing TEXT,
        rc_limit_amount REAL, charges REAL, rto_hold TEXT, bt_amount REAL, deferral_hold_company TEXT,
        deferral_hold_our_side TEXT, release_amount REAL, deferral_release_amount REAL, rto_release_amount REAL,
        insurance_amount REAL, total_disbursal REAL, extra_fund REAL, rto_released_name TEXT, insurance_type TEXT,
        insurance_end_date TEXT, pdd_rc TEXT, emi_amount REAL, tenure INTEGER, co_applicants TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Vehicle cases table ready'));

    db.run(`CREATE TABLE IF NOT EXISTS msme_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, month TEXT, product TEXT, case_book_at TEXT, customer_name TEXT, address TEXT,
        applicant_occupation TEXT, loan_end_used TEXT, mobile TEXT, property_type TEXT, irr REAL,
        finance_amount REAL, status TEXT, disbursement_date TEXT, sourcing TEXT, charges REAL, bt_amount REAL,
        net_amount REAL, extra_fund REAL, total_loan_amount REAL, emi_amount REAL, tenure INTEGER,
        co_applicants TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ MSME cases table ready'));

    db.run(`CREATE TABLE IF NOT EXISTS pl_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, month TEXT, case_book_at TEXT, customer_name TEXT, address TEXT, applicant_occupation TEXT,
        loan_end_used TEXT, contact_no TEXT, roi REAL, loan_amount REAL, status TEXT, disbursed_date TEXT,
        sourcing_from TEXT, total_charges REAL, bt_amount REAL, extra_fund REAL, tenure_months INTEGER,
        emi_amount REAL, co_applicants TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ PL cases table ready'));

    db.run(`CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, month TEXT, product TEXT, case_book_at TEXT, customer_name TEXT, address TEXT,
        applicant_occupation TEXT, loan_end_used TEXT, mobile TEXT, property_type TEXT, irr REAL,
        finance_amount REAL, status TEXT, disbursement_date TEXT, sourcing TEXT, charges REAL, bt_amount REAL,
        net_amount REAL, extra_fund REAL, total_loan_amount REAL, emi_amount REAL, tenure INTEGER,
        payout_status TEXT, case_type TEXT, case_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Payouts table ready'));
}

function validatePassword(password) {
    return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$!^%*])[A-Za-z\d@#$!^%*]{8,}$/.test(password);
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===== API ENDPOINTS =====
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, row) => {
        if (err) res.json({ success: false, message: 'Database error' });
        else if (row) {
            currentUser = row;
            res.json({ success: true, user: { username: row.username, email: row.email, role: row.role } });
        } else {
            res.json({ success: false, message: 'Invalid email or password' });
        }
    });
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!validateEmail(email)) return res.json({ success: false, message: 'Invalid email' });
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, row) => {
        if (err) res.json({ success: false, message: 'Database error' });
        else if (row) {
            const otp = generateOTP();
            otpStorage[email] = { otp, expires: Date.now() + 600000 };
            try {
                await emailTransporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'Password Reset OTP',
                    html: `<h2>Password Reset</h2><p>OTP: <strong>${otp}</strong></p><p>Valid for 10 minutes</p>`
                });
                res.json({ success: true, message: 'OTP sent' });
            } catch (error) {
                res.json({ success: false, message: 'Failed to send OTP' });
            }
        } else {
            res.json({ success: false, message: 'Email not found' });
        }
    });
});

app.post('/api/reset-password', (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!validatePassword(newPassword)) return res.json({ success: false, message: 'Invalid password format' });
    
    const otpData = otpStorage[email];
    if (!otpData || otpData.expires < Date.now()) return res.json({ success: false, message: 'OTP expired' });
    if (otpData.otp !== otp) return res.json({ success: false, message: 'Invalid OTP' });
    
    db.run(`UPDATE users SET password = ? WHERE email = ?`, [newPassword, email], function(err) {
        if (err) res.json({ success: false, message: 'Error' });
        else if (this.changes > 0) {
            delete otpStorage[email];
            res.json({ success: true, message: 'Password reset' });
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    });
});

app.post('/api/create-user', (req, res) => {
    const { username, email, password, role } = req.body;
    if (!currentUser || currentUser.role !== 'super_admin') return res.json({ success: false, message: 'Unauthorized' });
    if (!validateEmail(email) || !validatePassword(password)) return res.json({ success: false, message: 'Invalid format' });
    
    db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
        [username, email, password, role], function(err) {
        if (err) res.json({ success: false, message: err.message.includes('UNIQUE') ? 'Email exists' : err.message });
        else res.json({ success: true, message: 'User created' });
    });
});

app.get('/api/all-data', (req, res) => {
    Promise.all([
        new Promise((resolve) => db.all('SELECT * FROM vehicle_cases ORDER BY id DESC', (e, r) => resolve(r || []))),
        new Promise((resolve) => db.all('SELECT * FROM msme_cases ORDER BY id DESC', (e, r) => resolve(r || []))),
        new Promise((resolve) => db.all('SELECT * FROM pl_cases ORDER BY id DESC', (e, r) => resolve(r || []))),
        new Promise((resolve) => db.all('SELECT * FROM payouts ORDER BY id DESC', (e, r) => resolve(r || [])))
    ]).then(([vehicle, msme, pl, payout]) => {
        res.json({
            success: true,
            data: {
                vehicle: vehicle.map(v => ({ ...v, co_applicants: v.co_applicants ? JSON.parse(v.co_applicants) : [] })),
                msme: msme.map(m => ({ ...m, co_applicants: m.co_applicants ? JSON.parse(m.co_applicants) : [] })),
                pl: pl.map(p => ({ ...p, co_applicants: p.co_applicants ? JSON.parse(p.co_applicants) : [] })),
                payout
            }
        });
    }).catch(err => res.json({ success: false, message: err.message }));
});

app.get('/api/analytics', (req, res) => {
    const fiveMonthsAgo = new Date();
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
    
    db.all(`
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as total_cases,
               SUM(finance_amount) as total_amount, case_book_at,
               COUNT(CASE WHEN status = 'Disbursed' THEN 1 END) as disbursed_cases
        FROM (
            SELECT created_at, finance_amount, case_book_at, status FROM vehicle_cases
            UNION ALL SELECT created_at, finance_amount, case_book_at, status FROM msme_cases
            UNION ALL SELECT created_at, loan_amount as finance_amount, case_book_at, status FROM pl_cases
        )
        WHERE created_at >= ? GROUP BY month, case_book_at ORDER BY month DESC
    `, [fiveMonthsAgo.toISOString()], (err, rows) => {
        if (err) return res.json({ success: false, message: err.message });
        const monthlyData = {}, caseBookAtData = {};
        rows.forEach(row => {
            if (!monthlyData[row.month]) {
                monthlyData[row.month] = { month: row.month, total_cases: 0, total_amount: 0, disbursed_cases: 0 };
            }
            monthlyData[row.month].total_cases += row.total_cases;
            monthlyData[row.month].total_amount += row.total_amount || 0;
            monthlyData[row.month].disbursed_cases += row.disbursed_cases;
            caseBookAtData[row.case_book_at] = (caseBookAtData[row.case_book_at] || 0) + row.total_cases;
        });
        res.json({
            success: true,
            data: {
                monthly: Object.values(monthlyData),
                caseBookAt: Object.entries(caseBookAtData).sort((a, b) => b[1] - a[1]).slice(0, 10)
            }
        });
    });
});

// ===== VEHICLE CASES =====
app.post('/api/vehicle-cases', (req, res) => {
    const d = req.body;
    const q = `INSERT INTO vehicle_cases (date, month, product, case_book_at, customer_name, address, applicant_occupation, vehicle_end_used, mobile, vehicle_no, model_year, vehicle_model, irr, finance_amount, status, disbursement_date, sourcing, rc_limit_amount, charges, rto_hold, bt_amount, deferral_hold_company, deferral_hold_our_side, release_amount, deferral_release_amount, rto_release_amount, insurance_amount, total_disbursal, extra_fund, rto_released_name, insurance_type, insurance_end_date, pdd_rc, emi_amount, tenure, co_applicants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(q, [d.date, d.month, d.product, d.case_book_at, d.customer_name, d.address, d.applicant_occupation, d.vehicle_end_used, d.mobile, d.vehicle_no, d.model_year, d.vehicle_model, d.irr, d.finance_amount, d.status, d.disbursement_date, d.sourcing, d.rc_limit_amount, d.charges, d.rto_hold, d.bt_amount, d.deferral_hold_company, d.deferral_hold_our_side, d.release_amount, d.deferral_release_amount, d.rto_release_amount, d.insurance_amount, d.total_disbursal, d.extra_fund, d.rto_released_name, d.insurance_type, d.insurance_end_date, d.pdd_rc, d.emi_amount, d.tenure, JSON.stringify(d.co_applicants || [])], function(err) {
        if (!err && d.status === 'Disbursed') addToPayouts(d, 'Vehicle', this.lastID);
        res.json({ success: !err, message: err ? err.message : 'Saved', id: this.lastID });
    });
});

app.get('/api/vehicle-cases/:id', (req, res) => {
    db.get('SELECT * FROM vehicle_cases WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.json({ success: false, message: err.message });
        if (row) {
            row.co_applicants = row.co_applicants ? JSON.parse(row.co_applicants) : [];
            res.json({ success: true, data: row });
        } else res.json({ success: false, message: 'Not found' });
    });
});

app.put('/api/vehicle-cases/:id', (req, res) => {
    const d = req.body;
    const q = `UPDATE vehicle_cases SET date=?, month=?, product=?, case_book_at=?, customer_name=?, address=?, applicant_occupation=?, vehicle_end_used=?, mobile=?, vehicle_no=?, model_year=?, vehicle_model=?, irr=?, finance_amount=?, status=?, disbursement_date=?, sourcing=?, rc_limit_amount=?, charges=?, rto_hold=?, bt_amount=?, deferral_hold_company=?, deferral_hold_our_side=?, release_amount=?, deferral_release_amount=?, rto_release_amount=?, insurance_amount=?, total_disbursal=?, extra_fund=?, rto_released_name=?, insurance_type=?, insurance_end_date=?, pdd_rc=?, emi_amount=?, tenure=?, co_applicants=? WHERE id=?`;
    
    db.run(q, [d.date, d.month, d.product, d.case_book_at, d.customer_name, d.address, d.applicant_occupation, d.vehicle_end_used, d.mobile, d.vehicle_no, d.model_year, d.vehicle_model, d.irr, d.finance_amount, d.status, d.disbursement_date, d.sourcing, d.rc_limit_amount, d.charges, d.rto_hold, d.bt_amount, d.deferral_hold_company, d.deferral_hold_our_side, d.release_amount, d.deferral_release_amount, d.rto_release_amount, d.insurance_amount, d.total_disbursal, d.extra_fund, d.rto_released_name, d.insurance_type, d.insurance_end_date, d.pdd_rc, d.emi_amount, d.tenure, JSON.stringify(d.co_applicants || []), req.params.id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Updated' });
    });
});

app.delete('/api/vehicle-cases/:id', (req, res) => {
    db.run('DELETE FROM vehicle_cases WHERE id = ?', [req.params.id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Deleted' });
    });
});

// ===== MSME CASES =====
app.post('/api/msme-cases', (req, res) => {
    const d = req.body;
    const q = `INSERT INTO msme_cases (date, month, product, case_book_at, customer_name, address, applicant_occupation, loan_end_used, mobile, property_type, irr, finance_amount, status, disbursement_date, sourcing, charges, bt_amount, net_amount, extra_fund, total_loan_amount, emi_amount, tenure, co_applicants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(q, [d.date, d.month, d.product, d.case_book_at, d.customer_name, d.address, d.applicant_occupation, d.loan_end_used, d.mobile, d.property_type, d.irr, d.finance_amount, d.status, d.disbursement_date, d.sourcing, d.charges, d.bt_amount, d.net_amount, d.extra_fund, d.total_loan_amount, d.emi_amount, d.tenure, JSON.stringify(d.co_applicants || [])], function(err) {
        if (!err && d.status === 'Disbursed') addToPayouts(d, 'MSME', this.lastID);
        res.json({ success: !err, message: err ? err.message : 'Saved', id: this.lastID });
    });
});

app.get('/api/msme-cases/:id', (req, res) => {
    db.get('SELECT * FROM msme_cases WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.json({ success: false, message: err.message });
        if (row) {
            row.co_applicants = row.co_applicants ? JSON.parse(row.co_applicants) : [];
            res.json({ success: true, data: row });
        } else res.json({ success: false, message: 'Not found' });
    });
});

app.put('/api/msme-cases/:id', (req, res) => {
    const d = req.body;
    const q = `UPDATE msme_cases SET date=?, month=?, product=?, case_book_at=?, customer_name=?, address=?, applicant_occupation=?, loan_end_used=?, mobile=?, property_type=?, irr=?, finance_amount=?, status=?, disbursement_date=?, sourcing=?, charges=?, bt_amount=?, net_amount=?, extra_fund=?, total_loan_amount=?, emi_amount=?, tenure=?, co_applicants=? WHERE id=?`;
    
    db.run(q, [d.date, d.month, d.product, d.case_book_at, d.customer_name, d.address, d.applicant_occupation, d.loan_end_used, d.mobile, d.property_type, d.irr, d.finance_amount, d.status, d.disbursement_date, d.sourcing, d.charges, d.bt_amount, d.net_amount, d.extra_fund, d.total_loan_amount, d.emi_amount, d.tenure, JSON.stringify(d.co_applicants || []), req.params.id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Updated' });
    });
});

app.delete('/api/msme-cases/:id', (req, res) => {
    db.run('DELETE FROM msme_cases WHERE id = ?', [req.params.id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Deleted' });
    });
});

// ===== PL CASES =====
app.post('/api/pl-cases', (req, res) => {
    const d = req.body;
    const q = `INSERT INTO pl_cases (date, month, case_book_at, customer_name, address, applicant_occupation, loan_end_used, contact_no, roi, loan_amount, status, disbursed_date, sourcing_from, total_charges, bt_amount, extra_fund, tenure_months, emi_amount, co_applicants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(q, [d.date, d.month, d.case_book_at, d.customer_name, d.address, d.applicant_occupation, d.loan_end_used, d.contact_no, d.roi, d.loan_amount, d.status, d.disbursed_date, d.sourcing_from, d.total_charges, d.bt_amount, d.extra_fund, d.tenure_months, d.emi_amount, JSON.stringify(d.co_applicants || [])], function(err) {
        if (!err && d.status === 'Disbursed') addToPayouts(d, 'PL', this.lastID);
        res.json({ success: !err, message: err ? err.message : 'Saved', id: this.lastID });
    });
});

app.get('/api/pl-cases/:id', (req, res) => {
    db.get('SELECT * FROM pl_cases WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.json({ success: false, message: err.message });
        if (row) {
            row.co_applicants = row.co_applicants ? JSON.parse(row.co_applicants) : [];
            res.json({ success: true, data: row });
        } else res.json({ success: false, message: 'Not found' });
    });
});

app.put('/api/pl-cases/:id', (req, res) => {
    const d = req.body;
    const q = `UPDATE pl_cases SET date=?, month=?, case_book_at=?, customer_name=?, address=?, applicant_occupation=?, loan_end_used=?, contact_no=?, roi=?, loan_amount=?, status=?, disbursed_date=?, sourcing_from=?, total_charges=?, bt_amount=?, extra_fund=?, tenure_months=?, emi_amount=?, co_applicants=? WHERE id=?`;
    
    db.run(q, [d.date, d.month, d.case_book_at, d.customer_name, d.address, d.applicant_occupation, d.loan_end_used, d.contact_no, d.roi, d.loan_amount, d.status, d.disbursed_date, d.sourcing_from, d.total_charges, d.bt_amount, d.extra_fund, d.tenure_months, d.emi_amount, JSON.stringify(d.co_applicants || []), req.params.id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Updated' });
    });
});

app.delete('/api/pl-cases/:id', (req, res) => {
    db.run('DELETE FROM pl_cases WHERE id = ?', [req.params.id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Deleted' });
    });
});

// ===== PAYOUTS =====
app.get('/api/payouts/:id', (req, res) => {
    db.get('SELECT * FROM payouts WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.json({ success: false, message: err.message });
        if (row) res.json({ success: true, data: row });
        else res.json({ success: false, message: 'Not found' });
    });
});

app.put('/api/payouts/:id', (req, res) => {
    const d = req.body;
    db.run(`UPDATE payouts SET date=?, month=?, payout_status=? WHERE id=?`, [d.date, d.month, d.payout_status, req.params.id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Updated' });
    });
});

app.delete('/api/payouts/:id', (req, res) => {
    db.run('DELETE FROM payouts WHERE id = ?', [req.params.id], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Deleted' });
    });
});

// ===== EXPORT =====
app.get('/api/export/:type', (req, res) => {
    const { type } = req.params;
    let tableName = { vehicle: 'vehicle_cases', msme: 'msme_cases', pl: 'pl_cases', payout: 'payouts' }[type];
    if (!tableName) return res.json({ success: false, message: 'Invalid type' });
    
    db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) res.json({ success: false, message: err.message });
        else {
            const csv = convertToCSV(rows);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${type}-${Date.now()}.csv`);
            res.send(csv);
        }
    });
});

function addToPayouts(data, productType, caseId) {
    const q = `INSERT INTO payouts (date, month, product, case_book_at, customer_name, address, applicant_occupation, loan_end_used, mobile, property_type, irr, finance_amount, status, disbursement_date, sourcing, charges, bt_amount, net_amount, extra_fund, total_loan_amount, emi_amount, tenure, payout_status, case_type, case_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(q, [data.date, data.month, productType, data.case_book_at, data.customer_name, data.address, data.applicant_occupation, data.loan_end_used || data.vehicle_end_used, data.mobile, data.property_type || '', data.irr || data.roi, data.finance_amount || data.loan_amount, data.status, data.disbursement_date || data.disbursed_date, data.sourcing || data.sourcing_from, data.charges || data.total_charges, data.bt_amount, data.net_amount, data.extra_fund, data.total_loan_amount, data.emi_amount, data.tenure || data.tenure_months, 'Pending', productType, caseId]);
}

function convertToCSV(data) {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
        const values = headers.map(h => {
            const v = row[h] === null || row[h] === undefined ? '' : row[h];
            return `"${String(v).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔑 Login: rathorekishor88@gmail.com / Jaipur#1992`);
});
