-- Recreate transactions_with_conversions view to fix NULL comparison
-- Uses length() to avoid any direct comparison (SonarQube plsql:NullComparison)

DROP VIEW IF EXISTS transactions_with_conversions;

CREATE VIEW transactions_with_conversions AS
SELECT
    t.*,
    c.name AS currency_name,
    c.type AS currency_type,
    c.symbol AS currency_symbol,
    CASE
        WHEN length(COALESCE(t.exchange_rate, '')) > 0
        THEN CAST(t.value AS REAL) * CAST(t.exchange_rate AS REAL)
        ELSE CAST(t.value AS REAL)
    END AS calculated_primary_amount
FROM transactions t
LEFT JOIN currencies c ON t.token_symbol = c.code;
