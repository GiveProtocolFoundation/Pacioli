-- Extend classification_rules for bank transaction matching (GIV-829).
-- New columns let rules target crypto vs bank transactions and match on
-- payee text or amount sign.

ALTER TABLE classification_rules
    ADD COLUMN source_kind         TEXT NOT NULL DEFAULT 'crypto'
        CHECK(source_kind IN ('crypto', 'bank', 'any'));

ALTER TABLE classification_rules
    ADD COLUMN match_payee_pattern TEXT NOT NULL DEFAULT '';

ALTER TABLE classification_rules
    ADD COLUMN match_amount_sign   TEXT NOT NULL DEFAULT 'any'
        CHECK(match_amount_sign IN ('positive', 'negative', 'any'));

-- Payee → GL account quick-map: lightweight shortcut that maps a payee
-- pattern directly to a GL account without the full rule structure.
CREATE TABLE IF NOT EXISTS payee_gl_map (
    id                 TEXT    PRIMARY KEY NOT NULL,
    payee_pattern      TEXT    NOT NULL,
    match_mode         TEXT    NOT NULL DEFAULT 'contains'
        CHECK(match_mode IN ('contains', 'exact', 'starts_with')),
    gl_account_number  TEXT    NOT NULL,
    description        TEXT    NOT NULL DEFAULT '',
    enabled            INTEGER NOT NULL DEFAULT 1,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payee_gl_map_pattern
    ON payee_gl_map(payee_pattern, match_mode);
