-- MVP Currency Setup (Phase 1) - Polkadot Hackathon
-- Support only: USD, EUR, GBP, DOT, KSM, GLMR, ASTR, BNC, iBTC, USDT, USDC

-- Create currencies table for MVP
CREATE TABLE IF NOT EXISTS currencies_mvp (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,          -- Currency code (USD, DOT, etc)
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('fiat', 'crypto')),
    decimals INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,

    -- Price feed configuration
    coingecko_id TEXT,                  -- For CoinGecko API
    fixer_id TEXT,                      -- For Fixer.io API

    -- Display
    symbol TEXT,

    -- Polkadot/Substrate specific
    is_substrate BOOLEAN DEFAULT 0,
    chain_id TEXT,                      -- e.g., 'polkadot', 'kusama'

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_currencies_mvp_code ON currencies_mvp(code);

-- Insert MVP currencies only
INSERT INTO currencies_mvp (id, code, name, type, decimals, is_active, coingecko_id, fixer_id, symbol, is_substrate, chain_id) VALUES
    -- Fiat currencies
    ('usd', 'USD', 'US Dollar', 'fiat', 2, 1, NULL, 'USD', '$', 0, NULL),
    ('eur', 'EUR', 'Euro', 'fiat', 2, 1, NULL, 'EUR', '€', 0, NULL),
    ('gbp', 'GBP', 'British Pound', 'fiat', 2, 1, NULL, 'GBP', '£', 0, NULL),

    -- Polkadot ecosystem
    ('dot', 'DOT', 'Polkadot', 'crypto', 10, 1, 'polkadot', NULL, 'DOT', 1, 'polkadot'),
    ('ksm', 'KSM', 'Kusama', 'crypto', 12, 1, 'kusama', NULL, 'KSM', 1, 'kusama'),
    ('glmr', 'GLMR', 'Moonbeam', 'crypto', 18, 1, 'moonbeam', NULL, 'GLMR', 1, 'moonbeam'),
    ('astr', 'ASTR', 'Astar', 'crypto', 18, 1, 'astar', NULL, 'ASTR', 1, 'astar'),
    ('bnc', 'BNC', 'Bifrost', 'crypto', 12, 1, 'bifrost-native-coin', NULL, 'BNC', 1, 'bifrost'),
    ('ibtc', 'iBTC', 'Interlay Bitcoin', 'crypto', 8, 1, 'interbtc', NULL, 'iBTC', 1, 'interlay'),

    -- Stablecoins
    ('usdt', 'USDT', 'Tether USD', 'crypto', 6, 1, 'tether', NULL, '$', 0, NULL),
    ('usdc', 'USDC', 'USD Coin', 'crypto', 6, 1, 'usd-coin', NULL, '$', 0, NULL);

-- Create exchange_rates table with improved precision
CREATE TABLE IF NOT EXISTS exchange_rates_mvp (
    id TEXT PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate TEXT NOT NULL,                 -- DECIMAL(36,18) stored as TEXT
    timestamp DATETIME NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('coingecko', 'fixer', 'manual', 'calculated')),
    ttl_seconds INTEGER NOT NULL DEFAULT 300,

    -- Metadata for debugging
    metadata TEXT,                      -- JSON

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (from_currency) REFERENCES currencies_mvp(code),
    FOREIGN KEY (to_currency) REFERENCES currencies_mvp(code)
);

-- Composite index for efficient rate lookups
CREATE INDEX IF NOT EXISTS idx_exchange_rates_mvp_pair
ON exchange_rates_mvp(from_currency, to_currency, timestamp DESC);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_exchange_rates_mvp_timestamp
ON exchange_rates_mvp(timestamp);

-- Create account_currency_settings table (one per organization)
CREATE TABLE IF NOT EXISTS account_currency_settings (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL UNIQUE,
    primary_currency TEXT NOT NULL DEFAULT 'USD',
    conversion_method TEXT NOT NULL DEFAULT 'historical' CHECK(conversion_method IN ('spot', 'historical', 'fixed')),

    -- Display preferences
    decimal_places INTEGER NOT NULL DEFAULT 2,
    use_thousands_separator BOOLEAN NOT NULL DEFAULT 1,

    -- API keys (encrypted)
    coingecko_api_key TEXT,
    fixer_api_key TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (profile_id) REFERENCES profiles(id),
    FOREIGN KEY (primary_currency) REFERENCES currencies_mvp(code)
);

-- Update transactions table to use high-precision decimals
ALTER TABLE transactions ADD COLUMN original_amount TEXT;      -- DECIMAL(36,18) as TEXT
ALTER TABLE transactions ADD COLUMN original_currency TEXT;     -- Currency code
ALTER TABLE transactions ADD COLUMN converted_amount TEXT;      -- DECIMAL(36,18) as TEXT
ALTER TABLE transactions ADD COLUMN conversion_rate TEXT;       -- DECIMAL(36,18) as TEXT
ALTER TABLE transactions ADD COLUMN rate_timestamp DATETIME;    -- When rate was fetched
ALTER TABLE transactions ADD COLUMN rate_source TEXT;           -- coingecko, fixer, etc

-- Index for currency operations
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(original_currency);
CREATE INDEX IF NOT EXISTS idx_transactions_rate_timestamp ON transactions(rate_timestamp);

-- Create XCM transfer tracking table for Polkadot cross-chain transfers
CREATE TABLE IF NOT EXISTS xcm_transfers (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,

    -- Source chain info
    from_chain_id TEXT NOT NULL,
    from_address TEXT NOT NULL,

    -- Destination chain info
    to_chain_id TEXT NOT NULL,
    to_address TEXT NOT NULL,

    -- Asset info
    asset_id TEXT NOT NULL,             -- Can be currency code or parachain asset ID
    amount TEXT NOT NULL,               -- DECIMAL(36,18)

    -- Status tracking
    status TEXT NOT NULL CHECK(status IN ('pending', 'in_transit', 'completed', 'failed')),

    -- Hops (for multi-hop XCM)
    hops TEXT,                          -- JSON array of intermediate chains

    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_xcm_transfers_transaction ON xcm_transfers(transaction_id);
CREATE INDEX IF NOT EXISTS idx_xcm_transfers_chains ON xcm_transfers(from_chain_id, to_chain_id);

-- Create parachain_tokens table for dynamic token tracking
CREATE TABLE IF NOT EXISTS parachain_tokens (
    id TEXT PRIMARY KEY,
    chain_id TEXT NOT NULL,             -- e.g., 'moonbeam', 'astar'
    asset_id TEXT NOT NULL,             -- Parachain-specific asset ID
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 18,
    is_active BOOLEAN NOT NULL DEFAULT 1,

    -- Pricing
    coingecko_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(chain_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_parachain_tokens_chain ON parachain_tokens(chain_id);
CREATE INDEX IF NOT EXISTS idx_parachain_tokens_symbol ON parachain_tokens(symbol);

-- Insert some initial exchange rates for testing
INSERT INTO exchange_rates_mvp (id, from_currency, to_currency, rate, timestamp, source, ttl_seconds) VALUES
    ('usd-eur-init', 'USD', 'EUR', '0.92', datetime('now'), 'fixer', 86400),
    ('usd-gbp-init', 'USD', 'GBP', '0.79', datetime('now'), 'fixer', 86400),
    ('dot-usd-init', 'DOT', 'USD', '7.50', datetime('now'), 'coingecko', 300),
    ('ksm-usd-init', 'KSM', 'USD', '45.00', datetime('now'), 'coingecko', 300),
    ('glmr-usd-init', 'GLMR', 'USD', '0.30', datetime('now'), 'coingecko', 300),
    ('astr-usd-init', 'ASTR', 'USD', '0.07', datetime('now'), 'coingecko', 300),
    ('bnc-usd-init', 'BNC', 'USD', '0.30', datetime('now'), 'coingecko', 300),
    ('ibtc-usd-init', 'iBTC', 'USD', '67000.00', datetime('now'), 'coingecko', 300),
    ('usdt-usd-init', 'USDT', 'USD', '1.00', datetime('now'), 'coingecko', 300),
    ('usdc-usd-init', 'USDC', 'USD', '1.00', datetime('now'), 'coingecko', 300);
