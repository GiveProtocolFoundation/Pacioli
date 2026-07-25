-- =============================================================================
-- AUDIT-TRAIL FK: journal_entries → multi_chain_transactions (GIV-727)
--
-- Every posted journal entry that originates from a wallet transaction now
-- carries a hard foreign-key link back to its source on-chain tx.
-- Manual JEs (no wallet source) carry NULL and work without breakage.
-- =============================================================================

-- 1. Add source_tx_id FK on journal_entries header.
--    Points to multi_chain_transactions(id) which is the composite
--    "chain_id_txhash" text primary key.
ALTER TABLE journal_entries
    ADD COLUMN source_tx_id TEXT REFERENCES multi_chain_transactions(id);

-- 2. Index for fast lookups and JE → source-tx drill-down.
CREATE INDEX IF NOT EXISTS idx_journal_entries_source_tx
    ON journal_entries(source_tx_id);

-- 3. Backfill existing rule-originated entries.
--    auto_classify_transaction sets reference_number = bare tx hash and
--    origin = 'rule'. Match against multi_chain_transactions.transaction_hash
--    to recover the composite ID.
UPDATE journal_entries
SET source_tx_id = (
    SELECT mct.id
    FROM multi_chain_transactions mct
    WHERE mct.transaction_hash = journal_entries.reference_number
    LIMIT 1
)
WHERE origin = 'rule'
  AND reference_number IS NOT NULL
  AND source_tx_id IS NULL;
