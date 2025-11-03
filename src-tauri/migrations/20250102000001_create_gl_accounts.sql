-- =============================================================================
-- GENERAL LEDGER - CHART OF ACCOUNTS
-- Multi-Token Accounting System using Subsidiary Ledger Approach
-- =============================================================================

-- Chart of Accounts (General Ledger Accounts)
CREATE TABLE IF NOT EXISTS gl_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT UNIQUE NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('Asset', 'Liability', 'Equity', 'Income', 'Expense')),
    parent_account_id INTEGER,
    digital_asset_type TEXT CHECK(digital_asset_type IN (
        'Native Protocol Token',
        'Stablecoin',
        'Wrapped/Bridged Token',
        'Liquid Staking Derivative',
        'LP Token',
        'Governance Token',
        'Yield-Bearing Token',
        'NFT - Collectible',
        'NFT - Utility',
        'Synthetic Asset',
        'Other Digital Asset'
    )),
    subcategory TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_editable BOOLEAN DEFAULT 1,
    normal_balance TEXT CHECK(normal_balance IN ('debit', 'credit')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_account_id) REFERENCES gl_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_gl_accounts_number ON gl_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_type ON gl_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_digital_type ON gl_accounts(digital_asset_type);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_active ON gl_accounts(is_active);

-- Trigger to update timestamp
CREATE TRIGGER IF NOT EXISTS gl_accounts_update_timestamp
AFTER UPDATE ON gl_accounts
BEGIN
    UPDATE gl_accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
