-- =============================================================================
-- EMAIL CHANGE REQUESTS
-- Secure email change flow with verification and cancellation support
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_change_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    old_email TEXT NOT NULL,
    new_email TEXT NOT NULL COLLATE NOCASE,

    -- Verification tokens
    verification_token TEXT NOT NULL UNIQUE,
    cancellation_token TEXT NOT NULL UNIQUE,

    -- Timestamps
    expires_at DATETIME NOT NULL,
    verified_at DATETIME,
    cancelled_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Request metadata
    ip_address TEXT,
    user_agent TEXT,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_email_change_user ON email_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_email_change_verification ON email_change_requests(verification_token);
CREATE INDEX IF NOT EXISTS idx_email_change_cancellation ON email_change_requests(cancellation_token);
CREATE INDEX IF NOT EXISTS idx_email_change_expires ON email_change_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_change_new_email ON email_change_requests(new_email);
