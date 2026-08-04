-- =============================================================================
-- BANK CLASSIFICATION QUEUE (GIV-828)
--
-- Extends the classification pipeline to accept bank_transactions as a source.
-- Adds audit-trail FK from journal_entries → bank_transactions, mirroring the
-- existing source_tx_id → multi_chain_transactions pattern (GIV-727).
-- =============================================================================

-- 1. Audit-trail FK: journal_entries → bank_transactions.
ALTER TABLE journal_entries
    ADD COLUMN source_bank_tx_id TEXT REFERENCES bank_transactions(id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_source_bank_tx
    ON journal_entries(source_bank_tx_id);
