-- Persistence layer tables for Pacioli
-- Profiles, Wallets, Transactions, and Settings
-- Note: Some tables already exist from earlier migrations, so we use ALTER TABLE to add missing columns

-- User profiles (already exists from 20250101000001)
-- Just ensure it exists with CREATE TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add profile_id to existing wallets table (created in 20250102000002)
-- SQLite doesn't support IF NOT EXISTS for columns, so we handle this in app code
-- For now, we create a profile_wallets table for the profile-wallet relationship
CREATE TABLE IF NOT EXISTS profile_wallets (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    wallet_id INTEGER NOT NULL,
    name TEXT,
    wallet_type TEXT NOT NULL DEFAULT 'substrate',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
    UNIQUE(profile_id, wallet_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_wallets_profile_id ON profile_wallets(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_wallets_wallet_id ON profile_wallets(wallet_id);

-- Application settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries on existing tables
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(wallet_address);
