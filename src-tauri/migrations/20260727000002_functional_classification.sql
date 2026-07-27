-- =============================================================================
-- FUNCTIONAL CLASSIFICATION ON JOURNAL ENTRY LINES (GIV-757)
--
-- Adds a nullable functional_classification column for NGO dimensional tagging.
-- UI surfaces this only for NGO profiles (Child 3 / GIV-759).
-- =============================================================================

ALTER TABLE journal_entry_lines ADD COLUMN functional_classification TEXT
    CHECK (functional_classification IN ('program_services', 'management_general', 'fundraising')
           OR functional_classification IS NULL);
