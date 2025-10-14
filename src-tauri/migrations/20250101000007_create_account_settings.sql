-- Create account_settings table for currency preferences per organization/profile
CREATE TABLE IF NOT EXISTS account_settings (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL UNIQUE,  -- One setting per profile/organization
    primary_currency TEXT NOT NULL DEFAULT 'USD',  -- The main reporting currency
    -- Comma-separated list of additional reporting currencies
    reporting_currencies TEXT,  -- e.g., 'EUR,GBP,JPY'
    conversion_method TEXT NOT NULL DEFAULT 'spot' CHECK(conversion_method IN ('spot', 'historical', 'fixed')),
    -- spot: Use current exchange rate
    -- historical: Use exchange rate at transaction time
    -- fixed: Use manually set exchange rates

    -- Display preferences
    decimal_places INTEGER NOT NULL DEFAULT 2,
    use_thousands_separator BOOLEAN NOT NULL DEFAULT 1,
    currency_display_format TEXT NOT NULL DEFAULT 'symbol' CHECK(currency_display_format IN ('symbol', 'code', 'name')),
    -- symbol: $, €, £
    -- code: USD, EUR, GBP
    -- name: US Dollar, Euro, British Pound

    -- Auto-conversion settings
    auto_convert BOOLEAN NOT NULL DEFAULT 1,  -- Automatically convert to primary currency
    cache_exchange_rates BOOLEAN NOT NULL DEFAULT 1,  -- Cache rates for performance

    -- API configuration
    coingecko_api_key TEXT,
    fixer_api_key TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id),
    FOREIGN KEY (primary_currency) REFERENCES currencies(code)
);

-- Create index on profile_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_account_settings_profile
ON account_settings(profile_id);

-- Insert default settings for existing profiles
INSERT OR IGNORE INTO account_settings (id, profile_id, primary_currency, reporting_currencies, conversion_method)
SELECT
    'settings-' || id,
    id,
    'USD',
    'EUR,GBP',
    'historical'
FROM profiles;
