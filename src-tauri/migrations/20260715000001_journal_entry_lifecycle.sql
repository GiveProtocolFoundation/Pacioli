-- =============================================================================
-- M1 — JOURNAL-ENTRY LIFECYCLE + PROVENANCE (GIV-673, Phase 1)
--
-- Adds lifecycle status, provenance columns, and entity FK to journal_entries.
-- Rebuilds GIV-665 triggers against the new `status` column.
-- Keeps `is_posted` via same-write: Rust code always sets both status and
-- is_posted. No bidirectional sync triggers (avoids circular firing).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. New columns on journal_entries
-- ---------------------------------------------------------------------------

-- Entity FK (nullable — single-entity books in Stage 1)
ALTER TABLE journal_entries ADD COLUMN entity_id TEXT REFERENCES entities(id);

-- Lifecycle status: replaces the is_posted boolean with a richer state machine
ALTER TABLE journal_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft', 'approved', 'posted', 'voided'));

-- Provenance: how the entry was drafted
ALTER TABLE journal_entries ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'
    CHECK(origin IN ('manual', 'rule', 'model'));

-- Approval tracking
ALTER TABLE journal_entries ADD COLUMN approved_by TEXT;
ALTER TABLE journal_entries ADD COLUMN approved_at DATETIME;

-- Distinct posted timestamp (created_at != posted_at in approval workflow)
ALTER TABLE journal_entries ADD COLUMN posted_at DATETIME;

-- ---------------------------------------------------------------------------
-- 2. Backfill status from is_posted
--    is_posted=1 -> 'posted', is_posted=0 -> 'draft'
--    is_reversed=1 already-posted entries become 'voided'
-- ---------------------------------------------------------------------------
UPDATE journal_entries SET status = 'posted', posted_at = updated_at
    WHERE is_posted = 1 AND is_reversed = 0;
UPDATE journal_entries SET status = 'voided'
    WHERE is_reversed = 1;

-- ---------------------------------------------------------------------------
-- 3. Rebuild GIV-665 triggers against `status` column
-- ---------------------------------------------------------------------------

-- 3a. Drop old triggers that reference is_posted
DROP TRIGGER IF EXISTS journal_entries_no_born_posted;
DROP TRIGGER IF EXISTS validate_journal_entry_balance;
DROP TRIGGER IF EXISTS journal_entry_lines_no_insert_posted;
DROP TRIGGER IF EXISTS journal_entry_lines_no_update_posted;
DROP TRIGGER IF EXISTS journal_entry_lines_no_delete_posted;

-- 3b. Prevent born-posted/born-approved entries (must start as 'draft')
CREATE TRIGGER journal_entries_no_born_posted
BEFORE INSERT ON journal_entries
WHEN NEW.status != 'draft'
BEGIN
    SELECT RAISE(ABORT, 'Journal entries must be created as drafts (status=draft)');
END;

-- 3c. Status transition enforcement: draft -> approved -> posted
--     Only forward transitions allowed; voided is terminal.
--     posted/voided rows are frozen (no status change except posted->voided).
CREATE TRIGGER journal_entries_status_transition
BEFORE UPDATE OF status ON journal_entries
BEGIN
    -- Block any change on voided entries
    SELECT CASE
        WHEN OLD.status = 'voided'
        THEN RAISE(ABORT, 'Voided entries are immutable')
    END;
    -- Block invalid transitions
    SELECT CASE
        WHEN OLD.status = 'draft' AND NEW.status NOT IN ('approved', 'posted')
        THEN RAISE(ABORT, 'Draft entries can only transition to approved or posted')
    END;
    SELECT CASE
        WHEN OLD.status = 'approved' AND NEW.status NOT IN ('posted', 'draft')
        THEN RAISE(ABORT, 'Approved entries can only transition to posted or back to draft')
    END;
    SELECT CASE
        WHEN OLD.status = 'posted' AND NEW.status != 'voided'
        THEN RAISE(ABORT, 'Posted entries can only be voided')
    END;
END;

-- 3d. Balance validation on posting (status -> 'posted')
--     Requires >= 2 lines and balanced debits/credits.
--     Note: M2 migration replaces this trigger with exact-integer balance check.
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
    SELECT CASE
        WHEN COALESCE(
            (SELECT ABS(SUM(debit_amount) - SUM(credit_amount))
             FROM journal_entry_lines
             WHERE journal_entry_id = NEW.id),
            1e18
        ) > 0.01
        THEN RAISE(ABORT, 'Journal entry debits must equal credits')
    END;
END;

-- 3e. Posted/voided line immutability (using status instead of is_posted)
CREATE TRIGGER journal_entry_lines_no_insert_posted
BEFORE INSERT ON journal_entry_lines
WHEN (SELECT status FROM journal_entries WHERE id = NEW.journal_entry_id) IN ('posted', 'voided')
BEGIN
    SELECT RAISE(ABORT, 'Lines of a posted journal entry are immutable; void the entry and create a correcting entry');
END;

CREATE TRIGGER journal_entry_lines_no_update_posted
BEFORE UPDATE ON journal_entry_lines
WHEN (SELECT status FROM journal_entries WHERE id = OLD.journal_entry_id) IN ('posted', 'voided')
  OR (SELECT status FROM journal_entries WHERE id = NEW.journal_entry_id) IN ('posted', 'voided')
BEGIN
    SELECT RAISE(ABORT, 'Lines of a posted journal entry are immutable; void the entry and create a correcting entry');
END;

CREATE TRIGGER journal_entry_lines_no_delete_posted
BEFORE DELETE ON journal_entry_lines
WHEN (SELECT status FROM journal_entries WHERE id = OLD.journal_entry_id) IN ('posted', 'voided')
BEGIN
    SELECT RAISE(ABORT, 'Lines of a posted journal entry are immutable; void the entry and create a correcting entry');
END;

-- 3f. Legacy is_posted balance trigger for backward compatibility.
--     Code that updates is_posted=1 must also set status='posted' (same-write).
--     This trigger validates the balance when the legacy path is used.
--     Note: M2 migration replaces this trigger with exact-integer balance check.
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
            (SELECT ABS(SUM(debit_amount) - SUM(credit_amount))
             FROM journal_entry_lines
             WHERE journal_entry_id = NEW.id),
            1e18
        ) > 0.01
        THEN RAISE(ABORT, 'Journal entry debits must equal credits')
    END;
END;

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entity ON journal_entries(entity_id);
