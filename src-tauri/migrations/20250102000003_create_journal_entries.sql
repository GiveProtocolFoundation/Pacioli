-- =============================================================================
-- JOURNAL ENTRIES AND ACCOUNTING TRANSACTIONS
-- Double-Entry Bookkeeping with Subsidiary Ledger for Tokens
-- =============================================================================

-- Accounting Transactions (Subsidiary Ledger for Token-Level Detail)
CREATE TABLE IF NOT EXISTS accounting_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_date DATETIME NOT NULL,
    gl_account_id INTEGER NOT NULL,
    token_id INTEGER NOT NULL,
    quantity DECIMAL(36, 18) NOT NULL,
    unit_price DECIMAL(18, 8),
    total_value DECIMAL(18, 2),
    transaction_type TEXT NOT NULL CHECK(transaction_type IN (
        'purchase', 'sale', 'transfer_in', 'transfer_out',
        'stake', 'unstake', 'reward', 'fee',
        'swap_in', 'swap_out', 'lp_deposit', 'lp_withdraw',
        'airdrop', 'gift_received', 'gift_sent', 'donation',
        'loan_borrowed', 'loan_repaid', 'interest_earned', 'interest_paid',
        'other'
    )),
    chain_id TEXT NOT NULL,
    wallet_address TEXT,
    txn_hash TEXT,
    description TEXT,
    is_reconciled BOOLEAN DEFAULT 0,
    journal_entry_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gl_account_id) REFERENCES gl_accounts(id),
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    FOREIGN KEY (chain_id) REFERENCES chains(chain_id),
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_accounting_txn_date ON accounting_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_accounting_txn_account_token ON accounting_transactions(gl_account_id, token_id);
CREATE INDEX IF NOT EXISTS idx_accounting_txn_token_date ON accounting_transactions(token_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_accounting_txn_hash ON accounting_transactions(txn_hash);
CREATE INDEX IF NOT EXISTS idx_accounting_txn_journal ON accounting_transactions(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_txn_reconciled ON accounting_transactions(is_reconciled);

-- Journal Entries (General Ledger - Double-Entry Bookkeeping)
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_date DATETIME NOT NULL,
    entry_number TEXT UNIQUE,
    description TEXT,
    reference_number TEXT,
    is_posted BOOLEAN DEFAULT 1,
    is_reversed BOOLEAN DEFAULT 0,
    reversed_by_entry_id INTEGER,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reversed_by_entry_id) REFERENCES journal_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_number ON journal_entries(entry_number);
CREATE INDEX IF NOT EXISTS idx_journal_entries_posted ON journal_entries(is_posted);

-- Journal Entry Lines (Debits and Credits)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL,
    gl_account_id INTEGER NOT NULL,
    token_id INTEGER,
    debit_amount DECIMAL(18, 2) DEFAULT 0,
    credit_amount DECIMAL(18, 2) DEFAULT 0,
    description TEXT,
    line_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (gl_account_id) REFERENCES gl_accounts(id),
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0) OR (debit_amount = 0 AND credit_amount = 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_entry_lines(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_token ON journal_entry_lines(token_id);

-- Update triggers
CREATE TRIGGER IF NOT EXISTS accounting_transactions_update_timestamp
AFTER UPDATE ON accounting_transactions
BEGIN
    UPDATE accounting_transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS journal_entries_update_timestamp
AFTER UPDATE ON journal_entries
BEGIN
    UPDATE journal_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to validate journal entry balance
CREATE TRIGGER IF NOT EXISTS validate_journal_entry_balance
BEFORE UPDATE OF is_posted ON journal_entries
WHEN NEW.is_posted = 1
BEGIN
    SELECT CASE
        WHEN (
            SELECT ABS(SUM(debit_amount) - SUM(credit_amount))
            FROM journal_entry_lines
            WHERE journal_entry_id = NEW.id
        ) > 0.01
        THEN RAISE(ABORT, 'Journal entry debits must equal credits')
    END;
END;
