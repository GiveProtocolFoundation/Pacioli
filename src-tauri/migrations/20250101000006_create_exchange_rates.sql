-- Create exchange_rates table for caching currency conversion rates
CREATE TABLE IF NOT EXISTS exchange_rates (
    id TEXT PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate TEXT NOT NULL,  -- Stored as TEXT to preserve decimal precision
    timestamp DATETIME NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('coingecko', 'fixer', 'manual', 'compound')),
    -- compound rates are calculated from multiple sources (e.g., BTC->ETH via USD)
    ttl_seconds INTEGER NOT NULL DEFAULT 300,  -- Time to live: 300s (5 min) for crypto, 86400s (24h) for fiat
    metadata TEXT,  -- JSON field for additional data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_currency) REFERENCES currencies(code),
    FOREIGN KEY (to_currency) REFERENCES currencies(code)
);

-- Create composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair
ON exchange_rates(from_currency, to_currency, timestamp DESC);

-- Create index for timestamp-based cleanup of stale rates
CREATE INDEX IF NOT EXISTS idx_exchange_rates_timestamp
ON exchange_rates(timestamp);

-- Create index for source filtering
CREATE INDEX IF NOT EXISTS idx_exchange_rates_source
ON exchange_rates(source);

-- Insert some initial USD-based exchange rates as examples
-- These would normally be fetched from APIs - Polkadot ecosystem focus
INSERT INTO exchange_rates (id, from_currency, to_currency, rate, timestamp, source, ttl_seconds) VALUES
    ('usd-eur-initial', 'USD', 'EUR', '0.92', datetime('now'), 'fixer', 86400),
    ('usd-gbp-initial', 'USD', 'GBP', '0.79', datetime('now'), 'fixer', 86400),
    ('usd-jpy-initial', 'USD', 'JPY', '149.50', datetime('now'), 'fixer', 86400),
    ('dot-usd-initial', 'DOT', 'USD', '7.50', datetime('now'), 'coingecko', 300),
    ('ksm-usd-initial', 'KSM', 'USD', '45.00', datetime('now'), 'coingecko', 300),
    ('glmr-usd-initial', 'GLMR', 'USD', '0.30', datetime('now'), 'coingecko', 300),
    ('astr-usd-initial', 'ASTR', 'USD', '0.07', datetime('now'), 'coingecko', 300),
    ('bnc-usd-initial', 'BNC', 'USD', '0.30', datetime('now'), 'coingecko', 300),
    ('ibtc-usd-initial', 'iBTC', 'USD', '67000.00', datetime('now'), 'coingecko', 300),
    ('eth-usd-initial', 'ETH', 'USD', '3000.00', datetime('now'), 'coingecko', 300);
