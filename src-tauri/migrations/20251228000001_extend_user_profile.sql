-- Migration: Extend user profile fields
-- Adds additional profile information to the users table

-- Add extended profile columns to users table
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN job_title TEXT;
ALTER TABLE users ADD COLUMN department TEXT;
ALTER TABLE users ADD COLUMN location TEXT;
ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en';
ALTER TABLE users ADD COLUMN date_format TEXT DEFAULT 'MM/DD/YYYY';

-- Add notification preferences
ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN sms_notifications INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN login_alerts INTEGER DEFAULT 1;

-- Create index for common lookups
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
