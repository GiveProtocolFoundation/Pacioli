-- =============================================================================
-- UPDATE ACCOUNTING VIEWS TO USE MINOR-UNIT COLUMNS (GIV-673, Phase 1)
--
-- Replaces v_account_balances and v_trial_balance to use debit_minor/credit_minor
-- (INTEGER, USD cents) instead of debit_amount/credit_amount (DECIMAL, floats).
-- Other views (v_general_ledger, etc.) keep legacy columns as they serve display.
-- =============================================================================

-- Rebuild v_account_balances using minor units
DROP VIEW IF EXISTS v_account_balances;
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

-- Rebuild v_trial_balance using minor units (exact integer comparison)
DROP VIEW IF EXISTS v_trial_balance;
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

-- Rebuild balance sheet and income statement views (they depend on v_account_balances)
DROP VIEW IF EXISTS v_balance_sheet;
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

DROP VIEW IF EXISTS v_income_statement;
CREATE VIEW v_income_statement AS
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
