-- =============================================================================
-- USER AUTHENTICATION SYSTEM
-- Self-hosted multi-tenant authentication with role-based profile access
-- =============================================================================

-- Users table (global across all profiles)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email_verified INTEGER DEFAULT 0,
    email_verification_token TEXT,
    email_verification_expires_at DATETIME,

    -- Password authentication
    password_hash TEXT,  -- NULL if using external auth only
    password_reset_token TEXT,
    password_reset_expires_at DATETIME,

    -- User details
    display_name TEXT NOT NULL,
    avatar_url TEXT,

    -- Account status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),

    -- External auth identifiers (for future OAuth/SSO)
    external_auth_provider TEXT,  -- 'google', 'github', 'saml', 'oidc'
    external_auth_id TEXT,

    -- Security
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_secret TEXT,
    two_factor_backup_codes TEXT,  -- JSON array of hashed codes
    failed_login_attempts INTEGER DEFAULT 0,
    lockout_until DATETIME,

    -- Audit
    last_login_at DATETIME,
    last_login_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_external_auth ON users(external_auth_provider, external_auth_id);

-- Sessions table (JWT refresh tokens / session management)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Token management
    refresh_token_hash TEXT NOT NULL,

    -- Session metadata
    device_name TEXT,
    device_type TEXT,  -- 'desktop', 'web', 'mobile'
    ip_address TEXT,
    user_agent TEXT,

    -- Expiration
    expires_at DATETIME NOT NULL,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Status
    revoked INTEGER DEFAULT 0,
    revoked_at DATETIME,
    revoked_reason TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- User-Profile roles (many-to-many with role)
CREATE TABLE IF NOT EXISTS user_profile_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,

    -- Role assignment
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'preparer', 'approver', 'admin', 'owner')),

    -- Invitation tracking
    invited_by_user_id TEXT,
    invited_at DATETIME,
    accepted_at DATETIME,

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_roles_user ON user_profile_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_roles_profile ON user_profile_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_roles_role ON user_profile_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_profile_roles_status ON user_profile_roles(status);

-- Invitations table (for pending invitations)
CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE,
    profile_id TEXT NOT NULL,

    -- Invitation details
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'preparer', 'approver', 'admin')),
    token TEXT NOT NULL UNIQUE,
    token_expires_at DATETIME NOT NULL,

    -- Sender
    invited_by_user_id TEXT NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
    accepted_at DATETIME,

    -- Metadata
    message TEXT,  -- Optional message from inviter

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_profile ON invitations(profile_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- Audit log for security events
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,  -- NULL for failed logins with unknown user

    -- Event details
    event_type TEXT NOT NULL,  -- 'login', 'logout', 'password_change', 'role_change', etc.
    event_status TEXT NOT NULL,  -- 'success', 'failure'
    event_details TEXT,  -- JSON for additional details

    -- Context
    ip_address TEXT,
    user_agent TEXT,

    -- Target (for role changes, invitations, etc.)
    target_user_id TEXT,
    target_profile_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (target_profile_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON auth_audit_log(created_at);

-- System settings for auth configuration
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
    ('auth_session_timeout_minutes', '60', CURRENT_TIMESTAMP),
    ('auth_max_failed_attempts', '5', CURRENT_TIMESTAMP),
    ('auth_lockout_duration_minutes', '15', CURRENT_TIMESTAMP),
    ('auth_require_2fa', 'false', CURRENT_TIMESTAMP),
    ('auth_password_min_length', '8', CURRENT_TIMESTAMP),
    ('auth_invitation_expiry_hours', '72', CURRENT_TIMESTAMP),
    ('auth_access_token_expiry_minutes', '15', CURRENT_TIMESTAMP),
    ('auth_refresh_token_expiry_days', '7', CURRENT_TIMESTAMP);

-- Update trigger for users
CREATE TRIGGER IF NOT EXISTS users_update_timestamp
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update trigger for user_profile_roles
CREATE TRIGGER IF NOT EXISTS user_profile_roles_update_timestamp
AFTER UPDATE ON user_profile_roles
BEGIN
    UPDATE user_profile_roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
