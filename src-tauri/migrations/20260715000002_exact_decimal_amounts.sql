-- =============================================================================
-- M2 — EXACT-DECIMAL AMOUNTS (GIV-673, Phase 1)
--
-- Adds INTEGER minor-unit columns (USD cents) and TEXT quantity columns to
-- journal_entry_lines. Backfills from existing DECIMAL columns. Replaces
-- float-tolerance balance triggers with exact INTEGER comparison.
--
-- Convention (approved Q1): functional-currency values as INTEGER minor units,
-- token quantities as TEXT canonical decimals (rust_decimal round-trip).
-- Legacy debit_amount/credit_amount columns remain, written in tandem.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. New columns on journal_entry_lines
-- ---------------------------------------------------------------------------

-- Functional-currency value in minor units (USD cents).
-- One-sided, mirrors the existing CHECK pattern.
ALTER TABLE journal_entry_lines ADD COLUMN debit_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN credit_minor INTEGER NOT NULL DEFAULT 0;

-- Token quantity as TEXT canonical decimal (rust_decimal round-trip).
-- NULL for pure-fiat lines (no token movement).
ALTER TABLE journal_entry_lines ADD COLUMN quantity TEXT;

-- One-sided CHECK for minor-unit columns (mirrors legacy CHECK)
-- SQLite ALTER TABLE cannot add CHECK constraints on new columns inline,
-- so we enforce via trigger instead.

-- ---------------------------------------------------------------------------
-- 2. Backfill minor-unit columns from legacy DECIMAL columns
--    ROUND(x * 100) converts dollars to cents
-- ---------------------------------------------------------------------------
UPDATE journal_entry_lines SET
    debit_minor = CAST(ROUND(debit_amount * 100) AS INTEGER),
    credit_minor = CAST(ROUND(credit_amount * 100) AS INTEGER);

-- ---------------------------------------------------------------------------
-- 3. Enforce one-sided minor-unit columns via trigger
-- ---------------------------------------------------------------------------
CREATE TRIGGER journal_entry_lines_minor_one_sided_insert
BEFORE INSERT ON journal_entry_lines
WHEN (NEW.debit_minor > 0 AND NEW.credit_minor > 0)
BEGIN
    SELECT RAISE(ABORT, 'Each line must have exactly one of debit_minor or credit_minor, not both');
END;

CREATE TRIGGER journal_entry_lines_minor_one_sided_update
BEFORE UPDATE ON journal_entry_lines
WHEN (NEW.debit_minor > 0 AND NEW.credit_minor > 0)
BEGIN
    SELECT RAISE(ABORT, 'Each line must have exactly one of debit_minor or credit_minor, not both');
END;

-- ---------------------------------------------------------------------------
-- 4. Replace float-tolerance balance triggers with exact INTEGER comparison
--    Drop existing triggers and recreate with zero-tolerance integer sums
-- ---------------------------------------------------------------------------

-- Drop the old triggers (both status-based and legacy is_posted-based)
DROP TRIGGER IF EXISTS validate_journal_entry_balance;
DROP TRIGGER IF EXISTS validate_journal_entry_balance_legacy;

-- 4a. Exact balance validation on status -> 'posted' (zero tolerance)
CREATE TRIGGER validate_journal_entry_balance
BEFORE UPDATE OF status ON journal_entries
WHEN NEW.status = 'posted' AND OLD.status IN ('draft', 'approved')
BEGIN
    SELECT CASE
        WHEN (
            SELECT COUNT(*)
            FROM journal_entry_lines
            WHERE journal_entry_id = NEW.id
        ) < 2
        THEN RAISE(ABORT, 'Journal entry must have at least 2 lines (debit and credit)')
    END;
    -- Exact integer balance check: SUM(debit_minor) must equal SUM(credit_minor)
    SELECT CASE
        WHEN COALESCE(
            (SELECT SUM(debit_minor) - SUM(credit_minor)
             FROM journal_entry_lines
             WHERE journal_entry_id = NEW.id),
            1
        ) != 0
        THEN RAISE(ABORT, 'Journal entry does not balance: sum of debit_minor must equal sum of credit_minor (zero tolerance)')
    END;
END;

-- 4b. Legacy is_posted balance trigger (also exact integer now)
CREATE TRIGGER validate_journal_entry_balance_legacy
BEFORE UPDATE OF is_posted ON journal_entries
WHEN NEW.is_posted = 1 AND OLD.is_posted = 0
BEGIN
    SELECT CASE
        WHEN (
            SELECT COUNT(*)
            FROM journal_entry_lines
            WHERE journal_entry_id = NEW.id
        ) < 2
        THEN RAISE(ABORT, 'Journal entry must have at least 2 lines (debit and credit)')
    END;
    SELECT CASE
        WHEN COALESCE(
            (SELECT SUM(debit_minor) - SUM(credit_minor)
             FROM journal_entry_lines
             WHERE journal_entry_id = NEW.id),
            1
        ) != 0
        THEN RAISE(ABORT, 'Journal entry does not balance: sum of debit_minor must equal sum of credit_minor (zero tolerance)')
    END;
END;
