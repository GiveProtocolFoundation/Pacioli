-- Add USD price-at-acquisition and valuation tracking to multi_chain_transactions.
-- Enables the classification engine to write USD-denominated journal entries
-- instead of treating raw token quantities as dollar amounts (GIV-722).

ALTER TABLE multi_chain_transactions
    ADD COLUMN price_at_acquisition_usd TEXT;

ALTER TABLE multi_chain_transactions
    ADD COLUMN valuation_status TEXT NOT NULL DEFAULT 'unpriced';
