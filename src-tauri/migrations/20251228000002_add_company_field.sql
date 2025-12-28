-- Migration: Add company field to user profile
-- Adds company/organization field for users who want to input it

-- Add company column to users table
ALTER TABLE users ADD COLUMN company TEXT;
