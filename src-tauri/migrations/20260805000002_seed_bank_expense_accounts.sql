-- Seed NGO-realistic expense accounts referenced by bank starter rules (GIV-856).
-- The payee-rules migration (20260805000001) introduced starter bank rules that
-- debit 6100/6200/6300, but those accounts were missing from the original seed.

INSERT OR IGNORE INTO gl_accounts
    (account_number, account_name, account_type, normal_balance, is_editable, description)
VALUES
    ('6100', 'Payroll Expense',     'Expense', 'debit', 1, 'Staff salaries, wages, and payroll-processor fees'),
    ('6200', 'Software / SaaS',    'Expense', 'debit', 1, 'Software subscriptions and cloud services'),
    ('6300', 'Utilities',           'Expense', 'debit', 1, 'Electric, water, gas, and other utility bills');
