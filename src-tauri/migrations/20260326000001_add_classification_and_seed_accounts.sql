-- =============================================================================
-- CLASSIFICATION STATUS & DEFAULT CHART OF ACCOUNTS
-- Links raw blockchain transactions to the accounting layer
-- =============================================================================

-- Add classification_status to multi_chain_transactions
-- Tracks whether a raw blockchain transaction has been mapped to journal entries
ALTER TABLE multi_chain_transactions ADD COLUMN
    classification_status TEXT NOT NULL DEFAULT 'unclassified'
    CHECK (classification_status IN ('unclassified', 'classified', 'ignored', 'split'));

CREATE INDEX IF NOT EXISTS idx_mct_classification
    ON multi_chain_transactions(classification_status);

-- Seed a default crypto-aware chart of accounts
-- Uses the existing gl_accounts table (account_type: Asset/Liability/Equity/Income/Expense)
-- Only inserts if no accounts exist yet

INSERT OR IGNORE INTO gl_accounts (account_number, account_name, account_type, normal_balance, is_editable, description) VALUES
    -- Assets
    ('1000', 'Cash and Bank Accounts',    'Asset',     'debit',  0, 'Fiat currency held in bank accounts'),
    ('1100', 'Accounts Receivable',       'Asset',     'debit',  0, 'Amounts owed to the organization'),
    ('1200', 'Crypto Assets',             'Asset',     'debit',  0, 'General crypto asset holdings'),
    ('1210', 'DOT Holdings',              'Asset',     'debit',  1, 'Polkadot native token holdings'),
    ('1220', 'ETH Holdings',              'Asset',     'debit',  1, 'Ethereum native token holdings'),
    ('1230', 'Staked Assets',             'Asset',     'debit',  1, 'Tokens locked in staking'),
    ('1240', 'LP Token Holdings',         'Asset',     'debit',  1, 'Liquidity pool token holdings'),
    -- Liabilities
    ('2000', 'Accounts Payable',          'Liability', 'credit', 0, 'Amounts owed to vendors or counterparties'),
    ('2100', 'Accrued Liabilities',       'Liability', 'credit', 0, 'Obligations incurred but not yet paid'),
    -- Equity
    ('3000', 'Opening Equity',            'Equity',    'credit', 0, 'Initial equity from opening balances'),
    ('3100', 'Retained Earnings',         'Equity',    'credit', 0, 'Accumulated net income'),
    -- Income
    ('4000', 'Income',                    'Income',    'credit', 0, 'General income'),
    ('4100', 'Staking Income',            'Income',    'credit', 1, 'Rewards earned from staking'),
    ('4200', 'Trading Gains',             'Income',    'credit', 1, 'Gains from token trading'),
    ('4300', 'Donation Income',           'Income',    'credit', 1, 'Donations and grants received'),
    ('4400', 'Airdrop Income',            'Income',    'credit', 1, 'Value of airdropped tokens'),
    ('4500', 'Interest Income',           'Income',    'credit', 1, 'Interest earned from lending or DeFi'),
    -- Expenses
    ('5000', 'Expenses',                  'Expense',   'debit',  0, 'General expenses'),
    ('5100', 'Network Fees',              'Expense',   'debit',  1, 'Gas fees and transaction costs'),
    ('5200', 'Trading Losses',            'Expense',   'debit',  1, 'Losses from token trading'),
    ('5300', 'Software Subscriptions',    'Expense',   'debit',  1, 'Software and tool subscriptions');
