-- Persistence layer tables for Pacioli
-- Profiles, Wallets, Transactions, and Settings

-- User profiles
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Wallets linked to profiles (uses 'accounts' as the existing table name)
CREATE TABLE IF NOT EXISTS wallets (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    address TEXT NOT NULL,
    chain TEXT NOT NULL,
    name TEXT,
    wallet_type TEXT NOT NULL DEFAULT 'substrate',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE(profile_id, address, chain)
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    hash TEXT NOT NULL,
    block_number INTEGER,
    timestamp DATETIME,
    from_address TEXT,
    to_address TEXT,
    value TEXT,
    fee TEXT,
    status TEXT,
    tx_type TEXT,
    token_symbol TEXT,
    token_decimals INTEGER,
    chain TEXT NOT NULL,
    raw_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
    UNIQUE(wallet_id, hash)
);

-- Application settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sync status for tracking blockchain indexing progress
CREATE TABLE IF NOT EXISTS sync_status (
    wallet_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    last_synced_block INTEGER NOT NULL DEFAULT 0,
    last_sync_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wallet_id, chain),
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_wallets_profile_id ON wallets(profile_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash);
