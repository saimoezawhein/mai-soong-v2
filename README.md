# Mai Soong v2 - Exchange Rate Tracker

A comprehensive THB/MMK exchange tracking system with daily profit calculation, balance carrying, and receipt printing.

## 🚀 Features

### Core Features
- ✅ **Carrying Balance** - Automatically carry remaining THB balance to next day
- ✅ **Daily Profit Tracking** - Calculate profit based on daily trades
- ✅ **Daily Summary** - Opening, Purchased, Sold, Closing balance per day
- ✅ **Quick Input** - Single line format for fast data entry
- ✅ **Receipt Printing** - Print transaction receipts
- ✅ **Low Balance Alert** - Notification when balance drops below threshold
- ✅ **Rate History** - Track all exchange rates with statistics
- ✅ **Profit Reports** - Daily, weekly, monthly profit reports

### Quick Input Formats

**For Sales (Sell THB):**
```
Format 1: thb/rate=mmk CustomerName
Example: 5000/0.00791=632111 Tarrar

Format 2: rate*mmk=thb CustomerName  
Example: 790*27=21330 Tarrar
```

**For Purchases (Buy THB):**
```
Format: rate*mmk=thb
Example: 800*100=80000
```

## 📦 Installation

### 1. Database Setup
```bash
# Import database schema via phpMyAdmin
# Or run in MySQL:
mysql -u root -p < init.sql
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Default Login
- Username: `admin`
- Password: `admin123`
- Registration Key: `MAISOONG2025KEY`

## 📊 How Profit is Calculated

### Daily Profit Formula
```
Daily Profit = THB Purchased Today - THB Sold Today
```

### Example:
**Day 1:**
- Buy: 100 MMK × 800 rate = 80,000 THB
- Sell: 60,000 THB × 795 rate = 75.47 MMK
- Remaining: 20,000 THB (carries to Day 2)
- Day 1 Profit: 80,000 - 60,000 = 20,000 THB (not realized yet)

**Day 2:**
- Opening: 20,000 THB
- Buy: 50 MMK × 810 rate = 40,500 THB
- Sell: 60,500 THB × 800 rate = 75.63 MMK
- Remaining: 0 THB
- Day 2 Profit: 40,500 - 60,500 = -20,000 THB

**Total Realized Profit:** When all THB is sold

## 🗂 Project Structure

```
mai-soong-v2/
├── backend/
│   ├── index.js          # Express API server
│   ├── package.json
│   └── .env.local        # Database config
├── frontend/
│   ├── app/
│   │   ├── dashboard/    # Main dashboard
│   │   ├── supplier/     # Supplier management
│   │   ├── daily-summary/# Daily summaries
│   │   ├── rate-history/ # Rate tracking
│   │   ├── reports/      # Profit reports
│   │   ├── login/        # Authentication
│   │   └── register/
│   ├── package.json
│   └── .env.local
└── init.sql              # Database schema
```

## 🔌 API Endpoints

### Auth
- `POST /auth/login` - Login
- `POST /auth/register` - Register

### Suppliers
- `GET /suppliers` - List all
- `GET /suppliers/dashboard` - With daily summary
- `GET /suppliers/:id` - Single supplier with transactions
- `POST /suppliers` - Create
- `DELETE /suppliers/:id` - Delete

### Purchases (Buy THB)
- `GET /purchases` - List
- `POST /purchases` - Create
- `DELETE /purchases/:id` - Delete

### Sales (Sell THB)
- `GET /sales` - List
- `POST /sales` - Create (auto-generates receipt)
- `DELETE /sales/:id` - Delete

### Daily Summary
- `GET /daily-summary` - List summaries
- `GET /daily-summary/today` - Today's summary all suppliers
- `POST /daily-summary/close-day` - Close day

### Rate History
- `GET /rate-history` - List history
- `GET /rate-history/stats` - Statistics

### Reports
- `GET /reports/profit` - Profit report

### Alerts
- `GET /alerts/low-balance` - Low balance alerts

### Receipt
- `GET /receipt/:id` - Get receipt data

### Export
- `GET /export/daily/:date` - Export daily CSV

## 🔧 Configuration

### Backend (.env.local)
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=mai_soong
DB_PORT=3306
PORT=3001
REGISTRATION_KEY=MAISOONG2025KEY
```

### Frontend (.env.local)
```
API_URL=http://localhost:3001
```

## 📱 Pages

1. **Dashboard** - Overview of all suppliers with today's stats
2. **Supplier Detail** - Manage purchases/sales, quick input
3. **Daily Summary** - Historical balance tracking
4. **Rate History** - Exchange rate trends
5. **Reports** - Profit analysis

## 🖨 Receipt Printing

After adding a sale:
1. Click the 🧾 button on the transaction
2. Click "Print" in the receipt modal
3. Uses browser print dialog

## ⚠️ Low Balance Alert

Set threshold per supplier:
1. When creating supplier, set "Low Balance Alert" amount
2. Header shows alert count
3. Supplier cards show warning badge
4. Red banner appears when any supplier is low

## 📝 License

MIT License
