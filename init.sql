-- Mai Soong v2 - Exchange Tracker Database
-- Auto-calculate daily summary with triggers

SET time_zone = '+07:00';

CREATE DATABASE IF NOT EXISTS mai_soong;
USE mai_soong;

-- =====================
-- TABLES
-- =====================

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  low_balance_alert DECIMAL(15,2) DEFAULT 10000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchases table (Buy THB with MMK)
CREATE TABLE IF NOT EXISTS purchases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  mmk_amount DECIMAL(15,5) NOT NULL,
  exchange_rate DECIMAL(10,4) NOT NULL,
  total_thb DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Sales table (Sell THB for MMK)
CREATE TABLE IF NOT EXISTS sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  thb_amount DECIMAL(15,2) NOT NULL,
  exchange_rate DECIMAL(10,4) NOT NULL,
  total_mmk DECIMAL(15,5) NOT NULL,
  receipt_no VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Daily Summary table
CREATE TABLE IF NOT EXISTS daily_summary (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  summary_date DATE NOT NULL,
  opening_thb DECIMAL(15,2) DEFAULT 0,
  opening_mmk DECIMAL(15,5) DEFAULT 0,
  opening_avg_rate DECIMAL(10,4) DEFAULT 0,
  purchased_thb DECIMAL(15,2) DEFAULT 0,
  purchased_mmk DECIMAL(15,5) DEFAULT 0,
  sold_thb DECIMAL(15,2) DEFAULT 0,
  sold_mmk DECIMAL(15,5) DEFAULT 0,
  closing_thb DECIMAL(15,2) DEFAULT 0,
  closing_mmk DECIMAL(15,5) DEFAULT 0,
  closing_avg_rate DECIMAL(10,4) DEFAULT 0,
  daily_profit_thb DECIMAL(15,2) DEFAULT 0,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_supplier_date (supplier_id, summary_date)
);

-- Rate History table
CREATE TABLE IF NOT EXISTS rate_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  rate_type ENUM('buy', 'sell') NOT NULL,
  exchange_rate DECIMAL(10,4) NOT NULL,
  thb_amount DECIMAL(15,2),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================
-- TRIGGERS FOR AUTO-CALCULATION
-- =====================

DELIMITER //

-- Trigger after INSERT on purchases
CREATE TRIGGER after_purchase_insert
AFTER INSERT ON purchases
FOR EACH ROW
BEGIN
  DECLARE v_date DATE;
  DECLARE v_opening DECIMAL(15,2);
  
  SET v_date = DATE(CONVERT_TZ(NEW.created_at, '+00:00', '+07:00'));
  
  -- Get previous day closing balance (most recent before this date)
  SELECT COALESCE(closing_thb, 0) INTO v_opening
  FROM daily_summary 
  WHERE supplier_id = NEW.supplier_id AND summary_date < v_date
  ORDER BY summary_date DESC LIMIT 1;
  
  SET v_opening = COALESCE(v_opening, 0);
  
  -- Create daily summary if not exists
  INSERT INTO daily_summary (supplier_id, summary_date, opening_thb, purchased_thb, sold_thb, closing_thb, daily_profit_thb)
  VALUES (NEW.supplier_id, v_date, v_opening, 0, 0, v_opening, 0)
  ON DUPLICATE KEY UPDATE supplier_id = supplier_id;
  
  -- Recalculate this day
  UPDATE daily_summary SET
    purchased_thb = (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    sold_thb = (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    closing_thb = opening_thb + (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date) - (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    daily_profit_thb = (
      SELECT COALESCE(SUM(s.total_mmk * (COALESCE((SELECT AVG(exchange_rate) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date), 0) - s.exchange_rate)), 0)
      FROM sales s WHERE s.supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(s.created_at, '+00:00', '+07:00')) = v_date
    )
  WHERE supplier_id = NEW.supplier_id AND summary_date = v_date;
END//

-- Trigger after INSERT on sales
CREATE TRIGGER after_sale_insert
AFTER INSERT ON sales
FOR EACH ROW
BEGIN
  DECLARE v_date DATE;
  DECLARE v_opening DECIMAL(15,2);
  
  SET v_date = DATE(CONVERT_TZ(NEW.created_at, '+00:00', '+07:00'));
  
  -- Get previous day closing balance
  SELECT COALESCE(closing_thb, 0) INTO v_opening
  FROM daily_summary 
  WHERE supplier_id = NEW.supplier_id AND summary_date < v_date
  ORDER BY summary_date DESC LIMIT 1;
  
  SET v_opening = COALESCE(v_opening, 0);
  
  -- Create daily summary if not exists
  INSERT INTO daily_summary (supplier_id, summary_date, opening_thb, purchased_thb, sold_thb, closing_thb, daily_profit_thb)
  VALUES (NEW.supplier_id, v_date, v_opening, 0, 0, v_opening, 0)
  ON DUPLICATE KEY UPDATE supplier_id = supplier_id;
  
  -- Recalculate this day
  UPDATE daily_summary SET
    purchased_thb = (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    sold_thb = (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    closing_thb = opening_thb + (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date) - (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    daily_profit_thb = (
      SELECT COALESCE(SUM(s.total_mmk * (COALESCE((SELECT AVG(exchange_rate) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date), 0) - s.exchange_rate)), 0)
      FROM sales s WHERE s.supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(s.created_at, '+00:00', '+07:00')) = v_date
    )
  WHERE supplier_id = NEW.supplier_id AND summary_date = v_date;
END//

-- Trigger after DELETE on purchases
CREATE TRIGGER after_purchase_delete
AFTER DELETE ON purchases
FOR EACH ROW
BEGIN
  DECLARE v_date DATE;
  SET v_date = DATE(CONVERT_TZ(OLD.created_at, '+00:00', '+07:00'));
  
  UPDATE daily_summary SET
    purchased_thb = (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    sold_thb = (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    closing_thb = opening_thb + (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date) - (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    daily_profit_thb = (
      SELECT COALESCE(SUM(s.total_mmk * (COALESCE((SELECT AVG(exchange_rate) FROM purchases WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date), 0) - s.exchange_rate)), 0)
      FROM sales s WHERE s.supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(s.created_at, '+00:00', '+07:00')) = v_date
    )
  WHERE supplier_id = OLD.supplier_id AND summary_date = v_date;
END//

-- Trigger after DELETE on sales
CREATE TRIGGER after_sale_delete
AFTER DELETE ON sales
FOR EACH ROW
BEGIN
  DECLARE v_date DATE;
  SET v_date = DATE(CONVERT_TZ(OLD.created_at, '+00:00', '+07:00'));
  
  UPDATE daily_summary SET
    purchased_thb = (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    sold_thb = (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    closing_thb = opening_thb + (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date) - (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    daily_profit_thb = (
      SELECT COALESCE(SUM(s.total_mmk * (COALESCE((SELECT AVG(exchange_rate) FROM purchases WHERE supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date), 0) - s.exchange_rate)), 0)
      FROM sales s WHERE s.supplier_id = OLD.supplier_id AND DATE(CONVERT_TZ(s.created_at, '+00:00', '+07:00')) = v_date
    )
  WHERE supplier_id = OLD.supplier_id AND summary_date = v_date;
END//

-- Trigger after UPDATE on purchases (for rate changes)
CREATE TRIGGER after_purchase_update
AFTER UPDATE ON purchases
FOR EACH ROW
BEGIN
  DECLARE v_date DATE;
  SET v_date = DATE(CONVERT_TZ(NEW.created_at, '+00:00', '+07:00'));
  
  UPDATE daily_summary SET
    purchased_thb = (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    sold_thb = (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    closing_thb = opening_thb + (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date) - (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    daily_profit_thb = (
      SELECT COALESCE(SUM(s.total_mmk * (COALESCE((SELECT AVG(exchange_rate) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date), 0) - s.exchange_rate)), 0)
      FROM sales s WHERE s.supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(s.created_at, '+00:00', '+07:00')) = v_date
    )
  WHERE supplier_id = NEW.supplier_id AND summary_date = v_date;
END//

-- Trigger after UPDATE on sales
CREATE TRIGGER after_sale_update
AFTER UPDATE ON sales
FOR EACH ROW
BEGIN
  DECLARE v_date DATE;
  SET v_date = DATE(CONVERT_TZ(NEW.created_at, '+00:00', '+07:00'));
  
  UPDATE daily_summary SET
    purchased_thb = (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    sold_thb = (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    closing_thb = opening_thb + (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date) - (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
    daily_profit_thb = (
      SELECT COALESCE(SUM(s.total_mmk * (COALESCE((SELECT AVG(exchange_rate) FROM purchases WHERE supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date), 0) - s.exchange_rate)), 0)
      FROM sales s WHERE s.supplier_id = NEW.supplier_id AND DATE(CONVERT_TZ(s.created_at, '+00:00', '+07:00')) = v_date
    )
  WHERE supplier_id = NEW.supplier_id AND summary_date = v_date;
END//

DELIMITER ;

-- =====================
-- DEFAULT SETTINGS
-- =====================
INSERT INTO settings (setting_key, setting_value) VALUES
('admin_username', 'admin'),
('admin_password', 'admin123'),
('business_name', 'Mai Soong Exchange'),
('default_buy_rate', '786'),
('default_sell_rate', '781')
ON DUPLICATE KEY UPDATE setting_value = setting_value;

-- =====================
-- STORED PROCEDURE: Recalculate All Summaries
-- Use this to fix historical data: CALL recalculate_all_summaries(supplier_id);
-- =====================
DELIMITER //

CREATE PROCEDURE recalculate_all_summaries(IN p_supplier_id INT)
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_date DATE;
  DECLARE v_opening DECIMAL(15,2) DEFAULT 0;
  DECLARE v_closing DECIMAL(15,2);
  
  -- Cursor to loop through all dates with transactions
  DECLARE date_cursor CURSOR FOR
    SELECT DISTINCT DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) as txn_date
    FROM (
      SELECT created_at FROM purchases WHERE supplier_id = p_supplier_id
      UNION ALL
      SELECT created_at FROM sales WHERE supplier_id = p_supplier_id
    ) all_txns
    ORDER BY txn_date ASC;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  -- Delete existing summaries for this supplier
  DELETE FROM daily_summary WHERE supplier_id = p_supplier_id;
  
  OPEN date_cursor;
  
  read_loop: LOOP
    FETCH date_cursor INTO v_date;
    IF done THEN
      LEAVE read_loop;
    END IF;
    
    -- Create summary for this date
    INSERT INTO daily_summary (supplier_id, summary_date, opening_thb)
    VALUES (p_supplier_id, v_date, v_opening);
    
    -- Calculate purchased, sold, closing, profit
    UPDATE daily_summary SET
      purchased_thb = (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = p_supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
      sold_thb = (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = p_supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
      closing_thb = v_opening + (SELECT COALESCE(SUM(total_thb), 0) FROM purchases WHERE supplier_id = p_supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date) - (SELECT COALESCE(SUM(thb_amount), 0) FROM sales WHERE supplier_id = p_supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date),
      daily_profit_thb = (
        SELECT COALESCE(SUM(s.total_mmk * (COALESCE((SELECT AVG(exchange_rate) FROM purchases WHERE supplier_id = p_supplier_id AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = v_date), 0) - s.exchange_rate)), 0)
        FROM sales s WHERE s.supplier_id = p_supplier_id AND DATE(CONVERT_TZ(s.created_at, '+00:00', '+07:00')) = v_date
      )
    WHERE supplier_id = p_supplier_id AND summary_date = v_date;
    
    -- Get closing balance for next day's opening
    SELECT closing_thb INTO v_opening FROM daily_summary WHERE supplier_id = p_supplier_id AND summary_date = v_date;
    
  END LOOP;
  
  CLOSE date_cursor;
  
  SELECT 'Recalculation complete' as status, COUNT(*) as days_processed FROM daily_summary WHERE supplier_id = p_supplier_id;
END//

DELIMITER ;

-- =====================
-- USAGE EXAMPLES
-- =====================

-- To recalculate all summaries for supplier 1:
-- CALL recalculate_all_summaries(1);

-- To add a purchase (auto-calculates summary):
-- INSERT INTO purchases (supplier_id, mmk_amount, exchange_rate, total_thb, created_at)
-- VALUES (1, 25.61, 786, 20000, '2025-12-26 02:00:00');

-- To add a sale (auto-calculates summary):
-- INSERT INTO sales (supplier_id, customer_name, thb_amount, exchange_rate, total_mmk, receipt_no, created_at)
-- VALUES (1, 'Customer', 15000, 781, 19.21, 'MS20251226-1-0001', '2025-12-26 03:00:00');

-- To view daily summaries:
-- SELECT * FROM daily_summary WHERE supplier_id = 1 ORDER BY summary_date;