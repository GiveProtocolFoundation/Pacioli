-- Add price_at_acquisition_usd to transactions table
-- Stores the USD price per token unit at the time of acquisition.
-- Used by buildLotsFromTransactions to compute accurate cost basis
-- instead of the previous fee-as-proxy workaround.
ALTER TABLE transactions ADD COLUMN price_at_acquisition_usd TEXT;
