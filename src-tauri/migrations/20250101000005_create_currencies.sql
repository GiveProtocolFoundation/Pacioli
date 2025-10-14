-- Create currencies table for supported currencies
CREATE TABLE IF NOT EXISTS currencies (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,  -- ISO code for fiat (USD, EUR) or ticker for crypto (BTC, ETH)
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('fiat', 'crypto')),
    decimals INTEGER NOT NULL DEFAULT 2,
    is_supported BOOLEAN NOT NULL DEFAULT 1,  -- For phased rollout
    coingecko_id TEXT,  -- For crypto price feeds from CoinGecko
    fixer_id TEXT,  -- For fiat exchange rates from Fixer
    symbol TEXT,  -- Display symbol (e.g., $, €, ₿)
    icon_url TEXT,  -- URL to currency icon
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS idx_currencies_type ON currencies(type);

-- Insert common cryptocurrencies - Polkadot ecosystem focus
INSERT INTO currencies (id, code, name, type, decimals, is_supported, coingecko_id, symbol) VALUES
    ('eth', 'ETH', 'Ethereum', 'crypto', 18, 1, 'ethereum', 'Ξ'),
    ('usdc', 'USDC', 'USD Coin', 'crypto', 6, 1, 'usd-coin', '$'),
    ('usdt', 'USDT', 'Tether', 'crypto', 6, 1, 'tether', '$'),
    ('dot', 'DOT', 'Polkadot', 'crypto', 10, 1, 'polkadot', 'DOT'),
    ('ksm', 'KSM', 'Kusama', 'crypto', 12, 1, 'kusama', 'KSM'),
    ('glmr', 'GLMR', 'Moonbeam', 'crypto', 18, 1, 'moonbeam', 'GLMR'),
    ('astr', 'ASTR', 'Astar', 'crypto', 18, 1, 'astar', 'ASTR'),
    ('bnc', 'BNC', 'Bifrost', 'crypto', 12, 1, 'bifrost-native-coin', 'BNC'),
    ('ibtc', 'iBTC', 'Interlay Bitcoin', 'crypto', 8, 1, 'interbtc', 'iBTC');

-- Insert common fiat currencies
INSERT INTO currencies (id, code, name, type, decimals, is_supported, fixer_id, symbol) VALUES
    ('usd', 'USD', 'US Dollar', 'fiat', 2, 1, 'USD', '$'),
    ('eur', 'EUR', 'Euro', 'fiat', 2, 1, 'EUR', '€'),
    ('gbp', 'GBP', 'British Pound', 'fiat', 2, 1, 'GBP', '£'),
    ('jpy', 'JPY', 'Japanese Yen', 'fiat', 0, 1, 'JPY', '¥'),
    ('cad', 'CAD', 'Canadian Dollar', 'fiat', 2, 1, 'CAD', 'C$'),
    ('aud', 'AUD', 'Australian Dollar', 'fiat', 2, 1, 'AUD', 'A$'),
    ('chf', 'CHF', 'Swiss Franc', 'fiat', 2, 1, 'CHF', 'CHF'),
    ('cny', 'CNY', 'Chinese Yuan', 'fiat', 2, 1, 'CNY', '¥'),
    ('inr', 'INR', 'Indian Rupee', 'fiat', 2, 1, 'INR', '₹');
