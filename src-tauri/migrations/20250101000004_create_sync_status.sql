-- Create sync_status table
CREATE TABLE IF NOT EXISTS sync_status (
    profile_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    last_synced_block INTEGER NOT NULL DEFAULT 0,
    last_sync_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id, chain),
    FOREIGN KEY (profile_id) REFERENCES profiles (id)
);
