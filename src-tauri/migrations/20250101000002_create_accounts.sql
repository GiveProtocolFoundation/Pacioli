-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    address TEXT NOT NULL,
    chain TEXT NOT NULL,
    nickname TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles (id)
);
