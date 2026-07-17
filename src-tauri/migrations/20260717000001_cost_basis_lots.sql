-- =============================================================================
-- M7 — COST BASIS LOT TRACKING (Phase 7, GIV-689)
--
-- Per-wallet, per-asset lot tracking with FIFO consumption. Designed to
-- integrate with the Phase 1–6 journal entry engine:
--   - Quantities are TEXT canonical decimals (rust_decimal, Inv-2).
--   - Cost basis / proceeds are INTEGER minor units (USD cents, Inv-2).
--   - Lots are append-only; consumption is recorded in lot_consumptions,
--     never destructive updates to lots (Inv-7 provenance).
--   - Transfers between own wallets move lots WITHOUT realization.
-- =============================================================================

-- Lots opened by acquisitions. Each row records a quantity of an asset
-- acquired at a specific cost, scoped to a wallet address.
CREATE TABLE IF NOT EXISTS cost_basis_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Asset identifier matching journal_entry_lines.asset_id
    -- (e.g. 'token:42', 'token:ETH').
    asset_id TEXT NOT NULL,

    -- Wallet that holds this lot. Matches user_wallets.address or a
    -- synthetic label for wallets not yet tracked.
    wallet_id TEXT NOT NULL,

    -- Date the lot was acquired (accounting date, not block timestamp).
    acquired_date TEXT NOT NULL,  -- ISO 8601 date 'YYYY-MM-DD'

    -- Original quantity acquired, canonical decimal string.
    quantity TEXT NOT NULL,

    -- Remaining un-consumed quantity, canonical decimal string.
    -- Decremented by lot_consumptions inserts (Rust-side; no SQL trigger
    -- because TEXT decimals are not SQL-summable).
    remaining_quantity TEXT NOT NULL,

    -- Total cost basis in functional-currency minor units (USD cents).
    cost_basis_minor INTEGER NOT NULL,

    -- Cost basis method used for this lot (informational; the engine
    -- selects lots, not the lot itself).
    cost_basis_method TEXT NOT NULL DEFAULT 'FIFO'
        CHECK(cost_basis_method IN ('FIFO', 'LIFO', 'HIFO', 'SpecificID')),

    -- FK to the journal entry that recorded this acquisition (posted).
    -- NULL when lots are seeded from opening balances.
    journal_entry_id INTEGER REFERENCES journal_entries(id),

    -- Whether the lot is fully consumed (remaining_quantity == 0).
    is_closed INTEGER NOT NULL DEFAULT 0,

    -- Audit timestamps.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cbl_asset_wallet
    ON cost_basis_lots(asset_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_cbl_open_lots
    ON cost_basis_lots(asset_id, wallet_id, is_closed, acquired_date);
CREATE INDEX IF NOT EXISTS idx_cbl_journal_entry
    ON cost_basis_lots(journal_entry_id);

-- Append-only record of lot consumption. Each row documents how much
-- of a specific lot was used in a disposal or transfer event.
CREATE TABLE IF NOT EXISTS lot_consumptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- The lot being consumed.
    lot_id INTEGER NOT NULL REFERENCES cost_basis_lots(id),

    -- Quantity consumed from this lot, canonical decimal string.
    quantity_consumed TEXT NOT NULL,

    -- Cost basis of the consumed portion in minor units.
    -- Proportional: (quantity_consumed / lot.quantity) * lot.cost_basis_minor
    cost_basis_minor INTEGER NOT NULL,

    -- Proceeds received for this consumed portion (minor units).
    -- 0 for transfers (no realization event).
    proceeds_minor INTEGER NOT NULL DEFAULT 0,

    -- Realized gain/loss in minor units (proceeds - cost_basis).
    -- 0 for transfers.
    realized_gain_loss_minor INTEGER NOT NULL DEFAULT 0,

    -- Event type: 'disposal' (sale/swap), 'transfer' (own-wallet move).
    event_type TEXT NOT NULL CHECK(event_type IN ('disposal', 'transfer')),

    -- For transfers: the destination lot ID (in the receiving wallet).
    -- NULL for disposals.
    destination_lot_id INTEGER REFERENCES cost_basis_lots(id),

    -- FK to the journal entry that recorded this event.
    journal_entry_id INTEGER REFERENCES journal_entries(id),

    -- Date of the event (accounting date).
    event_date TEXT NOT NULL,  -- ISO 8601 date 'YYYY-MM-DD'

    -- Holding period in days (event_date - lot.acquired_date).
    holding_period_days INTEGER,

    -- Whether this constitutes a long-term holding (>= 365 days).
    is_long_term INTEGER,

    -- Audit timestamp.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lc_lot
    ON lot_consumptions(lot_id);
CREATE INDEX IF NOT EXISTS idx_lc_event_type
    ON lot_consumptions(event_type);
CREATE INDEX IF NOT EXISTS idx_lc_journal_entry
    ON lot_consumptions(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_lc_destination_lot
    ON lot_consumptions(destination_lot_id);

-- Update timestamp trigger for cost_basis_lots.
CREATE TRIGGER IF NOT EXISTS cbl_update_timestamp
AFTER UPDATE ON cost_basis_lots
BEGIN
    UPDATE cost_basis_lots SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =============================================================================
-- Append-only / provenance enforcement at the DB layer (Inv-7).
-- Rust code is the primary gate; these triggers make the invariants hold
-- against ANY writer (ad-hoc SQL, future code paths, bugs).
-- =============================================================================

-- lot_consumptions is strictly append-only: no UPDATE, no DELETE.
CREATE TRIGGER IF NOT EXISTS lot_consumptions_no_update
BEFORE UPDATE ON lot_consumptions
BEGIN
    SELECT RAISE(ABORT, 'lot_consumptions is append-only: UPDATE forbidden');
END;

CREATE TRIGGER IF NOT EXISTS lot_consumptions_no_delete
BEFORE DELETE ON lot_consumptions
BEGIN
    SELECT RAISE(ABORT, 'lot_consumptions is append-only: DELETE forbidden');
END;

-- Lots may never be deleted (history must survive full consumption).
CREATE TRIGGER IF NOT EXISTS cost_basis_lots_no_delete
BEFORE DELETE ON cost_basis_lots
BEGIN
    SELECT RAISE(ABORT, 'cost_basis_lots rows may not be deleted');
END;

-- Lot identity and acquisition facts are immutable. Only the derived
-- running-balance columns (remaining_quantity, is_closed) and updated_at
-- may change after insert.
CREATE TRIGGER IF NOT EXISTS cost_basis_lots_immutable_core
BEFORE UPDATE ON cost_basis_lots
WHEN OLD.asset_id != NEW.asset_id
    OR OLD.wallet_id != NEW.wallet_id
    OR OLD.acquired_date != NEW.acquired_date
    OR OLD.quantity != NEW.quantity
    OR OLD.cost_basis_minor != NEW.cost_basis_minor
    OR OLD.cost_basis_method != NEW.cost_basis_method
    OR OLD.journal_entry_id IS NOT NEW.journal_entry_id
    OR OLD.created_at IS NOT NEW.created_at
    OR OLD.id != NEW.id
BEGIN
    SELECT RAISE(ABORT, 'cost_basis_lots core columns are immutable; only remaining_quantity/is_closed may change');
END;
