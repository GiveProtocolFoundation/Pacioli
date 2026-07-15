-- =============================================================================
-- M3 — PER-ASSET BALANCE ENFORCEMENT (GIV-673, Phase 1)
--
-- Adds asset_id dimension to journal_entry_lines, generalizing token_id to
-- include fiat currencies (e.g. 'USD'). The posting trigger validates:
--   (1) Functional-currency minor-unit sums balance exactly (from M2), AND
--   (2) Per-asset quantity debits == credits for each asset with quantities;
--       measurement lines (no quantity, functional-currency only) carry
--       cross-asset valuation differences.
--
-- Asset representation (least invasive):
--   asset_id TEXT — either 'USD' for fiat, or 'token:<token_id>' for tokens.
--   This keeps the existing token_id FK working while adding a unified
--   discriminator column. Pure-fiat lines use asset_id='USD' with no quantity.
--   Measurement lines (gains/losses) use asset_id=NULL and quantity=NULL.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add asset_id column
-- ---------------------------------------------------------------------------
ALTER TABLE journal_entry_lines ADD COLUMN asset_id TEXT;

-- ---------------------------------------------------------------------------
-- 2. Backfill asset_id from existing token_id
--    Lines with token_id get 'token:<id>', lines without get NULL
--    (NULL = measurement line or legacy fiat line before this migration)
-- ---------------------------------------------------------------------------
UPDATE journal_entry_lines
SET asset_id = 'token:' || CAST(token_id AS TEXT)
WHERE token_id IS NOT NULL;

-- Legacy lines without token_id: these are functional-currency lines.
-- Set asset_id = 'USD' for lines that have amounts but no token.
UPDATE journal_entry_lines
SET asset_id = 'USD'
WHERE token_id IS NULL AND (debit_minor > 0 OR credit_minor > 0) AND asset_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Replace posting trigger to add per-asset quantity balance check
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS validate_journal_entry_balance;

CREATE TRIGGER validate_journal_entry_balance
BEFORE UPDATE OF status ON journal_entries
WHEN NEW.status = 'posted' AND OLD.status IN ('draft', 'approved')
BEGIN
    -- Check 1: minimum 2 lines
    SELECT CASE
        WHEN (
            SELECT COUNT(*)
            FROM journal_entry_lines
            WHERE journal_entry_id = NEW.id
        ) < 2
        THEN RAISE(ABORT, 'Journal entry must have at least 2 lines (debit and credit)')
    END;

    -- Check 2: functional-currency balance (exact integer, zero tolerance)
    SELECT CASE
        WHEN COALESCE(
            (SELECT SUM(debit_minor) - SUM(credit_minor)
             FROM journal_entry_lines
             WHERE journal_entry_id = NEW.id),
            1
        ) != 0
        THEN RAISE(ABORT, 'Journal entry does not balance: sum of debit_minor must equal sum of credit_minor (zero tolerance)')
    END;

    -- Check 3: per-asset quantity balance
    -- For each asset that has quantities on BOTH debit and credit sides,
    -- the quantities must balance. Assets appearing on only one side are
    -- valid — measurement lines carry cross-asset valuation differences.
    SELECT CASE
        WHEN EXISTS (
            SELECT asset_id
            FROM journal_entry_lines
            WHERE journal_entry_id = NEW.id
              AND quantity IS NOT NULL
              AND asset_id IS NOT NULL
            GROUP BY asset_id
            HAVING SUM(CASE WHEN debit_minor > 0 THEN 1 ELSE 0 END) > 0
               AND SUM(CASE WHEN credit_minor > 0 THEN 1 ELSE 0 END) > 0
               AND SUM(
                   CASE WHEN debit_minor > 0 THEN CAST(quantity AS REAL) ELSE 0 END
               ) != SUM(
                   CASE WHEN credit_minor > 0 THEN CAST(quantity AS REAL) ELSE 0 END
               )
        )
        THEN RAISE(ABORT, 'Per-asset quantity imbalance: for each asset with quantities, debit quantities must equal credit quantities')
    END;
END;

-- Also update the legacy is_posted trigger
DROP TRIGGER IF EXISTS validate_journal_entry_balance_legacy;

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
    SELECT CASE
        WHEN EXISTS (
            SELECT asset_id
            FROM journal_entry_lines
            WHERE journal_entry_id = NEW.id
              AND quantity IS NOT NULL
              AND asset_id IS NOT NULL
            GROUP BY asset_id
            HAVING SUM(CASE WHEN debit_minor > 0 THEN 1 ELSE 0 END) > 0
               AND SUM(CASE WHEN credit_minor > 0 THEN 1 ELSE 0 END) > 0
               AND SUM(
                   CASE WHEN debit_minor > 0 THEN CAST(quantity AS REAL) ELSE 0 END
               ) != SUM(
                   CASE WHEN credit_minor > 0 THEN CAST(quantity AS REAL) ELSE 0 END
               )
        )
        THEN RAISE(ABORT, 'Per-asset quantity imbalance: for each asset with quantities, debit quantities must equal credit quantities')
    END;
END;

-- Index for per-asset queries
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_asset ON journal_entry_lines(asset_id);
