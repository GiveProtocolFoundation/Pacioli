-- Add offline storage support tables and columns
-- This migration adds:
-- 1. is_default column to profiles
-- 2. app_metadata table for password hash and app state

-- Add is_default column to profiles (SQLite doesn't support IF NOT EXISTS for columns)
-- We use a separate table approach to track this safely
CREATE TABLE IF NOT EXISTS profile_defaults (
    profile_id TEXT PRIMARY KEY,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- App metadata (unencrypted, stores password hash, app state)
CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default app state if not exists
INSERT OR IGNORE INTO app_metadata (key, value, updated_at)
VALUES ('app_initialized', 'false', CURRENT_TIMESTAMP);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profile_defaults_is_default ON profile_defaults(is_default);
