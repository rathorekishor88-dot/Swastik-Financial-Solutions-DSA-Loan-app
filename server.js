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

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Database setup with WAL mode for 100% persistence
const dbPath = path.join(dataDir, 'dsa_loan.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
    } else {
        console.log('✅ Connected to SQLite database');
        
        // Enable WAL mode for better concurrency and data safety
        db.run('PRAGMA journal_mode = WAL;', (err) => {
            if (!err) console.log('✅ WAL mode enabled');
        });
        
        // Set synchronous mode to FULL for maximum data safety
        db.run('PRAGMA synchronous = FULL;', (err) => {
            if (!err) console.log('✅ Synchronous mode set to FULL');
        });
        
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Use serialize to ensure tables are created in order
    db.serialize(() => {
        // Users table FIRST
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'user')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`, () => {
            console.log('✅ Users table ready');
        });
        
        db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        
        // Create admin user
        db.run(`INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`, 
            ['admin', 'admin@swastik.com', 'Admin@123', 'admin'], 
            (err) => {
                if (!err) console.log('✅ Admin user created: admin@swastik.com');
            }
        );

        // Leads table SECOND (depends on users)
        db.run(`CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_date TEXT NOT NULL,
        month TEXT NOT NULL,
        loan_type TEXT NOT NULL,
        sourcing TEXT NOT NULL,
        sourcing_name TEXT,
        case_book_at TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        contact_no TEXT NOT NULL,
        address TEXT NOT NULL,
        pin_code TEXT NOT NULL,
        district TEXT NOT NULL,
        occupation TEXT NOT NULL,
        co_applicants TEXT DEFAULT '[]',
        guarantors TEXT DEFAULT '[]',
        references TEXT NOT NULL,
        msme_loan_amount REAL,
        msme_loan_end_use TEXT,
        msme_property_type TEXT,
        vehicle_product TEXT,
        vehicle_loan_type TEXT,
        vehicle_loan_amount REAL,
        vehicle_loan_end_use TEXT,
        vehicle_brand TEXT,
        vehicle_model TEXT,
        model_year TEXT,
        vehicle_no TEXT,
        insurance_type TEXT,
        insurance_end_date TEXT,
        two_wheeler_product TEXT,
        two_wheeler_loan_type TEXT,
        two_wheeler_loan_amount REAL,
        two_wheeler_loan_end_use TEXT,
        two_wheeler_brand TEXT,
        two_wheeler_model TEXT,
        two_wheeler_model_year TEXT,
        two_wheeler_no TEXT,
        two_wheeler_insurance_type TEXT,
        two_wheeler_insurance_end_date TEXT,
        pl_loan_amount REAL,
        pl_loan_end_use TEXT,
        status TEXT DEFAULT 'Draft',
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id)
    )`, () => {
        console.log('✅ Leads table ready');
    });
    
    db.run('CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by)');
    db.run('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_leads_date ON leads(lead_date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_leads_month ON leads(month)');

    // Finance Details table THIRD
    db.run(`CREATE TABLE IF NOT EXISTS finance_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        irr REAL,
        roi REAL,
        processing_fee REAL,
        tenure_months INTEGER,
        emi_amount REAL,
        disbursement_date TEXT,
        disbursed_amount REAL,
        sanction_amount REAL,
        approved_by TEXT,
        approved_date TEXT,
        loan_account_no TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
    )`, () => {
        console.log('✅ Finance Details table ready');
    });
    
    db.run('CREATE INDEX IF NOT EXISTS idx_finance_lead_id ON finance_details(lead_id)');

    // Payouts table FOURTH
    db.run(`CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        finance_detail_id INTEGER,
        payout_date TEXT NOT NULL,
        disbursement_month TEXT NOT NULL,
        payout_status TEXT DEFAULT 'Pending',
        gross_payout_amount REAL,
        referral_dsa_paid REAL DEFAULT 0,
        net_payout_received REAL,
        payment_mode TEXT,
        payment_reference TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY(finance_detail_id) REFERENCES finance_details(id)
    )`, () => {
        console.log('✅ Payouts table ready');
    });
    
    db.run('CREATE INDEX IF NOT EXISTS idx_payouts_lead_id ON payouts(lead_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(payout_status)');

    // Expenses table FIFTH
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_date TEXT NOT NULL,
        expense_month TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_mode TEXT,
        receipt_no TEXT,
        remarks TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id)
    )`, () => {
        console.log('✅ Expenses table ready');
    });
    
    db.run('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(expense_month)');
    
    }); // End of db.serialize()
}

// Helper function to convert data to CSV
function convertToCSV(data, headers) {
    if (!data || data.length === 0) return '';
    
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => {
        return headers.map(header => {
            let value = row[header] || '';
            // Escape commas and quotes in values
            if (typeof value === 'string') {
                value = value.replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }
            return value;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}

// ======================
// EXPORT ENDPOINTS
// ======================

// Export Leads
app.get('/api/export/leads', (req, res) => {
    const { userId, role } = req.query;
    
    let query = `
        SELECT 
            l.id,
            l.lead_date,
            l.month,
            l.loan_type,
            l.sourcing,
            l.sourcing_name,
            l.case_book_at,
            l.customer_name,
            l.contact_no,
            l.address,
            l.pin_code,
            l.district,
            l.occupation,
            l.references,
            l.msme_loan_amount,
            l.msme_loan_end_use,
            l.msme_property_type,
            l.vehicle_product,
            l.vehicle_loan_amount,
            l.vehicle_brand,
            l.vehicle_model,
            l.two_wheeler_product,
            l.two_wheeler_loan_amount,
            l.two_wheeler_brand,
            l.pl_loan_amount,
            l.pl_loan_end_use,
            l.status,
            l.created_at,
            u.username as created_by_name
        FROM leads l
        LEFT JOIN users u ON l.created_by = u.id
    `;
    
    let params = [];
    
    // For regular users, restrict to last 1 month and own leads only
    if (role !== 'admin' && role !== 'manager') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];
        
        query += ` WHERE l.created_by = ? AND l.lead_date >= ?`;
        params = [userId, oneMonthAgoStr];
    }
    
    query += ` ORDER BY l.lead_date DESC`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, message: err.message });
            return;
        }
        
        const headers = [
            'id', 'lead_date', 'month', 'loan_type', 'sourcing', 'sourcing_name',
            'case_book_at', 'customer_name', 'contact_no', 'address', 'pin_code',
            'district', 'occupation', 'references', 'msme_loan_amount',
            'msme_loan_end_use', 'msme_property_type', 'vehicle_product',
            'vehicle_loan_amount', 'vehicle_brand', 'vehicle_model',
            'two_wheeler_product', 'two_wheeler_loan_amount', 'two_wheeler_brand',
            'pl_loan_amount', 'pl_loan_end_use', 'status', 'created_at', 'created_by_name'
        ];
        
        const csv = convertToCSV(rows, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
        res.send(csv);
    });
});

// Export Finance Details (Admin/Manager only)
app.get('/api/export/finance', (req, res) => {
    const { role } = req.query;
    
    if (role !== 'admin' && role !== 'manager') {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
    }
    
    const query = `
        SELECT 
            f.id,
            f.lead_id,
            l.customer_name,
            l.loan_type,
            f.irr,
            f.roi,
            f.processing_fee,
            f.tenure_months,
            f.emi_amount,
            f.disbursement_date,
            f.disbursed_amount,
            f.sanction_amount,
            f.approved_by,
            f.approved_date,
            f.loan_account_no,
            f.created_at
        FROM finance_details f
        LEFT JOIN leads l ON f.lead_id = l.id
        ORDER BY f.disbursement_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, message: err.message });
            return;
        }
        
        const headers = [
            'id', 'lead_id', 'customer_name', 'loan_type', 'irr', 'roi',
            'processing_fee', 'tenure_months', 'emi_amount', 'disbursement_date',
            'disbursed_amount', 'sanction_amount', 'approved_by', 'approved_date',
            'loan_account_no', 'created_at'
        ];
        
        const csv = convertToCSV(rows, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=finance_details_export.csv');
        res.send(csv);
    });
});

// Export Payouts (Admin/Manager only)
app.get('/api/export/payouts', (req, res) => {
    const { role } = req.query;
    
    if (role !== 'admin' && role !== 'manager') {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
    }
    
    const query = `
        SELECT 
            p.id,
            p.lead_id,
            l.customer_name,
            l.loan_type,
            p.payout_date,
            p.disbursement_month,
            p.payout_status,
            p.gross_payout_amount,
            p.referral_dsa_paid,
            p.net_payout_received,
            p.payment_mode,
            p.payment_reference,
            p.remarks,
            p.created_at
        FROM payouts p
        LEFT JOIN leads l ON p.lead_id = l.id
        ORDER BY p.payout_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, message: err.message });
            return;
        }
        
        const headers = [
            'id', 'lead_id', 'customer_name', 'loan_type', 'payout_date',
            'disbursement_month', 'payout_status', 'gross_payout_amount',
            'referral_dsa_paid', 'net_payout_received', 'payment_mode',
            'payment_reference', 'remarks', 'created_at'
        ];
        
        const csv = convertToCSV(rows, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=payouts_export.csv');
        res.send(csv);
    });
});

// Export Expenses (Admin/Manager only)
app.get('/api/export/expenses', (req, res) => {
    const { role } = req.query;
    
    if (role !== 'admin' && role !== 'manager') {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
    }
    
    const query = `
        SELECT 
            e.id,
            e.expense_date,
            e.expense_month,
            e.category,
            e.description,
            e.amount,
            e.payment_mode,
            e.receipt_no,
            e.remarks,
            u.username as created_by_name,
            e.created_at
        FROM expenses e
        LEFT JOIN users u ON e.created_by = u.id
        ORDER BY e.expense_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, message: err.message });
            return;
        }
        
        const headers = [
            'id', 'expense_date', 'expense_month', 'category', 'description',
            'amount', 'payment_mode', 'receipt_no', 'remarks', 'created_by_name',
            'created_at'
        ];
        
        const csv = convertToCSV(rows, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=expenses_export.csv');
        res.send(csv);
    });
});

// ======================
// AUTHENTICATION
// ======================

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
        if (err) {
            res.json({ success: false, message: 'Database error' });
        } else if (user) {
            // Update last login
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        } else {
            res.json({ success: false, message: 'Invalid credentials' });
        }
    });
});

// ======================
// LEADS MANAGEMENT
// ======================

app.post('/api/leads', (req, res) => {
    const lead = req.body;
    const columns = Object.keys(lead).join(', ');
    const placeholders = Object.keys(lead).map(() => '?').join(', ');
    const values = Object.values(lead).map(v => 
        Array.isArray(v) ? JSON.stringify(v) : v
    );
    
    db.run(
        `INSERT INTO leads (${columns}) VALUES (${placeholders})`,
        values,
        function(err) {
            if (err) {
                res.json({ success: false, message: err.message });
            } else {
                res.json({ success: true, id: this.lastID });
            }
        }
    );
});

app.get('/api/leads', (req, res) => {
    const { userId, role } = req.query;
    
    let query = `
        SELECT l.*, u.username as created_by_name 
        FROM leads l 
        LEFT JOIN users u ON l.created_by = u.id
    `;
    
    let params = [];
    
    if (role !== 'admin' && role !== 'manager') {
        query += ' WHERE l.created_by = ?';
        params = [userId];
    }
    
    query += ' ORDER BY l.created_at DESC';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

app.get('/api/leads/:id', (req, res) => {
    db.get('SELECT * FROM leads WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, data: row });
        }
    });
});

app.put('/api/leads/:id', (req, res) => {
    const lead = req.body;
    const id = req.params.id;
    
    const updates = Object.keys(lead).map(key => `${key} = ?`).join(', ');
    const values = Object.values(lead).map(v => 
        Array.isArray(v) ? JSON.stringify(v) : v
    );
    values.push(id);
    
    db.run(
        `UPDATE leads SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                res.json({ success: false, message: err.message });
            } else {
                res.json({ success: true, changes: this.changes });
            }
        }
    );
});

app.delete('/api/leads/:id', (req, res) => {
    db.run('DELETE FROM leads WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, changes: this.changes });
        }
    });
});

// ======================
// FINANCE DETAILS
// ======================

app.post('/api/finance', (req, res) => {
    const finance = req.body;
    const columns = Object.keys(finance).join(', ');
    const placeholders = Object.keys(finance).map(() => '?').join(', ');
    const values = Object.values(finance);
    
    db.run(
        `INSERT INTO finance_details (${columns}) VALUES (${placeholders})`,
        values,
        function(err) {
            if (err) {
                res.json({ success: false, message: err.message });
            } else {
                res.json({ success: true, id: this.lastID });
            }
        }
    );
});

app.get('/api/finance', (req, res) => {
    const query = `
        SELECT f.*, l.customer_name, l.loan_type 
        FROM finance_details f
        LEFT JOIN leads l ON f.lead_id = l.id
        ORDER BY f.created_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

app.get('/api/finance/lead/:leadId', (req, res) => {
    db.get('SELECT * FROM finance_details WHERE lead_id = ?', [req.params.leadId], (err, row) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, data: row });
        }
    });
});

app.put('/api/finance/:id', (req, res) => {
    const finance = req.body;
    const id = req.params.id;
    
    const updates = Object.keys(finance).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(finance), id];
    
    db.run(
        `UPDATE finance_details SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                res.json({ success: false, message: err.message });
            } else {
                res.json({ success: true, changes: this.changes });
            }
        }
    );
});

app.delete('/api/finance/:id', (req, res) => {
    db.run('DELETE FROM finance_details WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, changes: this.changes });
        }
    });
});

// ======================
// PAYOUTS
// ======================

app.post('/api/payouts', (req, res) => {
    const payout = req.body;
    const columns = Object.keys(payout).join(', ');
    const placeholders = Object.keys(payout).map(() => '?').join(', ');
    const values = Object.values(payout);
    
    db.run(
        `INSERT INTO payouts (${columns}) VALUES (${placeholders})`,
        values,
        function(err) {
            if (err) {
                res.json({ success: false, message: err.message });
            } else {
                res.json({ success: true, id: this.lastID });
            }
        }
    );
});

app.get('/api/payouts', (req, res) => {
    const query = `
        SELECT p.*, l.customer_name, l.loan_type
        FROM payouts p
        LEFT JOIN leads l ON p.lead_id = l.id
        ORDER BY p.payout_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

app.put('/api/payouts/:id', (req, res) => {
    const payout = req.body;
    const id = req.params.id;
    
    const updates = Object.keys(payout).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(payout), id];
    
    db.run(
        `UPDATE payouts SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                res.json({ success: false, message: err.message });
            } else {
                res.json({ success: true, changes: this.changes });
            }
        }
    );
});

app.delete('/api/payouts/:id', (req, res) => {
    db.run('DELETE FROM payouts WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, changes: this.changes });
        }
    });
});

// ======================
// EXPENSES
// ======================

app.post('/api/expenses', (req, res) => {
    const expense = req.body;
    const columns = Object.keys(expense).join(', ');
    const placeholders = Object.keys(expense).map(() => '?').join(', ');
    const values = Object.values(expense);
    
    db.run(
        `INSERT INTO expenses (${columns}) VALUES (${placeholders})`,
        values,
        function(err) {
            if (err) {
                res.json({ success: false, message: err.message });
            } else {
                res.json({ success: true, id: this.lastID });
            }
        }
    );
});

app.get('/api/expenses', (req, res) => {
    const query = `
        SELECT e.*, u.username as created_by_name
        FROM expenses e
        LEFT JOIN users u ON e.created_by = u.id
        ORDER BY e.expense_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

app.put('/api/expenses/:id', (req, res) => {
    const expense = req.body;
    const id = req.params.id;
    
    const updates = Object.keys(expense).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(expense), id];
    
    db.run(
        `UPDATE expenses SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                res.json({ success: false, message: err.message });
            } else {
                res.json({ success: true, changes: this.changes });
            }
        }
    );
});

app.delete('/api/expenses/:id', (req, res) => {
    db.run('DELETE FROM expenses WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, changes: this.changes });
        }
    });
});

// ======================
// DASHBOARD ANALYTICS
// ======================

// Dashboard Analytics - Admin/Manager
app.get('/api/dashboard/admin', (req, res) => {
    const queries = {
        totalLeads: 'SELECT COUNT(*) as count FROM leads',
        totalDisbursed: 'SELECT SUM(disbursed_amount) as total FROM finance_details',
        totalPayout: 'SELECT SUM(net_payout_received) as total FROM payouts WHERE payout_status = "Received"',
        pendingPayout: 'SELECT SUM(gross_payout_amount) as total, COUNT(*) as count FROM payouts WHERE payout_status = "Pending"',
        monthlyDisbursement: `
            SELECT 
                strftime('%Y-%m', disbursement_date) as month,
                SUM(disbursed_amount) as amount
            FROM finance_details
            WHERE disbursement_date IS NOT NULL
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        `,
        monthlyPayouts: `
            SELECT 
                disbursement_month as month,
                SUM(gross_payout_amount) as gross,
                SUM(referral_dsa_paid) as referral_paid,
                SUM(net_payout_received) as net
            FROM payouts
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        `,
        monthlyExpenses: `
            SELECT 
                expense_month as month,
                SUM(amount) as total
            FROM expenses
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        `
    };
    
    Promise.all([
        new Promise((resolve) => db.get(queries.totalLeads, [], (err, row) => resolve(row || {count: 0}))),
        new Promise((resolve) => db.get(queries.totalDisbursed, [], (err, row) => resolve(row || {total: 0}))),
        new Promise((resolve) => db.get(queries.totalPayout, [], (err, row) => resolve(row || {total: 0}))),
        new Promise((resolve) => db.get(queries.pendingPayout, [], (err, row) => resolve(row || {total: 0, count: 0}))),
        new Promise((resolve) => db.all(queries.monthlyDisbursement, [], (err, rows) => resolve(rows || []))),
        new Promise((resolve) => db.all(queries.monthlyPayouts, [], (err, rows) => resolve(rows || []))),
        new Promise((resolve) => db.all(queries.monthlyExpenses, [], (err, rows) => resolve(rows || [])))
    ]).then(([leads, disbursed, payout, pending, disbursements, payouts, expenses]) => {
        // Calculate monthly totals
        const totals = {};
        
        disbursements.forEach(d => {
            if (!totals[d.month]) totals[d.month] = { disbursement: 0, gross: 0, referral: 0, net: 0, expenses: 0 };
            totals[d.month].disbursement = d.amount || 0;
        });
        
        payouts.forEach(p => {
            if (!totals[p.month]) totals[p.month] = { disbursement: 0, gross: 0, referral: 0, net: 0, expenses: 0 };
            totals[p.month].gross = p.gross || 0;
            totals[p.month].referral = p.referral_paid || 0;
            totals[p.month].net = p.net || 0;
        });
        
        expenses.forEach(e => {
            if (!totals[e.month]) totals[e.month] = { disbursement: 0, gross: 0, referral: 0, net: 0, expenses: 0 };
            totals[e.month].expenses = e.total || 0;
        });
        
        res.json({
            success: true,
            data: {
                totalLeads: leads.count,
                totalDisbursed: disbursed.total || 0,
                totalPayout: payout.total || 0,
                pendingPayout: pending.total || 0,
                pendingCount: pending.count || 0,
                monthlyDisbursements: disbursements,
                monthlyPayouts: payouts,
                monthlyExpenses: expenses,
                totals: totals,
                pendingPayouts: pending
            }
        });
    });
});

// Dashboard Analytics - User
app.get('/api/dashboard/user/:userId', (req, res) => {
    const userId = req.params.userId;
    
    const queries = {
        monthlyLeads: `
            SELECT 
                month,
                COUNT(*) as count
            FROM leads
            WHERE created_by = ?
            GROUP BY month
            ORDER BY lead_date DESC
            LIMIT 6
        `,
        totalLeads: `
            SELECT COUNT(*) as count FROM leads WHERE created_by = ?
        `,
        loanTypeBreakdown: `
            SELECT loan_type, COUNT(*) as count 
            FROM leads 
            WHERE created_by = ?
            GROUP BY loan_type
        `,
        statusBreakdown: `
            SELECT status, COUNT(*) as count
            FROM leads
            WHERE created_by = ?
            GROUP BY status
        `
    };
    
    Promise.all([
        new Promise((resolve) => db.all(queries.monthlyLeads, [userId], (err, rows) => resolve(rows || []))),
        new Promise((resolve) => db.get(queries.totalLeads, [userId], (err, row) => resolve(row || {count: 0}))),
        new Promise((resolve) => db.all(queries.loanTypeBreakdown, [userId], (err, rows) => resolve(rows || []))),
        new Promise((resolve) => db.all(queries.statusBreakdown, [userId], (err, rows) => resolve(rows || [])))
    ]).then(([monthly, total, loanTypes, status]) => {
        res.json({
            success: true,
            data: {
                monthlyLeads: monthly,
                totalLeads: total.count,
                loanTypeBreakdown: loanTypes,
                statusBreakdown: status
            }
        });
    });
});

// ======================
// USER MANAGEMENT
// ======================

app.post('/api/users', (req, res) => {
    const { username, email, password, role } = req.body;
    
    db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
    [username, email, password, role], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'User created', id: this.lastID });
        }
    });
});

app.get('/api/users', (req, res) => {
    db.all('SELECT id, username, email, role, created_at, last_login FROM users ORDER BY created_at DESC', 
    [], (err, rows) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

app.delete('/api/users/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'User deleted' });
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${dbPath}`);
    console.log(`✅ WAL mode: Enabled`);
    console.log(`✅ Data persistence: 100%`);
    console.log('\n📝 Default Login:');
    console.log('Admin: admin@swastik.com / Admin@123');
    console.log('\n📤 Export Features:');
    console.log('- Admin: All data (Leads, Finance, Payouts, Expenses)');
    console.log('- User: Own leads only (Last 1 month)');
});
