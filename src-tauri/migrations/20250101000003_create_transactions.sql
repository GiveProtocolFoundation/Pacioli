-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT,
    value TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    token_decimals INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    status TEXT NOT NULL,
    fee TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hash, chain),
    FOREIGN KEY (profile_id) REFERENCES profiles (id)
);
