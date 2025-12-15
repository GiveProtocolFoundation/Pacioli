-- =============================================================================
-- COST BASIS TRACKING AND TAX LOTS
-- For capital gains/loss calculations and tax reporting
-- =============================================================================

-- Transaction Lots (Cost Basis Tracking)
CREATE TABLE IF NOT EXISTS transaction_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    accounting_transaction_id INTEGER NOT NULL,
    token_id INTEGER NOT NULL,
    acquired_date DATETIME NOT NULL,
    quantity DECIMAL(36, 18) NOT NULL,
    cost_basis DECIMAL(18, 2) NOT NULL,
    remaining_quantity DECIMAL(36, 18) NOT NULL,
    is_closed BOOLEAN DEFAULT 0,
    cost_basis_method TEXT CHECK(cost_basis_method IN ('FIFO', 'LIFO', 'HIFO', 'SpecificID', 'AvgCost')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (accounting_transaction_id) REFERENCES accounting_transactions(id),
    FOREIGN KEY (token_id) REFERENCES tokens(id)
);

CREATE INDEX IF NOT EXISTS idx_lots_token_date ON transaction_lots(token_id, acquired_date);
CREATE INDEX IF NOT EXISTS idx_lots_remaining ON transaction_lots(token_id, is_closed);
CREATE INDEX IF NOT EXISTS idx_lots_transaction ON transaction_lots(accounting_transaction_id);

-- Lot Disposals (Tracking which lots were sold/disposed)
CREATE TABLE IF NOT EXISTS lot_disposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    disposal_transaction_id INTEGER NOT NULL,
    disposal_date DATETIME NOT NULL,
    quantity_disposed DECIMAL(36, 18) NOT NULL,
    proceeds DECIMAL(18, 2) NOT NULL,
    cost_basis DECIMAL(18, 2) NOT NULL,
    gain_loss DECIMAL(18, 2) NOT NULL,
    holding_period_days INTEGER,
    is_long_term BOOLEAN,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id) REFERENCES transaction_lots(id),
    FOREIGN KEY (disposal_transaction_id) REFERENCES accounting_transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_disposals_lot ON lot_disposals(lot_id);
CREATE INDEX IF NOT EXISTS idx_disposals_date ON lot_disposals(disposal_date);
CREATE INDEX IF NOT EXISTS idx_disposals_transaction ON lot_disposals(disposal_transaction_id);

-- Realized Gains/Losses Summary
CREATE TABLE IF NOT EXISTS realized_gains_losses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    disposal_date DATETIME NOT NULL,
    quantity DECIMAL(36, 18) NOT NULL,
    proceeds DECIMAL(18, 2) NOT NULL,
    cost_basis DECIMAL(18, 2) NOT NULL,
    realized_gain_loss DECIMAL(18, 2) NOT NULL,
    is_long_term BOOLEAN,
    tax_year INTEGER,
    disposal_transaction_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    FOREIGN KEY (disposal_transaction_id) REFERENCES accounting_transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_gains_token ON realized_gains_losses(token_id);
CREATE INDEX IF NOT EXISTS idx_gains_date ON realized_gains_losses(disposal_date);
CREATE INDEX IF NOT EXISTS idx_gains_tax_year ON realized_gains_losses(tax_year);
CREATE INDEX IF NOT EXISTS idx_gains_term ON realized_gains_losses(is_long_term);

-- User Preferences for Cost Basis
CREATE TABLE IF NOT EXISTS cost_basis_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preference_key TEXT UNIQUE NOT NULL,
    preference_value TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default preferences
INSERT OR IGNORE INTO cost_basis_preferences (preference_key, preference_value, description) VALUES
    ('default_cost_basis_method', 'FIFO', 'Default method for calculating cost basis'),
    ('long_term_holding_period_days', '365', 'Days required for long-term capital gains'),
    ('reporting_currency', 'USD', 'Currency for financial reporting'),
    ('tax_year_end', '12-31', 'Tax year end date (MM-DD)');

-- Update triggers
CREATE TRIGGER IF NOT EXISTS transaction_lots_update_timestamp
AFTER UPDATE ON transaction_lots
BEGIN
    UPDATE transaction_lots SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS cost_basis_preferences_update_timestamp
AFTER UPDATE ON cost_basis_preferences
BEGIN
    UPDATE cost_basis_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update lot remaining quantity after disposal
CREATE TRIGGER IF NOT EXISTS update_lot_remaining_quantity
AFTER INSERT ON lot_disposals
BEGIN
    UPDATE transaction_lots
    SET remaining_quantity = remaining_quantity - NEW.quantity_disposed,
        is_closed = CASE WHEN (remaining_quantity - NEW.quantity_disposed) <= 0 THEN 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.lot_id;
END;

-- Trigger to calculate holding period (runs after insert to update the record)
CREATE TRIGGER IF NOT EXISTS calculate_holding_period
AFTER INSERT ON lot_disposals
BEGIN
    UPDATE lot_disposals
    SET holding_period_days = CAST(julianday(NEW.disposal_date) - julianday(tl.acquired_date) AS INTEGER),
        is_long_term = CASE WHEN (julianday(NEW.disposal_date) - julianday(tl.acquired_date)) >= 365 THEN 1 ELSE 0 END
    FROM transaction_lots tl
    WHERE lot_disposals.id = NEW.id AND tl.id = NEW.lot_id;
END;
