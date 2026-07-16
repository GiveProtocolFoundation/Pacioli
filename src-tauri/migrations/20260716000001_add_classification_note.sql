-- GIV-683 Phase 4 review hardening: persist the optional skip/ignore reason.
-- Workflow metadata only (same category as classification_status, added in
-- 20260326000001). The financial raw fields (value, fee, hash, addresses,
-- timestamp) remain immutable per Inv-5 — this column never affects them.
ALTER TABLE multi_chain_transactions
    ADD COLUMN classification_note TEXT;
