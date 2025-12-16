-- =============================================================================
-- WALLET AUTHENTICATION
-- Extends existing auth system with Web3 wallet sign-in support
-- Supports Substrate (sr25519) and EVM (secp256k1) wallets
-- =============================================================================

-- Wallet auth methods linked to users
-- Users can link multiple wallets to their account
CREATE TABLE IF NOT EXISTS user_wallet_auth (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Wallet identification
    wallet_address TEXT NOT NULL,
    wallet_type TEXT NOT NULL CHECK (wallet_type IN ('substrate', 'evm')),
    chain TEXT,  -- e.g., 'polkadot', 'ethereum', 'kusama', 'moonbeam'

    -- Display info (from wallet extension)
    wallet_name TEXT,  -- e.g., 'My Polkadot Account'
    wallet_source TEXT,  -- e.g., 'polkadot-js', 'talisman', 'metamask'

    -- Status
    is_primary INTEGER DEFAULT 0,  -- Primary wallet for this user
    verified INTEGER DEFAULT 1,  -- Wallet ownership verified via signature

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(wallet_address, wallet_type)
);

CREATE INDEX IF NOT EXISTS idx_user_wallet_auth_user ON user_wallet_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallet_auth_address ON user_wallet_auth(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_wallet_auth_type ON user_wallet_auth(wallet_type);

-- Challenges for wallet sign-in (nonce-based, prevents replay attacks)
-- Short-lived challenges that must be signed by the wallet
CREATE TABLE IF NOT EXISTS auth_challenges (
    id TEXT PRIMARY KEY,

    -- Challenge data
    nonce TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    wallet_type TEXT NOT NULL CHECK (wallet_type IN ('substrate', 'evm')),
    message TEXT NOT NULL,  -- The full message to be signed

    -- Security context
    ip_address TEXT,
    user_agent TEXT,

    -- Timestamps
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    used_at DATETIME  -- Set when challenge is successfully used
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_nonce ON auth_challenges(nonce);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_wallet ON auth_challenges(wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON auth_challenges(expires_at);

-- Trigger to clean up expired challenges (optional, can also be done via cron)
-- Challenges expire after 5 minutes by default

-- Add wallet auth settings
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
    ('auth_wallet_challenge_expiry_seconds', '300', CURRENT_TIMESTAMP),
    ('auth_wallet_enabled', 'true', CURRENT_TIMESTAMP),
    ('auth_wallet_allow_registration', 'true', CURRENT_TIMESTAMP);
