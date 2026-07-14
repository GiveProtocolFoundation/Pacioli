-- =============================================================================
-- ENFORCE JOURNAL-ENTRY BALANCE INVARIANT AT THE DATA LAYER (GIV-665)
--
-- Closes three verified holes in the journal-entry lifecycle:
--   1. Born-posted entries bypass balance validation (DEFAULT 1 + no INSERT trigger)
--   2. Lines of a posted entry can be mutated, silently unbalancing the ledger
--   3. Zero-line entries post successfully (NULL > 0.01 is false in SQLite)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Prevent born-posted entries
--    Lines cannot exist before the header row, so a born-posted entry can
--    never have been balance-checked.
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS journal_entries_no_born_posted
BEFORE INSERT ON journal_entries
WHEN NEW.is_posted = 1
BEGIN
    SELECT RAISE(ABORT, 'Journal entries must be created as drafts and posted after balance validation');
END;

-- ---------------------------------------------------------------------------
-- 2. Posted-entry line immutability
--    Once posted, lines are frozen.  To correct: void the entry, create a
--    new correcting entry.
-- ---------------------------------------------------------------------------

-- 2a. Block INSERT of a line onto a posted entry
CREATE TRIGGER IF NOT EXISTS journal_entry_lines_no_insert_posted
BEFORE INSERT ON journal_entry_lines
WHEN (SELECT is_posted FROM journal_entries WHERE id = NEW.journal_entry_id) = 1
BEGIN
    SELECT RAISE(ABORT, 'Lines of a posted journal entry are immutable; void the entry and create a correcting entry');
END;

-- 2b. Block UPDATE of a line on a posted entry (also blocks re-pointing onto a posted entry)
CREATE TRIGGER IF NOT EXISTS journal_entry_lines_no_update_posted
BEFORE UPDATE ON journal_entry_lines
WHEN (SELECT is_posted FROM journal_entries WHERE id = OLD.journal_entry_id) = 1
  OR (SELECT is_posted FROM journal_entries WHERE id = NEW.journal_entry_id) = 1
BEGIN
    SELECT RAISE(ABORT, 'Lines of a posted journal entry are immutable; void the entry and create a correcting entry');
END;

-- 2c. Block DELETE of a line from a posted entry
CREATE TRIGGER IF NOT EXISTS journal_entry_lines_no_delete_posted
BEFORE DELETE ON journal_entry_lines
WHEN (SELECT is_posted FROM journal_entries WHERE id = OLD.journal_entry_id) = 1
BEGIN
    SELECT RAISE(ABORT, 'Lines of a posted journal entry are immutable; void the entry and create a correcting entry');
END;

-- ---------------------------------------------------------------------------
-- 3. Replace the posting balance trigger
--    Closes the NULL hole (zero lines) and requires at least 2 lines.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS validate_journal_entry_balance;

CREATE TRIGGER validate_journal_entry_balance
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
