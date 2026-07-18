-- =============================================================================
-- PHASE 4A: DESCRIPTIVE COLUMN NAMING (GIV-712)
-- Renames developer-shorthand columns to human-readable names per
-- Stage 1 mandate scope item 4.  All renames use ALTER TABLE ... RENAME
-- COLUMN (supported since SQLite 3.25.0 / 2018-09-15).
-- =============================================================================

-- multi_chain_transactions: rename shorthand columns
ALTER TABLE multi_chain_transactions RENAME COLUMN hash TO transaction_hash;
ALTER TABLE multi_chain_transactions RENAME COLUMN tx_type TO transaction_type;
ALTER TABLE multi_chain_transactions RENAME COLUMN value TO transfer_value;
ALTER TABLE multi_chain_transactions RENAME COLUMN fee TO transaction_fee;
ALTER TABLE multi_chain_transactions RENAME COLUMN raw_data TO raw_json_data;

-- Add wallet_address for import-source provenance tracking.
-- Existing rows get empty string; new imports populate this from the
-- requesting wallet address so the same on-chain tx can appear in
-- multiple wallet imports without duplication ambiguity.
ALTER TABLE multi_chain_transactions ADD COLUMN wallet_address TEXT NOT NULL DEFAULT '';

-- Create index on wallet_address for efficient per-wallet queries
CREATE INDEX IF NOT EXISTS idx_mct_wallet_address
    ON multi_chain_transactions(wallet_address);

-- token_transfers: rename value to transfer_amount
ALTER TABLE token_transfers RENAME COLUMN value TO transfer_amount;
