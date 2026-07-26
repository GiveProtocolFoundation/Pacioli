-- Classification rules table: user-visible, ordered, enable/disable-able rules
-- that drive auto_classify_transaction instead of hardcoded heuristics.
CREATE TABLE IF NOT EXISTS classification_rules (
    id          TEXT    PRIMARY KEY NOT NULL,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    -- Which tx_type(s) this rule matches (comma-separated, e.g. "claim,stake")
    match_tx_types      TEXT NOT NULL,
    -- Optional chain filter (comma-separated chain_ids, empty = all chains)
    match_chains        TEXT NOT NULL DEFAULT '',
    -- "self_transfer" condition: "any" (default), "true", "false"
    match_self_transfer TEXT NOT NULL DEFAULT 'any',
    -- GL account numbers for debit and credit legs
    debit_account       TEXT NOT NULL,
    credit_account      TEXT NOT NULL,
    -- Description templates for debit / credit JE lines
    debit_line_desc     TEXT NOT NULL DEFAULT '',
    credit_line_desc    TEXT NOT NULL DEFAULT '',
    -- JE description template (may contain {chain}, {hash}, {type})
    je_description      TEXT NOT NULL DEFAULT '',
    -- Whether this rule uses the fee amount instead of the transfer amount
    use_fee_amount      INTEGER NOT NULL DEFAULT 0,
    -- Priority ordering (lower = higher priority, evaluated first)
    priority            INTEGER NOT NULL DEFAULT 1000,
    -- Whether this rule is currently active
    enabled             INTEGER NOT NULL DEFAULT 1,
    -- "builtin" for starter-pack rules, "user" for user-created
    source              TEXT NOT NULL DEFAULT 'user',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_classification_rules_priority
    ON classification_rules(priority, enabled);
