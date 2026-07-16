-- =============================================================================
-- M6 — ACCOUNTING PERIODS: CLOSE AND LOCK (GIV-684, Phase 5)
--
-- Introduces monthly accounting periods with open/closed lifecycle.
-- A DB-level trigger blocks posting journal entries whose entry_date falls
-- inside a closed period. Reversals must land in an open period (their own
-- entry_date), never inside the closed one.
--
-- Changes:
--   1. Create `accounting_periods` table with status, audit columns.
--   2. Create trigger to reject posting into a closed period.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. accounting_periods table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_periods (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    period_start DATE    NOT NULL,
    period_end   DATE    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    closed_by    TEXT,
    closed_at    DATETIME,
    reopened_by  TEXT,
    reopened_at  DATETIME,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT period_start_before_end CHECK(period_start < period_end)
);

-- ---------------------------------------------------------------------------
-- 2. Trigger: block posting into a closed period
--
--    Fires on approved->posted transition (same guard as M5 balance trigger).
--    The entry_date is checked against all closed periods. If any closed
--    period contains the entry_date, the post is rejected.
--
--    This also blocks reversals from landing in a closed period, because
--    void_journal_entry creates a reversing entry with its own entry_date
--    and posts it through the same draft->approved->posted path.
-- ---------------------------------------------------------------------------
CREATE TRIGGER prevent_posting_into_closed_period
BEFORE UPDATE OF status ON journal_entries
WHEN NEW.status = 'posted' AND OLD.status = 'approved'
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM accounting_periods
            WHERE status = 'closed'
              AND DATE(NEW.entry_date) >= period_start
              AND DATE(NEW.entry_date) <= period_end
        )
        THEN RAISE(ABORT, 'Cannot post entry: the accounting period containing this entry date is closed')
    END;
END;

-- ---------------------------------------------------------------------------
-- 3. Trigger: posted/voided entry_date immutability (review hardening)
--
--    The closed-period lock keys entirely off entry_date, but the existing
--    immutability triggers only cover status/is_posted transitions and line
--    mutations. Without this trigger, a direct
--      UPDATE journal_entries SET entry_date = ... WHERE id = ...
--    on a posted entry could backdate it into (or out of) a closed period,
--    silently rewriting a closed month. No application path updates
--    entry_date after posting (update_journal_entry is draft-only), so this
--    is pure defense-in-depth at the DB layer, consistent with M1/M5.
-- ---------------------------------------------------------------------------
CREATE TRIGGER journal_entries_posted_entry_date_immutable
BEFORE UPDATE OF entry_date ON journal_entries
WHEN OLD.status IN ('posted', 'voided')
BEGIN
    SELECT RAISE(ABORT, 'entry_date of a posted or voided journal entry is immutable; void the entry and create a correcting entry');
END;
