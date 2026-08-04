-- =============================================================================
-- BANK & CARD TRANSACTION CAPTURE — SCHEMA LAYER (GIV-825)
--
-- Phase 1 file-import tables per PRD §5 (GIV-821, approved 2026-08-04).
-- Amount sign convention: signed decimal string (debits negative, credits
-- positive). No 'direction' column. Board-locked decision.
-- =============================================================================

-- Bank / card accounts registered by the user
CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    institution_name TEXT NOT NULL,
    account_nickname TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN (
        'checking', 'savings', 'credit_card',
        'money_market', 'line_of_credit', 'other'
    )),
    currency TEXT NOT NULL,
    gl_account_number TEXT NOT NULL DEFAULT '1000',
    external_source TEXT,
    external_account_id TEXT,
    masked_account_number TEXT,
    opening_balance TEXT,
    opening_balance_date INTEGER,
    entity_id TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ba_institution
    ON bank_accounts(institution_name);
CREATE INDEX IF NOT EXISTS idx_ba_entity
    ON bank_accounts(entity_id);

-- Individual bank / card transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    external_id TEXT,
    posted_date INTEGER NOT NULL,
    transaction_date INTEGER,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    payee TEXT,
    memo TEXT,
    reference_number TEXT,
    tx_type TEXT,
    running_balance TEXT,
    classification_status TEXT NOT NULL DEFAULT 'unclassified'
        CHECK (classification_status IN ('unclassified', 'classified', 'ignored', 'split')),
    classification_note TEXT,
    raw_data TEXT,
    import_batch_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Partial unique index: dedup on external_id when present (OFX FITID),
-- allow NULLs for CSV rows that compute a hash-based id instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bt_external_dedup
    ON bank_transactions(bank_account_id, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bt_account
    ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bt_posted
    ON bank_transactions(posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_bt_account_posted
    ON bank_transactions(bank_account_id, posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_bt_batch
    ON bank_transactions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_bt_classification
    ON bank_transactions(classification_status);

-- Import batch tracking (supports undo / re-import dedup)
CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    filename TEXT,
    format TEXT,
    imported_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    row_count INTEGER,
    duplicate_count INTEGER,
    status TEXT NOT NULL DEFAULT 'staged'
        CHECK (status IN ('staged', 'confirmed', 'reverted'))
);

CREATE INDEX IF NOT EXISTS idx_ib_account
    ON import_batches(bank_account_id);

-- Saved CSV column mappings per institution
CREATE TABLE IF NOT EXISTS statement_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    institution_name TEXT,
    column_map TEXT,
    date_format TEXT,
    amount_sign_convention TEXT,
    currency_default TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Update-timestamp triggers
CREATE TRIGGER IF NOT EXISTS ba_update_timestamp
AFTER UPDATE ON bank_accounts
BEGIN
    UPDATE bank_accounts
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS bt_update_timestamp
AFTER UPDATE ON bank_transactions
BEGIN
    UPDATE bank_transactions
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS sp_update_timestamp
AFTER UPDATE ON statement_profiles
BEGIN
    UPDATE statement_profiles
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;
