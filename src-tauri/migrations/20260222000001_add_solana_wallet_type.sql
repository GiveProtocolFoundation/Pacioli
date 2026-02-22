-- =============================================================================
-- ADD SOLANA WALLET TYPE
-- Extends wallet auth CHECK constraints to include 'solana' wallet type
-- Uses SQLite table recreation since ALTER TABLE cannot modify CHECK constraints
-- =============================================================================

-- Step 1: Recreate user_wallet_auth with updated CHECK constraint
CREATE TABLE IF NOT EXISTS user_wallet_auth_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    wallet_type TEXT NOT NULL CHECK (wallet_type IN ('substrate', 'evm', 'solana')),
    chain TEXT,
    wallet_name TEXT,
    wallet_source TEXT,
    is_primary INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(wallet_address, wallet_type)
);

INSERT OR IGNORE INTO user_wallet_auth_new
    SELECT id, user_id, wallet_address, wallet_type, chain, wallet_name,
           wallet_source, is_primary, verified, created_at, last_used_at
    FROM user_wallet_auth;

DROP TABLE IF EXISTS user_wallet_auth;
ALTER TABLE user_wallet_auth_new RENAME TO user_wallet_auth;

CREATE INDEX IF NOT EXISTS idx_user_wallet_auth_user ON user_wallet_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallet_auth_address ON user_wallet_auth(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_wallet_auth_type ON user_wallet_auth(wallet_type);

-- Step 2: Recreate auth_challenges with updated CHECK constraint
CREATE TABLE IF NOT EXISTS auth_challenges_new (
    id TEXT PRIMARY KEY,
    nonce TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    wallet_type TEXT NOT NULL CHECK (wallet_type IN ('substrate', 'evm', 'solana')),
    message TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    used_at DATETIME
);

INSERT OR IGNORE INTO auth_challenges_new
    SELECT id, nonce, wallet_address, wallet_type, message, ip_address,
           user_agent, issued_at, expires_at, used_at
    FROM auth_challenges;

DROP TABLE IF EXISTS auth_challenges;
ALTER TABLE auth_challenges_new RENAME TO auth_challenges;

CREATE INDEX IF NOT EXISTS idx_auth_challenges_nonce ON auth_challenges(nonce);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_wallet ON auth_challenges(wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON auth_challenges(expires_at);
