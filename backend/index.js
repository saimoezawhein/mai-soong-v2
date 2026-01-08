const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

// Bangkok Timezone Helper
const getBangkokTime = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
};

const getBangkokDateString = () => {
  const bangkokTime = getBangkokTime();
  return bangkokTime.toISOString().slice(0, 10);
};

const formatBangkokDateTime = (date) => {
  return new Date(date).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' });
};

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mai_soong',
  port: process.env.DB_PORT || 3308,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00' // Bangkok timezone
});

const PORT = process.env.PORT || 3001;
const REGISTRATION_KEY = process.env.REGISTRATION_KEY || 'MAISOONG2025KEY';

// =====================
// HELPER FUNCTIONS
// =====================

// Generate receipt number
const generateReceiptNo = async (supplierId) => {
  const bangkokDate = getBangkokDateString().replace(/-/g, '');
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM sales 
     WHERE supplier_id = ? 
     AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = ?`,
    [supplierId, getBangkokDateString()]
  );
  const count = rows[0].count + 1;
  return `MS${bangkokDate}-${supplierId}-${String(count).padStart(4, '0')}`;
};

// Get or create today's daily summary
const getOrCreateDailySummary = async (supplierId, date = null) => {
  const targetDate = date || getBangkokDateString();
  
  // Check if summary exists
  const [existing] = await pool.query(
    'SELECT * FROM daily_summary WHERE supplier_id = ? AND summary_date = ?',
    [supplierId, targetDate]
  );
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Get previous day's closing balance
  const [previous] = await pool.query(
    `SELECT closing_thb, closing_mmk, closing_avg_rate 
     FROM daily_summary 
     WHERE supplier_id = ? AND summary_date < ? 
     ORDER BY summary_date DESC LIMIT 1`,
    [supplierId, targetDate]
  );
  
  const openingThb = previous.length > 0 ? previous[0].closing_thb : 0;
  const openingMmk = previous.length > 0 ? previous[0].closing_mmk : 0;
  const openingAvgRate = previous.length > 0 ? previous[0].closing_avg_rate : 0;
  
  // Create new summary
  await pool.query(
    `INSERT INTO daily_summary (supplier_id, summary_date, opening_thb, opening_mmk, opening_avg_rate)
     VALUES (?, ?, ?, ?, ?)`,
    [supplierId, targetDate, openingThb, openingMmk, openingAvgRate]
  );
  
  const [newSummary] = await pool.query(
    'SELECT * FROM daily_summary WHERE supplier_id = ? AND summary_date = ?',
    [supplierId, targetDate]
  );
  
  return newSummary[0];
};

// Update daily summary after transaction
const updateDailySummary = async (supplierId) => {
  const today = getBangkokDateString();
  const summary = await getOrCreateDailySummary(supplierId, today);
  
  // Get today's purchases (using Bangkok timezone)
  const [purchases] = await pool.query(
    `SELECT COALESCE(SUM(total_thb), 0) as total_thb, COALESCE(SUM(mmk_amount), 0) as total_mmk
     FROM purchases 
     WHERE supplier_id = ? 
     AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = ?`,
    [supplierId, today]
  );
  
  // Get today's sales (using Bangkok timezone)
  const [sales] = await pool.query(
    `SELECT COALESCE(SUM(thb_amount), 0) as total_thb, COALESCE(SUM(total_mmk), 0) as total_mmk
     FROM sales 
     WHERE supplier_id = ? 
     AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = ?`,
    [supplierId, today]
  );
  
  const purchasedThb = Number(purchases[0].total_thb);
  const purchasedMmk = Number(purchases[0].total_mmk);
  const soldThb = Number(sales[0].total_thb);
  const soldMmk = Number(sales[0].total_mmk);
  
  const openingThb = Number(summary.opening_thb);
  const openingMmk = Number(summary.opening_mmk);
  
  // Calculate closing balance
  const closingThb = openingThb + purchasedThb - soldThb;
  const closingMmk = openingMmk + purchasedMmk - soldMmk;
  
  // Calculate average rate
  const totalThb = openingThb + purchasedThb;
  const totalMmk = openingMmk + purchasedMmk;
  const closingAvgRate = totalMmk > 0 ? totalThb / totalMmk : 0;
  
  // Calculate daily profit (today's trades only)
  // Profit = THB bought today - THB sold today (for matched MMK)
  const dailyProfitThb = purchasedThb - soldThb;
  
  await pool.query(
    `UPDATE daily_summary SET 
     purchased_thb = ?, purchased_mmk = ?,
     sold_thb = ?, sold_mmk = ?,
     closing_thb = ?, closing_mmk = ?, closing_avg_rate = ?,
     daily_profit_thb = ?
     WHERE supplier_id = ? AND summary_date = ?`,
    [purchasedThb, purchasedMmk, soldThb, soldMmk, closingThb, closingMmk, closingAvgRate, dailyProfitThb, supplierId, today]
  );
};

// Record rate history
const recordRateHistory = async (supplierId, rateType, rate, mmkAmount, thbAmount) => {
  await pool.query(
    'INSERT INTO rate_history (supplier_id, rate_type, exchange_rate, mmk_amount, thb_amount) VALUES (?, ?, ?, ?, ?)',
    [supplierId, rateType, rate, mmkAmount, thbAmount]
  );
};

// =====================
// AUTH API
// =====================
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, registrationKey } = req.body;
    
    if (registrationKey !== REGISTRATION_KEY) {
      return res.status(400).json({ error: 'Invalid registration key' });
    }
    
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Registration successful' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// SUPPLIERS API
// =====================
app.get('/suppliers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/suppliers/dashboard', async (req, res) => {
  try {
    const { mode, date, user_id } = req.query;
    const today = getBangkokDateString();
    
    // Get all suppliers with their current balance
    const [suppliers] = await pool.query(`
      SELECT s.*, COALESCE(co.position, 999999) as position
      FROM suppliers s
      LEFT JOIN supplier_card_order co ON s.id = co.supplier_id AND co.user_id = ?
      ORDER BY co.position ASC, s.created_at DESC
    `, [user_id || 1]);
    
    // For each supplier, get or create daily summary
    const result = await Promise.all(suppliers.map(async (supplier) => {
      const summary = await getOrCreateDailySummary(supplier.id, today);
      await updateDailySummary(supplier.id);
      
      // Get updated summary
      const [updated] = await pool.query(
        'SELECT * FROM daily_summary WHERE supplier_id = ? AND summary_date = ?',
        [supplier.id, today]
      );
      
      const s = updated[0] || summary;
      
      // Check low balance alert
      const lowBalanceAlert = Number(s.closing_thb) < Number(supplier.low_balance_alert);
      
      return {
        ...supplier,
        opening_thb: s.opening_thb,
        opening_mmk: s.opening_mmk,
        purchased_thb: s.purchased_thb,
        purchased_mmk: s.purchased_mmk,
        sold_thb: s.sold_thb,
        sold_mmk: s.sold_mmk,
        closing_thb: s.closing_thb,
        closing_mmk: s.closing_mmk,
        closing_avg_rate: s.closing_avg_rate,
        daily_profit_thb: s.daily_profit_thb,
        low_balance_alert: lowBalanceAlert
      };
    }));
    
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/suppliers/:id', async (req, res) => {
  try {
    const [supplier] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    
    if (supplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    const today = getBangkokDateString();
    
    // Get or update daily summary
    await getOrCreateDailySummary(req.params.id, today);
    await updateDailySummary(req.params.id);
    
    const [summary] = await pool.query(
      'SELECT * FROM daily_summary WHERE supplier_id = ? AND summary_date = ?',
      [req.params.id, today]
    );
    
    // Get today's purchases (Bangkok timezone)
    const [purchases] = await pool.query(
      `SELECT * FROM purchases 
       WHERE supplier_id = ? 
       AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = ? 
       ORDER BY created_at DESC`,
      [req.params.id, today]
    );
    
    // Get today's sales (Bangkok timezone)
    const [sales] = await pool.query(
      `SELECT * FROM sales 
       WHERE supplier_id = ? 
       AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = ? 
       ORDER BY created_at DESC`,
      [req.params.id, today]
    );
    
    res.json({
      ...supplier[0],
      summary: summary[0] || null,
      purchases,
      sales
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/suppliers', async (req, res) => {
  try {
    const { name, low_balance_alert } = req.body;
    const [result] = await pool.query(
      'INSERT INTO suppliers (name, low_balance_alert) VALUES (?, ?)',
      [name, low_balance_alert || 10000]
    );
    res.status(201).json({ id: result.insertId, message: 'Supplier created' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/suppliers/:id', async (req, res) => {
  try {
    const { name, low_balance_alert } = req.body;
    await pool.query(
      'UPDATE suppliers SET name = ?, low_balance_alert = ? WHERE id = ?',
      [name, low_balance_alert, req.params.id]
    );
    res.json({ message: 'Supplier updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/suppliers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Supplier deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/suppliers/card-order', async (req, res) => {
  try {
    const { user_id, order } = req.body;
    
    if (!user_id || !order || !Array.isArray(order)) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    
    await pool.query('DELETE FROM supplier_card_order WHERE user_id = ?', [user_id]);
    
    if (order.length > 0) {
      const values = order.map(item => [user_id, item.supplier_id, item.position]);
      await pool.query(
        'INSERT INTO supplier_card_order (user_id, supplier_id, position) VALUES ?',
        [values]
      );
    }
    
    res.json({ message: 'Card order saved' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// PURCHASES API
// =====================
app.get('/purchases', async (req, res) => {
  try {
    const { supplier_id, date } = req.query;
    let query = 'SELECT * FROM purchases WHERE 1=1';
    const params = [];
    
    if (supplier_id) {
      query += ' AND supplier_id = ?';
      params.push(supplier_id);
    }
    if (date) {
      query += ' AND DATE(created_at) = ?';
      params.push(date);
    }
    
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/purchases', async (req, res) => {
  try {
    const { supplier_id, mmk_amount, exchange_rate, note } = req.body;
    
    // Validate input
    if (!supplier_id || !mmk_amount || !exchange_rate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const total_thb = parseFloat(mmk_amount) * parseFloat(exchange_rate);
    
    // Ensure daily summary exists first
    const today = getBangkokDateString();
    await getOrCreateDailySummary(supplier_id, today);
    
    const [result] = await pool.query(
      'INSERT INTO purchases (supplier_id, mmk_amount, exchange_rate, total_thb, note) VALUES (?, ?, ?, ?, ?)',
      [supplier_id, mmk_amount, exchange_rate, total_thb, note || null]
    );
    
    // Record rate history
    await recordRateHistory(supplier_id, 'buy', exchange_rate, mmk_amount, total_thb);
    
    // Update daily summary
    await updateDailySummary(supplier_id);
    
    res.status(201).json({ id: result.insertId, total_thb, message: 'Purchase added' });
  } catch (e) {
    console.error('Purchase error:', e);
    res.status(500).json({ error: 'Internal Server Error: ' + e.message });
  }
});

app.delete('/purchases/:id', async (req, res) => {
  try {
    const [purchase] = await pool.query('SELECT supplier_id FROM purchases WHERE id = ?', [req.params.id]);
    if (purchase.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    
    await pool.query('DELETE FROM purchases WHERE id = ?', [req.params.id]);
    await updateDailySummary(purchase[0].supplier_id);
    
    res.json({ message: 'Purchase deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// SALES API
// =====================
app.get('/sales', async (req, res) => {
  try {
    const { supplier_id, date } = req.query;
    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];
    
    if (supplier_id) {
      query += ' AND supplier_id = ?';
      params.push(supplier_id);
    }
    if (date) {
      query += ' AND DATE(created_at) = ?';
      params.push(date);
    }
    
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/sales', async (req, res) => {
  try {
    const { supplier_id, customer_name, thb_amount, exchange_rate, note } = req.body;
    
    // Validate input
    if (!supplier_id || !customer_name || !thb_amount || !exchange_rate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const total_mmk = parseFloat(thb_amount) / parseFloat(exchange_rate);
    
    // Ensure daily summary exists first
    const today = getBangkokDateString();
    await getOrCreateDailySummary(supplier_id, today);
    
    const receipt_no = await generateReceiptNo(supplier_id);
    
    const [result] = await pool.query(
      'INSERT INTO sales (supplier_id, customer_name, thb_amount, exchange_rate, total_mmk, receipt_no, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [supplier_id, customer_name, thb_amount, exchange_rate, total_mmk, receipt_no, note || null]
    );
    
    // Record rate history
    await recordRateHistory(supplier_id, 'sell', exchange_rate, total_mmk, thb_amount);
    
    // Update daily summary
    await updateDailySummary(supplier_id);
    
    res.status(201).json({ id: result.insertId, receipt_no, total_mmk, message: 'Sale added' });
  } catch (e) {
    console.error('Sale error:', e);
    res.status(500).json({ error: 'Internal Server Error: ' + e.message });
  }
});

app.get('/sales/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, sp.name as supplier_name 
       FROM sales s 
       JOIN suppliers sp ON s.supplier_id = sp.id 
       WHERE s.id = ?`,
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/sales/:id', async (req, res) => {
  try {
    const [sale] = await pool.query('SELECT supplier_id FROM sales WHERE id = ?', [req.params.id]);
    if (sale.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    await pool.query('DELETE FROM sales WHERE id = ?', [req.params.id]);
    await updateDailySummary(sale[0].supplier_id);
    
    res.json({ message: 'Sale deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// DAILY SUMMARY API
// =====================
app.get('/daily-summary', async (req, res) => {
  try {
    const { supplier_id, start_date, end_date } = req.query;
    let query = 'SELECT ds.*, s.name as supplier_name FROM daily_summary ds JOIN suppliers s ON ds.supplier_id = s.id WHERE 1=1';
    const params = [];
    
    if (supplier_id) {
      query += ' AND ds.supplier_id = ?';
      params.push(supplier_id);
    }
    if (start_date) {
      query += ' AND ds.summary_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND ds.summary_date <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY ds.summary_date DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/daily-summary/today', async (req, res) => {
  try {
    const today = getBangkokDateString();
    
    const [rows] = await pool.query(`
      SELECT ds.*, s.name as supplier_name, s.low_balance_alert as alert_threshold
      FROM daily_summary ds 
      JOIN suppliers s ON ds.supplier_id = s.id 
      WHERE ds.summary_date = ?
      ORDER BY s.name
    `, [today]);
    
    // Calculate totals
    const totals = rows.reduce((acc, row) => ({
      total_opening_thb: acc.total_opening_thb + Number(row.opening_thb),
      total_purchased_thb: acc.total_purchased_thb + Number(row.purchased_thb),
      total_sold_thb: acc.total_sold_thb + Number(row.sold_thb),
      total_closing_thb: acc.total_closing_thb + Number(row.closing_thb),
      total_profit_thb: acc.total_profit_thb + Number(row.daily_profit_thb)
    }), {
      total_opening_thb: 0,
      total_purchased_thb: 0,
      total_sold_thb: 0,
      total_closing_thb: 0,
      total_profit_thb: 0
    });
    
    res.json({ date: today, suppliers: rows, totals });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/daily-summary/close-day', async (req, res) => {
  try {
    const { supplier_id } = req.body;
    const today = getBangkokDateString();
    
    await pool.query(
      'UPDATE daily_summary SET is_closed = TRUE, closed_at = NOW() WHERE supplier_id = ? AND summary_date = ?',
      [supplier_id, today]
    );
    
    res.json({ message: 'Day closed successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// RATE HISTORY API
// =====================
app.get('/rate-history', async (req, res) => {
  try {
    const { supplier_id, rate_type, start_date, end_date, limit } = req.query;
    let query = `
      SELECT rh.*, s.name as supplier_name 
      FROM rate_history rh 
      JOIN suppliers s ON rh.supplier_id = s.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (supplier_id) {
      query += ' AND rh.supplier_id = ?';
      params.push(supplier_id);
    }
    if (rate_type) {
      query += ' AND rh.rate_type = ?';
      params.push(rate_type);
    }
    if (start_date) {
      query += ' AND DATE(rh.recorded_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(rh.recorded_at) <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY rh.recorded_at DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/rate-history/stats', async (req, res) => {
  try {
    const { supplier_id, days } = req.query;
    const daysBack = days || 7;
    
    let query = `
      SELECT 
        DATE(recorded_at) as date,
        rate_type,
        AVG(exchange_rate) as avg_rate,
        MIN(exchange_rate) as min_rate,
        MAX(exchange_rate) as max_rate,
        COUNT(*) as transaction_count
      FROM rate_history
      WHERE recorded_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `;
    const params = [daysBack];
    
    if (supplier_id) {
      query += ' AND supplier_id = ?';
      params.push(supplier_id);
    }
    
    query += ' GROUP BY DATE(recorded_at), rate_type ORDER BY date DESC, rate_type';
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// RECEIPT API
// =====================
app.get('/receipt/:id', async (req, res) => {
  try {
    const [sale] = await pool.query(`
      SELECT s.*, sp.name as supplier_name
      FROM sales s
      JOIN suppliers sp ON s.supplier_id = sp.id
      WHERE s.id = ?
    `, [req.params.id]);
    
    if (sale.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const [settings] = await pool.query('SELECT * FROM settings');
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
    
    res.json({
      ...sale[0],
      business_name: settingsMap.business_name || 'Mai Soong Exchange'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// ALERTS API
// =====================
app.get('/alerts/low-balance', async (req, res) => {
  try {
    const today = getBangkokDateString();
    
    const [alerts] = await pool.query(`
      SELECT s.id, s.name, s.low_balance_alert as threshold, ds.closing_thb as current_balance
      FROM suppliers s
      LEFT JOIN daily_summary ds ON s.id = ds.supplier_id AND ds.summary_date = ?
      WHERE ds.closing_thb < s.low_balance_alert OR ds.closing_thb IS NULL
    `, [today]);
    
    res.json(alerts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// REPORTS API
// =====================
app.get('/reports/profit', async (req, res) => {
  try {
    const { start_date, end_date, supplier_id } = req.query;
    
    let query = `
      SELECT 
        ds.summary_date,
        s.name as supplier_name,
        ds.opening_thb,
        ds.purchased_thb,
        ds.purchased_mmk,
        ds.sold_thb,
        ds.sold_mmk,
        ds.closing_thb,
        ds.daily_profit_thb
      FROM daily_summary ds
      JOIN suppliers s ON ds.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    if (supplier_id) {
      query += ' AND ds.supplier_id = ?';
      params.push(supplier_id);
    }
    if (start_date) {
      query += ' AND ds.summary_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND ds.summary_date <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY ds.summary_date DESC, s.name';
    
    const [rows] = await pool.query(query, params);
    
    // Calculate totals
    const totals = rows.reduce((acc, row) => ({
      total_purchased_thb: acc.total_purchased_thb + Number(row.purchased_thb),
      total_sold_thb: acc.total_sold_thb + Number(row.sold_thb),
      total_profit_thb: acc.total_profit_thb + Number(row.daily_profit_thb)
    }), { total_purchased_thb: 0, total_sold_thb: 0, total_profit_thb: 0 });
    
    res.json({ data: rows, totals });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// EXPORT API
// =====================
app.get('/export/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    const [purchases] = await pool.query(`
      SELECT p.*, s.name as supplier_name
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE DATE(p.created_at) = ?
      ORDER BY p.created_at
    `, [date]);
    
    const [sales] = await pool.query(`
      SELECT sl.*, s.name as supplier_name
      FROM sales sl
      JOIN suppliers s ON sl.supplier_id = s.id
      WHERE DATE(sl.created_at) = ?
      ORDER BY sl.created_at
    `, [date]);
    
    const [summary] = await pool.query(`
      SELECT ds.*, s.name as supplier_name
      FROM daily_summary ds
      JOIN suppliers s ON ds.supplier_id = s.id
      WHERE ds.summary_date = ?
    `, [date]);
    
    // Create CSV
    let csv = 'Daily Report - ' + date + '\n\n';
    
    csv += 'PURCHASES\n';
    csv += 'Time,Supplier,MMK Amount,Rate,THB Amount\n';
    purchases.forEach(p => {
      csv += `${p.created_at},${p.supplier_name},${p.mmk_amount},${p.exchange_rate},${p.total_thb}\n`;
    });
    
    csv += '\nSALES\n';
    csv += 'Time,Supplier,Customer,THB Amount,Rate,MMK Amount,Receipt\n';
    sales.forEach(s => {
      csv += `${s.created_at},${s.supplier_name},${s.customer_name},${s.thb_amount},${s.exchange_rate},${s.total_mmk},${s.receipt_no}\n`;
    });
    
    csv += '\nSUMMARY\n';
    csv += 'Supplier,Opening THB,Purchased THB,Sold THB,Closing THB,Profit THB\n';
    summary.forEach(s => {
      csv += `${s.supplier_name},${s.opening_thb},${s.purchased_thb},${s.sold_thb},${s.closing_thb},${s.daily_profit_thb}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=daily-report-${date}.csv`);
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// SETTINGS API
// =====================
app.get('/settings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM settings');
    const settings = {};
    rows.forEach(row => { settings[row.setting_key] = row.setting_value; });
    res.json(settings);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/settings', async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
    }
    
    res.json({ message: 'Settings updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// HEALTH CHECK
// =====================
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'Connected' });
  } catch (e) {
    res.status(500).json({ status: 'Error', database: 'Disconnected' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Mai Soong API running on port ${PORT}`);
});