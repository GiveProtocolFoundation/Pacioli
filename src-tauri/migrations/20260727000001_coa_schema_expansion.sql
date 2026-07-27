-- =============================================================================
-- COA SCHEMA EXPANSION (GIV-757)
--
-- 1. Expands gl_accounts.account_type CHECK to include 'Revenue'.
-- 2. Adds context, profile_id, hidden columns.
-- 3. Changes UNIQUE from account_number alone to (profile_id, account_number).
-- 4. Adds composite index (profile_id, context, account_type).
-- 5. Rebuilds v_income_statement to include 'Revenue'.
--
-- SQLite cannot ALTER a CHECK constraint, so the table is recreated.
-- All dependent views are dropped before the table swap and recreated after.
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- ---------------------------------------------------------------
-- 1. Drop all views that depend on gl_accounts (directly or via
--    another view that references it). Drop dependents first.
-- ---------------------------------------------------------------
DROP VIEW IF EXISTS v_portfolio_performance;
DROP VIEW IF EXISTS v_token_holdings;
DROP VIEW IF EXISTS v_balance_sheet;
DROP VIEW IF EXISTS v_income_statement;
DROP VIEW IF EXISTS v_token_balances;
DROP VIEW IF EXISTS v_account_balances;
DROP VIEW IF EXISTS v_general_ledger;
DROP VIEW IF EXISTS v_trial_balance;
DROP VIEW IF EXISTS v_account_activity;

-- ---------------------------------------------------------------
-- 2. Create replacement table with expanded schema
-- ---------------------------------------------------------------
CREATE TABLE gl_accounts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('Asset', 'Liability', 'Equity', 'Income', 'Revenue', 'Expense')),
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
    context TEXT NOT NULL DEFAULT 'all' CHECK(context IN ('all','individual','sme','ngo')),
    profile_id TEXT,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(profile_id, account_number),
    FOREIGN KEY (parent_account_id) REFERENCES gl_accounts(id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

-- ---------------------------------------------------------------
-- 3. Copy existing rows (defaults fill context='all', profile_id=NULL, hidden=0)
-- ---------------------------------------------------------------
INSERT INTO gl_accounts_new (
    id, account_number, account_name, account_type,
    parent_account_id, digital_asset_type, subcategory, description,
    is_active, is_editable, normal_balance, created_at, updated_at
)
SELECT
    id, account_number, account_name, account_type,
    parent_account_id, digital_asset_type, subcategory, description,
    is_active, is_editable, normal_balance, created_at, updated_at
FROM gl_accounts;

-- ---------------------------------------------------------------
-- 4. Drop old table artifacts and swap
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS gl_accounts_update_timestamp;
DROP INDEX IF EXISTS idx_gl_accounts_number;
DROP INDEX IF EXISTS idx_gl_accounts_type;
DROP INDEX IF EXISTS idx_gl_accounts_digital_type;
DROP INDEX IF EXISTS idx_gl_accounts_active;
DROP TABLE gl_accounts;

ALTER TABLE gl_accounts_new RENAME TO gl_accounts;

-- ---------------------------------------------------------------
-- 5. Recreate indexes
-- ---------------------------------------------------------------
CREATE INDEX idx_gl_accounts_number ON gl_accounts(account_number);
CREATE INDEX idx_gl_accounts_type ON gl_accounts(account_type);
CREATE INDEX idx_gl_accounts_digital_type ON gl_accounts(digital_asset_type);
CREATE INDEX idx_gl_accounts_active ON gl_accounts(is_active);
CREATE INDEX idx_gl_accounts_profile_context_type ON gl_accounts(profile_id, context, account_type);

-- ---------------------------------------------------------------
-- 6. Recreate update trigger
-- ---------------------------------------------------------------
CREATE TRIGGER gl_accounts_update_timestamp
AFTER UPDATE ON gl_accounts
BEGIN
    UPDATE gl_accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ---------------------------------------------------------------
-- 7. Recreate all dropped views
-- ---------------------------------------------------------------

-- v_token_balances (from 20250102000005 — unchanged)
CREATE VIEW v_token_balances AS
SELECT
    at.gl_account_id,
    ga.account_number,
    ga.account_name,
    ga.account_type,
    at.token_id,
    t.symbol AS token_symbol,
    t.name AS token_name,
    t.chain_id,
    SUM(CASE WHEN at.transaction_type IN ('purchase', 'transfer_in', 'stake', 'swap_in', 'lp_deposit', 'airdrop', 'gift_received', 'loan_borrowed', 'reward', 'interest_earned')
        THEN at.quantity ELSE 0 END) AS total_inflows,
    SUM(CASE WHEN at.transaction_type IN ('sale', 'transfer_out', 'unstake', 'swap_out', 'lp_withdraw', 'gift_sent', 'donation', 'loan_repaid', 'fee', 'interest_paid')
        THEN at.quantity ELSE 0 END) AS total_outflows,
    SUM(CASE WHEN at.transaction_type IN ('purchase', 'transfer_in', 'stake', 'swap_in', 'lp_deposit', 'airdrop', 'gift_received', 'loan_borrowed', 'reward', 'interest_earned')
        THEN at.quantity ELSE -at.quantity END) AS net_quantity,
    SUM(CASE WHEN at.total_value IS NOT NULL THEN at.total_value ELSE 0 END) AS total_value_usd
FROM accounting_transactions at
JOIN gl_accounts ga ON at.gl_account_id = ga.id
JOIN tokens t ON at.token_id = t.id
WHERE ga.is_active = 1 AND t.is_active = 1
GROUP BY at.gl_account_id, at.token_id;

-- v_account_balances (from 20260715000004 — minor-unit version, unchanged)
CREATE VIEW v_account_balances AS
SELECT
    ga.id AS account_id,
    ga.account_number,
    ga.account_name,
    ga.account_type,
    ga.digital_asset_type,
    ga.normal_balance,
    COALESCE(SUM(jel.debit_minor), 0) AS total_debits,
    COALESCE(SUM(jel.credit_minor), 0) AS total_credits,
    CASE
        WHEN ga.normal_balance = 'debit' THEN COALESCE(SUM(jel.debit_minor), 0) - COALESCE(SUM(jel.credit_minor), 0)
        ELSE COALESCE(SUM(jel.credit_minor), 0) - COALESCE(SUM(jel.debit_minor), 0)
    END AS balance,
    CASE
        WHEN ga.account_type IN ('Asset', 'Expense') THEN COALESCE(SUM(jel.debit_minor), 0) - COALESCE(SUM(jel.credit_minor), 0)
        ELSE COALESCE(SUM(jel.credit_minor), 0) - COALESCE(SUM(jel.debit_minor), 0)
    END AS balance_signed
FROM gl_accounts ga
LEFT JOIN journal_entry_lines jel ON ga.id = jel.gl_account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE ga.is_active = 1 AND (je.is_posted = 1 OR je.id IS NULL)
GROUP BY ga.id, ga.account_number, ga.account_name, ga.account_type, ga.normal_balance;

-- v_general_ledger (from 20250102000005 — unchanged)
CREATE VIEW v_general_ledger AS
SELECT
    je.entry_date,
    je.entry_number,
    jel.line_number,
    ga.account_number,
    ga.account_name,
    ga.account_type,
    t.symbol AS token_symbol,
    jel.debit_amount,
    jel.credit_amount,
    jel.description,
    je.reference_number,
    je.is_posted,
    je.is_reversed
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
JOIN gl_accounts ga ON jel.gl_account_id = ga.id
LEFT JOIN tokens t ON jel.token_id = t.id
WHERE je.is_posted = 1
ORDER BY je.entry_date DESC, je.entry_number, jel.line_number;

-- v_trial_balance (from 20260715000004 — minor-unit version, unchanged)
CREATE VIEW v_trial_balance AS
SELECT
    ga.account_number,
    ga.account_name,
    ga.account_type,
    CASE
        WHEN SUM(jel.debit_minor) - SUM(jel.credit_minor) > 0
        THEN SUM(jel.debit_minor) - SUM(jel.credit_minor)
        ELSE 0
    END AS debit_balance,
    CASE
        WHEN SUM(jel.credit_minor) - SUM(jel.debit_minor) > 0
        THEN SUM(jel.credit_minor) - SUM(jel.debit_minor)
        ELSE 0
    END AS credit_balance
FROM gl_accounts ga
LEFT JOIN journal_entry_lines jel ON ga.id = jel.gl_account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE ga.is_active = 1 AND (je.is_posted = 1 OR je.id IS NULL)
GROUP BY ga.id, ga.account_number, ga.account_name, ga.account_type
HAVING ABS(SUM(COALESCE(jel.debit_minor, 0)) - SUM(COALESCE(jel.credit_minor, 0))) > 0
ORDER BY ga.account_number;

-- v_account_activity (from 20250102000005 — unchanged)
CREATE VIEW v_account_activity AS
SELECT
    ga.account_number,
    ga.account_name,
    COUNT(DISTINCT at.id) AS transaction_count,
    COUNT(DISTINCT CASE WHEN at.is_reconciled = 0 THEN at.id END) AS unreconciled_count,
    MIN(at.transaction_date) AS earliest_transaction,
    MAX(at.transaction_date) AS latest_transaction,
    COUNT(DISTINCT at.token_id) AS distinct_tokens
FROM gl_accounts ga
LEFT JOIN accounting_transactions at ON ga.id = at.gl_account_id
WHERE ga.is_active = 1
GROUP BY ga.id, ga.account_number, ga.account_name
HAVING COUNT(DISTINCT at.id) > 0
ORDER BY ga.account_number;

-- v_balance_sheet (from 20260715000004 — unchanged)
CREATE VIEW v_balance_sheet AS
SELECT
    account_type,
    account_number,
    account_name,
    balance,
    CASE
        WHEN account_type = 'Asset' THEN 1
        WHEN account_type = 'Liability' THEN 2
        WHEN account_type = 'Equity' THEN 3
    END AS sort_order
FROM v_account_balances
WHERE account_type IN ('Asset', 'Liability', 'Equity')
    AND balance != 0
ORDER BY sort_order, account_number;

-- v_income_statement — UPDATED to include 'Revenue'
CREATE VIEW v_income_statement AS
SELECT
    account_type,
    account_number,
    account_name,
    balance,
    CASE
        WHEN account_type IN ('Income', 'Revenue') THEN 1
        WHEN account_type = 'Expense' THEN 2
    END AS sort_order
FROM v_account_balances
WHERE account_type IN ('Income', 'Revenue', 'Expense')
    AND balance != 0
ORDER BY sort_order, account_number;

-- v_token_holdings (from 20250102000005 — unchanged)
CREATE VIEW v_token_holdings AS
SELECT
    t.id AS token_id,
    t.symbol,
    t.name AS token_name,
    t.chain_id,
    c.chain_name,
    t.digital_asset_type,
    SUM(tb.net_quantity) AS total_quantity,
    (SELECT ph.price_usd
     FROM price_history ph
     WHERE ph.token_id = t.id
     ORDER BY ph.price_date DESC
     LIMIT 1) AS latest_price_usd,
    SUM(tb.net_quantity) * (SELECT ph.price_usd
                            FROM price_history ph
                            WHERE ph.token_id = t.id
                            ORDER BY ph.price_date DESC
                            LIMIT 1) AS current_value_usd,
    SUM(tb.total_value_usd) AS total_cost_basis_usd,
    (SUM(tb.net_quantity) * (SELECT ph.price_usd FROM price_history ph WHERE ph.token_id = t.id ORDER BY ph.price_date DESC LIMIT 1)) - SUM(tb.total_value_usd) AS unrealized_gain_loss_usd
FROM v_token_balances tb
JOIN tokens t ON tb.token_id = t.id
JOIN chains c ON t.chain_id = c.chain_id
WHERE tb.net_quantity > 0
GROUP BY t.id, t.symbol, t.name, t.chain_id, c.chain_name, t.digital_asset_type;

-- v_portfolio_performance (from 20250102000005 — unchanged)
CREATE VIEW v_portfolio_performance AS
SELECT
    DATE(ph.price_date) AS snapshot_date,
    SUM(tb.net_quantity * ph.price_usd) AS total_portfolio_value_usd,
    COUNT(DISTINCT tb.token_id) AS number_of_tokens_held
FROM v_token_balances tb
JOIN price_history ph ON tb.token_id = ph.token_id
WHERE tb.net_quantity > 0
GROUP BY DATE(ph.price_date)
ORDER BY snapshot_date DESC;

PRAGMA foreign_keys = ON;
