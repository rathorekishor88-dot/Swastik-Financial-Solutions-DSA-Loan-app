const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./dsa_loan.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

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
            ['edit_user', 'Edit@2025', 'edit_delete']
        ];

        defaultUsers.forEach(user => {
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`, user, (err) => {
                if (err) console.log('User exists:', user[0]);
            });
        });
    });

    // Create other tables
    db.run(`CREATE TABLE IF NOT EXISTS vehicle_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        product TEXT,
        case_book_at TEXT,
        customer_name TEXT,
        mobile TEXT,
        finance_amount REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Vehicle cases table ready'));

    db.run(`CREATE TABLE IF NOT EXISTS msme_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        product TEXT,
        case_book_at TEXT,
        customer_name TEXT,
        mobile TEXT,
        finance_amount REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ MSME cases table ready'));

    db.run(`CREATE TABLE IF NOT EXISTS pl_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        case_book_at TEXT,
        customer_name TEXT,
        contact_no TEXT,
        loan_amount REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ PL cases table ready'));

    db.run(`CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        mobile TEXT,
        finance_amount REAL,
        payout_status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => console.log('✅ Payouts table ready'));
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

// Simple data saving APIs
app.post('/api/vehicle-cases', (req, res) => {
    const data = req.body;
    const query = `INSERT INTO vehicle_cases (date, product, case_book_at, customer_name, mobile, finance_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [data.date, data.product, data.caseBookAt, data.customerName, data.mobile, data.financeAmount, data.status], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Vehicle case saved' });
    });
});

app.post('/api/msme-cases', (req, res) => {
    const data = req.body;
    const query = `INSERT INTO msme_cases (date, product, case_book_at, customer_name, mobile, finance_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [data.date, data.product, data.caseBookAt, data.customerName, data.mobile, data.financeAmount, data.status], function(err) {
        res.json({ success: !err, message: err ? err.message : 'MSME case saved' });
    });
});

app.post('/api/pl-cases', (req, res) => {
    const data = req.body;
    const query = `INSERT INTO pl_cases (date, case_book_at, customer_name, contact_no, loan_amount, status) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(query, [data.date, data.caseBookAt, data.customerName, data.contactNo, data.loanAmount, data.status], function(err) {
        res.json({ success: !err, message: err ? err.message : 'PL case saved' });
    });
});

app.post('/api/payouts', (req, res) => {
    const data = req.body;
    const query = `INSERT INTO payouts (customer_name, mobile, finance_amount, payout_status) VALUES (?, ?, ?, ?)`;
    db.run(query, [data.customerName, data.mobile, data.financeAmount, data.payoutStatus], function(err) {
        res.json({ success: !err, message: err ? err.message : 'Payout saved' });
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
    console.log(`📊 Application ready!`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin`);
});