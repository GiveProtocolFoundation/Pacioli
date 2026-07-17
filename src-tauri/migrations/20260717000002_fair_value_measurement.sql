-- =============================================================================
-- M8 — FAIR-VALUE MEASUREMENT (Phase 8, GIV-690, ASU 2023-08)
--
-- Period-end remeasurement for in-scope digital assets:
--   - price_observations: append-only log of every price used, with source
--     and provenance (manual overrides logged with the real user identity).
--   - remeasurement_runs: audit trail of each remeasurement execution,
--     linking a run to its generated draft journal entries.
--   - Triggers enforce append-only/immutability on both tables (Inv-7).
-- =============================================================================

-- Each observed price (API fetch or manual override) is recorded exactly once.
-- Prices are never overwritten; a newer observation for the same asset/date
-- simply has a later created_at timestamp.
CREATE TABLE IF NOT EXISTS price_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Asset identifier matching cost_basis_lots.asset_id / journal_entry_lines.asset_id
    asset_id TEXT NOT NULL,

    -- The date this price applies to (period-end date for remeasurement).
    price_date TEXT NOT NULL,  -- ISO 8601 'YYYY-MM-DD'

    -- Price per unit in functional-currency minor units (USD cents).
    -- Exact integer: no floats in the money path (Inv-2).
    price_minor INTEGER NOT NULL,

    -- Price per unit as a decimal string for display / audit.
    -- This is the raw value from the source before minor-unit conversion.
    price_decimal TEXT NOT NULL,

    -- Source of the price: 'coingecko', 'manual', or future providers.
    source TEXT NOT NULL,

    -- For API sources: the coin ID used in the request (e.g. 'polkadot').
    -- For manual: NULL.
    source_coin_id TEXT,

    -- The user who recorded this price. For API fetches, the user who
    -- triggered the remeasurement. For manual overrides, the overriding user.
    -- Never 'system' — always the real authed user identity (Inv-7).
    recorded_by TEXT NOT NULL,

    -- Optional note for manual overrides explaining the source.
    note TEXT,

    -- Immutable audit timestamp.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_po_asset_date
    ON price_observations(asset_id, price_date);
CREATE INDEX IF NOT EXISTS idx_po_source
    ON price_observations(source);

-- Each remeasurement run is an atomic batch of draft adjusting entries
-- generated for a specific period-end date.
CREATE TABLE IF NOT EXISTS remeasurement_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- The period-end date being remeasured.
    run_date TEXT NOT NULL,  -- ISO 8601 'YYYY-MM-DD'

    -- The user who initiated the remeasurement.
    initiated_by TEXT NOT NULL,

    -- Number of holdings remeasured in this run.
    holdings_count INTEGER NOT NULL DEFAULT 0,

    -- Number of draft journal entries generated.
    entries_generated INTEGER NOT NULL DEFAULT 0,

    -- Total unrealized gain/loss in minor units (positive = gain).
    total_unrealized_gain_loss_minor INTEGER NOT NULL DEFAULT 0,

    -- Status of the run: 'completed', 'partial' (some assets had no price).
    status TEXT NOT NULL DEFAULT 'completed'
        CHECK(status IN ('completed', 'partial')),

    -- Immutable audit timestamp.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rr_run_date
    ON remeasurement_runs(run_date);

-- Links a remeasurement run to the draft entries it generated.
-- Allows tracking which entries came from which run for audit.
CREATE TABLE IF NOT EXISTS remeasurement_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- FK to the remeasurement run.
    run_id INTEGER NOT NULL REFERENCES remeasurement_runs(id),

    -- FK to the generated draft journal entry.
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id),

    -- The asset being remeasured.
    asset_id TEXT NOT NULL,

    -- Wallet holding the asset.
    wallet_id TEXT NOT NULL,

    -- The price observation used for this remeasurement.
    price_observation_id INTEGER NOT NULL REFERENCES price_observations(id),

    -- Carrying amount before remeasurement (minor units).
    carrying_amount_minor INTEGER NOT NULL,

    -- Fair value at remeasurement (minor units).
    fair_value_minor INTEGER NOT NULL,

    -- Unrealized gain/loss = fair_value - carrying_amount (minor units).
    unrealized_gain_loss_minor INTEGER NOT NULL,

    -- Audit timestamp.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_re_run
    ON remeasurement_entries(run_id);
CREATE INDEX IF NOT EXISTS idx_re_journal_entry
    ON remeasurement_entries(journal_entry_id);

-- =============================================================================
-- APPEND-ONLY TRIGGERS (Inv-7)
-- =============================================================================

-- price_observations: no UPDATE, no DELETE.
CREATE TRIGGER IF NOT EXISTS price_observations_immutable_update
BEFORE UPDATE ON price_observations
BEGIN
    SELECT RAISE(ABORT, 'price_observations rows are immutable (append-only)');
END;

CREATE TRIGGER IF NOT EXISTS price_observations_immutable_delete
BEFORE DELETE ON price_observations
BEGIN
    SELECT RAISE(ABORT, 'price_observations rows cannot be deleted (append-only)');
END;

-- remeasurement_runs: no UPDATE, no DELETE.
CREATE TRIGGER IF NOT EXISTS remeasurement_runs_immutable_update
BEFORE UPDATE ON remeasurement_runs
BEGIN
    SELECT RAISE(ABORT, 'remeasurement_runs rows are immutable (append-only)');
END;

CREATE TRIGGER IF NOT EXISTS remeasurement_runs_immutable_delete
BEFORE DELETE ON remeasurement_runs
BEGIN
    SELECT RAISE(ABORT, 'remeasurement_runs rows cannot be deleted (append-only)');
END;

-- remeasurement_entries: no UPDATE, no DELETE.
CREATE TRIGGER IF NOT EXISTS remeasurement_entries_immutable_update
BEFORE UPDATE ON remeasurement_entries
BEGIN
    SELECT RAISE(ABORT, 'remeasurement_entries rows are immutable (append-only)');
END;

CREATE TRIGGER IF NOT EXISTS remeasurement_entries_immutable_delete
BEFORE DELETE ON remeasurement_entries
BEGIN
    SELECT RAISE(ABORT, 'remeasurement_entries rows cannot be deleted (append-only)');
END;
