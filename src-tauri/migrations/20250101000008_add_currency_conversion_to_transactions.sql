-- Add currency conversion fields to transactions table
-- These fields store the converted amounts and exchange rates used

-- Add amount_primary column (converted to primary/reporting currency)
ALTER TABLE transactions ADD COLUMN amount_primary TEXT;

-- Add primary_currency column (the currency used for conversion)
ALTER TABLE transactions ADD COLUMN primary_currency TEXT DEFAULT 'USD';

-- Add exchange_rate column (the rate used for conversion)
ALTER TABLE transactions ADD COLUMN exchange_rate TEXT;

-- Add exchange_rate_source column (where the rate came from)
ALTER TABLE transactions ADD COLUMN exchange_rate_source TEXT;

-- Add exchange_rate_timestamp column (when the rate was fetched)
ALTER TABLE transactions ADD COLUMN exchange_rate_timestamp DATETIME;

-- Note: SQLite doesn't support adding FOREIGN KEY constraints via ALTER TABLE
-- But we can create indexes to improve performance

-- Create index for currency lookups
CREATE INDEX IF NOT EXISTS idx_transactions_token_symbol
ON transactions(token_symbol);

-- Create index for primary currency lookups
CREATE INDEX IF NOT EXISTS idx_transactions_primary_currency
ON transactions(primary_currency);

-- Create index for transaction timestamp (useful for historical rate lookups)
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp
ON transactions(timestamp);

-- Create a view for transactions with their converted amounts
CREATE VIEW IF NOT EXISTS transactions_with_conversions AS
SELECT
    t.*,
    c.name AS currency_name,
    c.type AS currency_type,
    c.symbol AS currency_symbol,
    CASE
        WHEN t.exchange_rate IS NOT NULL AND t.exchange_rate != ''
        THEN CAST(t.value AS REAL) * CAST(t.exchange_rate AS REAL)
        ELSE CAST(t.value AS REAL)
    END AS calculated_primary_amount
FROM transactions t
LEFT JOIN currencies c ON t.token_symbol = c.code;
