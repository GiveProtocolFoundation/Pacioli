-- =============================================================================
-- M5 — TIGHTEN STATE MACHINE: REQUIRE APPROVAL BEFORE POSTING (GIV-677, Phase 2)
--
-- Phase 1 allowed draft->posted for backward compatibility. Phase 2 enforces
-- the full approval gate: only approved entries can be posted.
--
-- Changes:
--   1. Replace the status-transition trigger to remove draft->posted.
--   2. Replace the balance-validation trigger to fire only on approved->posted.
--   3. Replace the legacy is_posted balance trigger likewise.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tighten status transitions: draft -> approved -> posted (no skip)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS journal_entries_status_transition;

CREATE TRIGGER journal_entries_status_transition
BEFORE UPDATE OF status ON journal_entries
BEGIN
    -- Voided entries are immutable
    SELECT CASE
        WHEN OLD.status = 'voided'
        THEN RAISE(ABORT, 'Voided entries are immutable')
    END;
    -- Draft can only go to approved (no more direct draft->posted)
    SELECT CASE
        WHEN OLD.status = 'draft' AND NEW.status != 'approved'
        THEN RAISE(ABORT, 'Draft entries can only transition to approved')
    END;
    -- Approved can go to posted or back to draft for editing
    SELECT CASE
        WHEN OLD.status = 'approved' AND NEW.status NOT IN ('posted', 'draft')
        THEN RAISE(ABORT, 'Approved entries can only transition to posted or back to draft')
    END;
    -- Posted can only be voided
    SELECT CASE
        WHEN OLD.status = 'posted' AND NEW.status != 'voided'
        THEN RAISE(ABORT, 'Posted entries can only be voided')
    END;
END;

-- ---------------------------------------------------------------------------
-- 2. Balance validation: fire only on approved->posted
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS validate_journal_entry_balance;

CREATE TRIGGER validate_journal_entry_balance
BEFORE UPDATE OF status ON journal_entries
WHEN NEW.status = 'posted' AND OLD.status = 'approved'
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

-- ---------------------------------------------------------------------------
-- 3. Legacy is_posted balance trigger (also tightened)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. Update views: ensure voided (is_posted=1) entries are included
--    The views currently filter on is_posted=1, which correctly includes
--    voided entries since void_journal_entry sets is_posted=1 via same-write.
--    Phase 2 reversals will set status='voided' AND is_posted=1 on the original,
--    and the reversing entry will be status='posted', is_posted=1.
--    Both remain in the GL — net effect zero. No view changes needed since
--    is_posted=1 already covers voided entries.
-- ---------------------------------------------------------------------------
-- (verified: v_account_balances, v_trial_balance, v_balance_sheet,
--  v_income_statement all use WHERE je.is_posted = 1 which includes voided)
