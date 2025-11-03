-- =============================================================================
-- ACCOUNTING VIEWS FOR FINANCIAL REPORTING
-- Multi-Token Balance Sheet, Income Statement, and Portfolio Reports
-- =============================================================================

-- Token Balances View (Subsidiary Ledger)
CREATE VIEW IF NOT EXISTS v_token_balances AS
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

-- Account Balances View (General Ledger - Aggregated across all tokens)
CREATE VIEW IF NOT EXISTS v_account_balances AS
SELECT
    ga.id AS account_id,
    ga.account_number,
    ga.account_name,
    ga.account_type,
    ga.digital_asset_type,
    ga.normal_balance,
    COALESCE(SUM(jel.debit_amount), 0) AS total_debits,
    COALESCE(SUM(jel.credit_amount), 0) AS total_credits,
    CASE
        WHEN ga.normal_balance = 'debit' THEN COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
        ELSE COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
    END AS balance,
    CASE
        WHEN ga.account_type IN ('Asset', 'Expense') THEN COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
        ELSE COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
    END AS balance_signed
FROM gl_accounts ga
LEFT JOIN journal_entry_lines jel ON ga.id = jel.gl_account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE ga.is_active = 1 AND (je.is_posted = 1 OR je.id IS NULL)
GROUP BY ga.id, ga.account_number, ga.account_name, ga.account_type, ga.normal_balance;

-- Token Holdings Summary (Portfolio View)
CREATE VIEW IF NOT EXISTS v_token_holdings AS
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

-- Balance Sheet View
CREATE VIEW IF NOT EXISTS v_balance_sheet AS
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

-- Income Statement View
CREATE VIEW IF NOT EXISTS v_income_statement AS
SELECT
    account_type,
    account_number,
    account_name,
    balance,
    CASE
        WHEN account_type = 'Income' THEN 1
        WHEN account_type = 'Expense' THEN 2
    END AS sort_order
FROM v_account_balances
WHERE account_type IN ('Income', 'Expense')
    AND balance != 0
ORDER BY sort_order, account_number;

-- Realized Gains/Losses Summary View
CREATE VIEW IF NOT EXISTS v_gains_losses_summary AS
SELECT
    t.symbol,
    t.name AS token_name,
    rgl.tax_year,
    rgl.is_long_term,
    CASE WHEN rgl.is_long_term = 1 THEN 'Long-Term' ELSE 'Short-Term' END AS holding_period,
    SUM(rgl.quantity) AS total_quantity_disposed,
    SUM(rgl.proceeds) AS total_proceeds,
    SUM(rgl.cost_basis) AS total_cost_basis,
    SUM(rgl.realized_gain_loss) AS total_gain_loss,
    COUNT(*) AS number_of_disposals
FROM realized_gains_losses rgl
JOIN tokens t ON rgl.token_id = t.id
GROUP BY t.symbol, t.name, rgl.tax_year, rgl.is_long_term
ORDER BY rgl.tax_year DESC, t.symbol, rgl.is_long_term DESC;

-- Open Tax Lots View
CREATE VIEW IF NOT EXISTS v_open_tax_lots AS
SELECT
    tl.id AS lot_id,
    t.symbol,
    t.name AS token_name,
    t.chain_id,
    tl.acquired_date,
    tl.quantity AS original_quantity,
    tl.remaining_quantity,
    tl.cost_basis,
    tl.cost_basis / NULLIF(tl.quantity, 0) AS cost_per_unit,
    tl.cost_basis_method,
    (SELECT ph.price_usd
     FROM price_history ph
     WHERE ph.token_id = t.id
     ORDER BY ph.price_date DESC
     LIMIT 1) AS current_price_usd,
    tl.remaining_quantity * (SELECT ph.price_usd FROM price_history ph WHERE ph.token_id = t.id ORDER BY ph.price_date DESC LIMIT 1) AS current_value_usd,
    (tl.remaining_quantity * (SELECT ph.price_usd FROM price_history ph WHERE ph.token_id = t.id ORDER BY ph.price_date DESC LIMIT 1)) - (tl.cost_basis * (tl.remaining_quantity / NULLIF(tl.quantity, 0))) AS unrealized_gain_loss,
    julianday('now') - julianday(tl.acquired_date) AS days_held
FROM transaction_lots tl
JOIN tokens t ON tl.token_id = t.id
WHERE tl.is_closed = 0 AND tl.remaining_quantity > 0
ORDER BY t.symbol, tl.acquired_date;

-- General Ledger View (Complete Transaction History)
CREATE VIEW IF NOT EXISTS v_general_ledger AS
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

-- Trial Balance View
CREATE VIEW IF NOT EXISTS v_trial_balance AS
SELECT
    ga.account_number,
    ga.account_name,
    ga.account_type,
    CASE
        WHEN SUM(jel.debit_amount) - SUM(jel.credit_amount) > 0
        THEN SUM(jel.debit_amount) - SUM(jel.credit_amount)
        ELSE 0
    END AS debit_balance,
    CASE
        WHEN SUM(jel.credit_amount) - SUM(jel.debit_amount) > 0
        THEN SUM(jel.credit_amount) - SUM(jel.debit_amount)
        ELSE 0
    END AS credit_balance
FROM gl_accounts ga
LEFT JOIN journal_entry_lines jel ON ga.id = jel.gl_account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE ga.is_active = 1 AND (je.is_posted = 1 OR je.id IS NULL)
GROUP BY ga.id, ga.account_number, ga.account_name, ga.account_type
HAVING ABS(SUM(COALESCE(jel.debit_amount, 0)) - SUM(COALESCE(jel.credit_amount, 0))) > 0.01
ORDER BY ga.account_number;

-- Portfolio Performance View (Daily Snapshots)
CREATE VIEW IF NOT EXISTS v_portfolio_performance AS
SELECT
    DATE(ph.price_date) AS snapshot_date,
    SUM(tb.net_quantity * ph.price_usd) AS total_portfolio_value_usd,
    COUNT(DISTINCT tb.token_id) AS number_of_tokens_held
FROM v_token_balances tb
JOIN price_history ph ON tb.token_id = ph.token_id
WHERE tb.net_quantity > 0
GROUP BY DATE(ph.price_date)
ORDER BY snapshot_date DESC;

-- Tax Summary View (Annual)
CREATE VIEW IF NOT EXISTS v_tax_summary AS
SELECT
    rgl.tax_year,
    SUM(CASE WHEN rgl.is_long_term = 1 AND rgl.realized_gain_loss > 0 THEN rgl.realized_gain_loss ELSE 0 END) AS long_term_gains,
    SUM(CASE WHEN rgl.is_long_term = 1 AND rgl.realized_gain_loss < 0 THEN rgl.realized_gain_loss ELSE 0 END) AS long_term_losses,
    SUM(CASE WHEN rgl.is_long_term = 0 AND rgl.realized_gain_loss > 0 THEN rgl.realized_gain_loss ELSE 0 END) AS short_term_gains,
    SUM(CASE WHEN rgl.is_long_term = 0 AND rgl.realized_gain_loss < 0 THEN rgl.realized_gain_loss ELSE 0 END) AS short_term_losses,
    SUM(rgl.realized_gain_loss) AS net_capital_gain_loss,
    SUM(rgl.proceeds) AS total_proceeds,
    SUM(rgl.cost_basis) AS total_cost_basis
FROM realized_gains_losses rgl
GROUP BY rgl.tax_year
ORDER BY rgl.tax_year DESC;

-- Account Activity Summary (for reconciliation)
CREATE VIEW IF NOT EXISTS v_account_activity AS
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
