//! Authentication API Commands
//!
//! Provides Tauri commands for user authentication, session management,
//! profile role management, and invitation system.

use crate::api::persistence::DatabaseState;
use crate::core::auth_helpers::{
    generate_access_token, generate_invitation_token, generate_session_id, hash_password,
    hash_token, validate_email, validate_password_strength, verify_access_token, verify_password,
    verify_refresh_token,
};
use crate::core::auth_state::AuthState;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub email_verified: bool,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub status: String,
    pub two_factor_enabled: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Extended profile fields
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub phone: Option<String>,
    pub company: Option<String>,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub location: Option<String>,
    pub timezone: Option<String>,
    pub language: Option<String>,
    pub date_format: Option<String>,
    // Notification preferences
    pub email_notifications: Option<bool>,
    pub sms_notifications: Option<bool>,
    pub login_alerts: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: User,
    pub expires_in: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginCredentials {
    pub email: String,
    pub password: String,
    pub device_name: Option<String>,
    pub device_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterInput {
    pub email: String,
    pub password: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserUpdate {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    // Extended profile fields
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub phone: Option<String>,
    pub company: Option<String>,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub location: Option<String>,
    pub timezone: Option<String>,
    pub language: Option<String>,
    pub date_format: Option<String>,
    // Notification preferences
    pub email_notifications: Option<bool>,
    pub sms_notifications: Option<bool>,
    pub login_alerts: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub device_name: Option<String>,
    pub device_type: Option<String>,
    pub ip_address: Option<String>,
    pub last_activity_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub device_name: Option<String>,
    pub device_type: Option<String>,
    pub ip_address: Option<String>,
    pub last_activity_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub is_current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserProfileRole {
    pub id: String,
    pub user_id: String,
    pub profile_id: String,
    pub role: String,
    pub status: String,
    pub invited_at: Option<DateTime<Utc>>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProfileWithRole {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub role_status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserWithRole {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub role_status: String,
    pub invited_at: Option<DateTime<Utc>>,
    pub accepted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Invitation {
    pub id: String,
    pub email: String,
    pub profile_id: String,
    pub role: String,
    pub status: String,
    pub message: Option<String>,
    pub token_expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvitationInput {
    pub email: String,
    pub profile_id: String,
    pub role: String,
    pub message: Option<String>,
}

/// Invitation details with associated profile information
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvitationWithProfile {
    /// Unique invitation identifier
    pub id: String,
    /// Email address of the invited user
    pub email: String,
    /// Profile the user is invited to join
    pub profile_id: String,
    /// Display name of the profile
    pub profile_name: String,
    /// Role assigned to the invited user
    pub role: String,
    /// Current invitation status
    pub status: String,
    /// Optional message from the inviter
    pub message: Option<String>,
    /// Name of the user who sent the invitation
    pub invited_by_name: String,
    /// When the invitation token expires
    pub token_expires_at: DateTime<Utc>,
    /// When the invitation was created
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Authentication Commands
// ============================================================================

/// Register a new user
#[tauri::command]
pub async fn register(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    input: RegisterInput,
) -> Result<AuthResponse, String> {
    // Validate input
    validate_email(&input.email)?;
    validate_password_strength(&input.password, 8)?;

    if input.display_name.trim().is_empty() {
        return Err("Display name cannot be empty".to_string());
    }

    let pool = &db.pool;

    // Check if email already exists
    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE email = ?")
        .bind(input.email.to_lowercase())
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if existing.is_some() {
        return Err("An account with this email already exists".to_string());
    }

    // Hash password
    let password_hash = hash_password(&input.password)?;

    // Create user
    let user_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
        "#,
    )
    .bind(&user_id)
    .bind(input.email.to_lowercase())
    .bind(&password_hash)
    .bind(&input.display_name)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create user: {}", e))?;

    // Create default profile for the user
    let profile_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO profiles (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        "#,
    )
    .bind(&profile_id)
    .bind(format!("{}'s Workspace", &input.display_name))
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create default profile: {}", e))?;

    // Assign user as owner of the profile
    let role_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO user_profile_roles (id, user_id, profile_id, role, status, accepted_at, created_at, updated_at)
        VALUES (?, ?, ?, 'owner', 'active', ?, ?, ?)
        "#,
    )
    .bind(&role_id)
    .bind(&user_id)
    .bind(&profile_id)
    .bind(now)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to assign profile role: {}", e))?;

    // Create session and return tokens
    create_session_and_tokens(&db, &auth, &user_id, &input.email, None, None).await
}

/// Login with email and password
#[tauri::command]
pub async fn login(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    credentials: LoginCredentials,
) -> Result<AuthResponse, String> {
    let pool = &db.pool;
    let email = credentials.email.to_lowercase();

    // Find user
    let user_row: Option<(String, String, String, i32, Option<DateTime<Utc>>, i32)> =
        sqlx::query_as(
            r#"
        SELECT id, password_hash, status, failed_login_attempts, lockout_until, two_factor_enabled
        FROM users WHERE email = ?
        "#,
        )
        .bind(&email)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let (user_id, password_hash, status, failed_attempts, lockout_until, _two_factor) =
        user_row.ok_or("Invalid email or password")?;

    // Check lockout
    if let Some(lockout) = lockout_until {
        if lockout > Utc::now() {
            return Err("Account is temporarily locked. Please try again later.".to_string());
        }
    }

    // Check account status
    if status != "active" {
        return Err(format!("Account is {}", status));
    }

    // Verify password
    let is_valid = verify_password(&credentials.password, &password_hash)?;

    if !is_valid {
        // Increment failed attempts
        let new_attempts = failed_attempts + 1;
        let lockout_time = if new_attempts >= 5 {
            Some(Utc::now() + Duration::minutes(15))
        } else {
            None
        };

        sqlx::query("UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?")
            .bind(new_attempts)
            .bind(lockout_time)
            .bind(&user_id)
            .execute(pool)
            .await
            .ok();

        // Log failed attempt
        log_audit_event(
            pool,
            Some(&user_id),
            "login",
            "failure",
            Some("Invalid password"),
            None,
            None,
        )
        .await;

        return Err("Invalid email or password".to_string());
    }

    // Reset failed attempts and update last login
    sqlx::query(
        r#"
        UPDATE users
        SET failed_login_attempts = 0, lockout_until = NULL, last_login_at = ?
        WHERE id = ?
        "#,
    )
    .bind(Utc::now())
    .bind(&user_id)
    .execute(pool)
    .await
    .ok();

    // Log successful login
    log_audit_event(pool, Some(&user_id), "login", "success", None, None, None).await;

    // Create session and return tokens
    create_session_and_tokens(
        &db,
        &auth,
        &user_id,
        &email,
        credentials.device_name.as_deref(),
        credentials.device_type.as_deref(),
    )
    .await
}

/// Logout (invalidate session)
#[tauri::command]
pub async fn logout(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
) -> Result<(), String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Revoke all sessions for this user from this token
    // (In a more sophisticated system, you'd track the specific session)
    sqlx::query("UPDATE sessions SET revoked = 1, revoked_at = ?, revoked_reason = 'logout' WHERE user_id = ? AND revoked = 0")
        .bind(Utc::now())
        .bind(&claims.sub)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to logout: {}", e))?;

    // Invalidate cache
    auth.invalidate_user_sessions(&claims.sub);

    // Log logout
    log_audit_event(
        pool,
        Some(&claims.sub),
        "logout",
        "success",
        None,
        None,
        None,
    )
    .await;

    Ok(())
}

/// Refresh access token using refresh token
#[tauri::command]
pub async fn refresh_token(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    refresh_token: String,
) -> Result<AuthResponse, String> {
    let claims = verify_refresh_token(&refresh_token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    let session_id = claims
        .session_id
        .ok_or("Invalid refresh token: no session ID")?;

    // Verify session is still valid
    let session: Option<(String, i32)> = sqlx::query_as(
        "SELECT user_id, revoked FROM sessions WHERE id = ? AND refresh_token_hash = ?",
    )
    .bind(&session_id)
    .bind(hash_token(&refresh_token))
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (user_id, revoked) = session.ok_or("Session not found or expired")?;

    if revoked != 0 {
        return Err("Session has been revoked".to_string());
    }

    // Verify user ID matches
    if user_id != claims.sub {
        return Err("Invalid refresh token".to_string());
    }

    // Update session activity
    sqlx::query("UPDATE sessions SET last_activity_at = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(&session_id)
        .execute(pool)
        .await
        .ok();

    // Get user
    let user = get_user_by_id(pool, &user_id).await?;

    // Generate new access token (keep same refresh token)
    let access_token =
        generate_access_token(&user.id, &user.email, auth.get_jwt_secret(), Some(15))?;

    Ok(AuthResponse {
        access_token,
        refresh_token, // Return the same refresh token
        user,
        expires_in: 15 * 60, // 15 minutes in seconds
    })
}

/// Verify and decode an access token
#[tauri::command]
pub async fn verify_token(
    auth: State<'_, AuthState>,
    token: String,
) -> Result<crate::core::auth_helpers::TokenClaims, String> {
    verify_access_token(&token, auth.get_jwt_secret())
}

// ============================================================================
// User Management Commands
// ============================================================================

/// Get the currently authenticated user
#[tauri::command]
pub async fn get_current_user(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
) -> Result<User, String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    get_user_by_id(&db.pool, &claims.sub).await
}

/// Update user profile
#[tauri::command]
pub async fn update_user(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    update: UserUpdate,
) -> Result<User, String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Validate display_name if provided
    if let Some(ref name) = update.display_name {
        if name.trim().is_empty() {
            return Err("Display name cannot be empty".to_string());
        }
    }

    // Use a more flexible approach with direct SQL building
    let now = Utc::now();

    sqlx::query(
        r#"
        UPDATE users SET
            display_name = COALESCE(?, display_name),
            avatar_url = COALESCE(?, avatar_url),
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            phone = COALESCE(?, phone),
            company = COALESCE(?, company),
            job_title = COALESCE(?, job_title),
            department = COALESCE(?, department),
            location = COALESCE(?, location),
            timezone = COALESCE(?, timezone),
            language = COALESCE(?, language),
            date_format = COALESCE(?, date_format),
            email_notifications = COALESCE(?, email_notifications),
            sms_notifications = COALESCE(?, sms_notifications),
            login_alerts = COALESCE(?, login_alerts),
            updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&update.display_name)
    .bind(&update.avatar_url)
    .bind(&update.first_name)
    .bind(&update.last_name)
    .bind(&update.phone)
    .bind(&update.company)
    .bind(&update.job_title)
    .bind(&update.department)
    .bind(&update.location)
    .bind(&update.timezone)
    .bind(&update.language)
    .bind(&update.date_format)
    .bind(&update.email_notifications)
    .bind(&update.sms_notifications)
    .bind(&update.login_alerts)
    .bind(now)
    .bind(&claims.sub)
    .execute(pool)
        .await
        .map_err(|e| format!("Failed to update user: {}", e))?;

    get_user_by_id(pool, &claims.sub).await
}

/// Change password
#[tauri::command]
pub async fn change_password(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Validate new password
    validate_password_strength(&new_password, 8)?;

    // Get current password hash
    let current_hash: (String,) = sqlx::query_as("SELECT password_hash FROM users WHERE id = ?")
        .bind(&claims.sub)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    // Verify old password
    if !verify_password(&old_password, &current_hash.0)? {
        return Err("Current password is incorrect".to_string());
    }

    // Hash new password
    let new_hash = hash_password(&new_password)?;

    // Update password
    sqlx::query("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
        .bind(&new_hash)
        .bind(Utc::now())
        .bind(&claims.sub)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update password: {}", e))?;

    // Invalidate all sessions (force re-login)
    sqlx::query("UPDATE sessions SET revoked = 1, revoked_at = ?, revoked_reason = 'password_change' WHERE user_id = ?")
        .bind(Utc::now())
        .bind(&claims.sub)
        .execute(pool)
        .await
        .ok();

    auth.invalidate_user_sessions(&claims.sub);

    // Log password change
    log_audit_event(
        pool,
        Some(&claims.sub),
        "password_change",
        "success",
        None,
        None,
        None,
    )
    .await;

    Ok(())
}

// ============================================================================
// Session Management Commands
// ============================================================================

/// Get all sessions for the current user
#[tauri::command]
pub async fn get_user_sessions(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
) -> Result<Vec<SessionInfo>, String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    let sessions: Vec<Session> = sqlx::query_as(
        r#"
        SELECT id, user_id, device_name, device_type, ip_address, last_activity_at, created_at
        FROM sessions
        WHERE user_id = ? AND revoked = 0 AND expires_at > ?
        ORDER BY last_activity_at DESC
        "#,
    )
    .bind(&claims.sub)
    .bind(Utc::now())
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Get current session ID from token if it's a refresh token
    let current_session_id = claims.session_id;

    Ok(sessions
        .into_iter()
        .map(|s| SessionInfo {
            is_current: current_session_id.as_ref() == Some(&s.id),
            id: s.id,
            device_name: s.device_name,
            device_type: s.device_type,
            ip_address: s.ip_address,
            last_activity_at: s.last_activity_at,
            created_at: s.created_at,
        })
        .collect())
}

/// Revoke a specific session
#[tauri::command]
pub async fn revoke_session(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    session_id: String,
) -> Result<(), String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Verify session belongs to user
    let session: Option<(String,)> =
        sqlx::query_as("SELECT user_id FROM sessions WHERE id = ? AND user_id = ?")
            .bind(&session_id)
            .bind(&claims.sub)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    if session.is_none() {
        return Err("Session not found".to_string());
    }

    sqlx::query(
        "UPDATE sessions SET revoked = 1, revoked_at = ?, revoked_reason = 'user_revoked' WHERE id = ?",
    )
    .bind(Utc::now())
    .bind(&session_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to revoke session: {}", e))?;

    auth.invalidate_session(&session_id);

    Ok(())
}

/// Revoke all sessions except current
#[tauri::command]
pub async fn revoke_all_sessions(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
) -> Result<(), String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    sqlx::query(
        "UPDATE sessions SET revoked = 1, revoked_at = ?, revoked_reason = 'user_revoked_all' WHERE user_id = ? AND revoked = 0",
    )
    .bind(Utc::now())
    .bind(&claims.sub)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to revoke sessions: {}", e))?;

    auth.invalidate_user_sessions(&claims.sub);

    Ok(())
}

// ============================================================================
// Profile Role Management Commands
// ============================================================================

/// Get all profiles the user has access to
#[tauri::command]
pub async fn get_user_profiles(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
) -> Result<Vec<ProfileWithRole>, String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    let profiles: Vec<ProfileWithRole> = sqlx::query_as(
        r#"
        SELECT p.id, p.name, p.avatar_url, upr.role, upr.status as role_status, p.created_at
        FROM profiles p
        INNER JOIN user_profile_roles upr ON p.id = upr.profile_id
        WHERE upr.user_id = ? AND upr.status = 'active'
        ORDER BY p.name
        "#,
    )
    .bind(&claims.sub)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(profiles)
}

/// Get all users with access to a profile
#[tauri::command]
pub async fn get_profile_users(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    profile_id: String,
) -> Result<Vec<UserWithRole>, String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Verify user has admin access to this profile
    verify_profile_access(pool, &claims.sub, &profile_id, &["owner", "admin"]).await?;

    let users: Vec<UserWithRole> = sqlx::query_as(
        r#"
        SELECT u.id, u.email, u.display_name, u.avatar_url,
               upr.role, upr.status as role_status, upr.invited_at, upr.accepted_at
        FROM users u
        INNER JOIN user_profile_roles upr ON u.id = upr.user_id
        WHERE upr.profile_id = ?
        ORDER BY
            CASE upr.role
                WHEN 'owner' THEN 1
                WHEN 'admin' THEN 2
                WHEN 'approver' THEN 3
                WHEN 'preparer' THEN 4
                ELSE 5
            END,
            u.display_name
        "#,
    )
    .bind(&profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(users)
}

/// Update a user's role in a profile
#[tauri::command]
pub async fn update_user_role(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    user_id: String,
    profile_id: String,
    role: String,
) -> Result<UserProfileRole, String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Validate role
    let valid_roles = ["user", "preparer", "approver", "admin"];
    if !valid_roles.contains(&role.as_str()) {
        return Err(format!(
            "Invalid role: {}. Valid roles are: {:?}",
            role, valid_roles
        ));
    }

    // Verify user has admin access
    verify_profile_access(pool, &claims.sub, &profile_id, &["owner", "admin"]).await?;

    // Cannot change owner's role
    let target_role: Option<(String,)> =
        sqlx::query_as("SELECT role FROM user_profile_roles WHERE user_id = ? AND profile_id = ?")
            .bind(&user_id)
            .bind(&profile_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    if let Some((current_role,)) = target_role {
        if current_role == "owner" {
            return Err("Cannot change owner's role".to_string());
        }
    } else {
        return Err("User does not have access to this profile".to_string());
    }

    // Update role
    sqlx::query(
        "UPDATE user_profile_roles SET role = ?, updated_at = ? WHERE user_id = ? AND profile_id = ?",
    )
    .bind(&role)
    .bind(Utc::now())
    .bind(&user_id)
    .bind(&profile_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update role: {}", e))?;

    // Log role change
    log_audit_event(
        pool,
        Some(&claims.sub),
        "role_change",
        "success",
        Some(&format!("Changed to {}", role)),
        Some(&user_id),
        Some(&profile_id),
    )
    .await;

    // Return updated role
    sqlx::query_as("SELECT * FROM user_profile_roles WHERE user_id = ? AND profile_id = ?")
        .bind(&user_id)
        .bind(&profile_id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))
}

/// Remove a user from a profile
#[tauri::command]
pub async fn remove_user_from_profile(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    user_id: String,
    profile_id: String,
) -> Result<(), String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Verify user has admin access
    verify_profile_access(pool, &claims.sub, &profile_id, &["owner", "admin"]).await?;

    // Cannot remove owner
    let target_role: Option<(String,)> =
        sqlx::query_as("SELECT role FROM user_profile_roles WHERE user_id = ? AND profile_id = ?")
            .bind(&user_id)
            .bind(&profile_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    if let Some((role,)) = target_role {
        if role == "owner" {
            return Err("Cannot remove profile owner".to_string());
        }
    }

    // Cannot remove yourself if you're the one making the request
    if user_id == claims.sub {
        return Err("Cannot remove yourself from a profile".to_string());
    }

    // Remove access
    sqlx::query("UPDATE user_profile_roles SET status = 'revoked', updated_at = ? WHERE user_id = ? AND profile_id = ?")
        .bind(Utc::now())
        .bind(&user_id)
        .bind(&profile_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to remove user: {}", e))?;

    // Log removal
    log_audit_event(
        pool,
        Some(&claims.sub),
        "user_removed",
        "success",
        None,
        Some(&user_id),
        Some(&profile_id),
    )
    .await;

    Ok(())
}

// ============================================================================
// Invitation Commands
// ============================================================================

/// Create an invitation to join a profile
#[tauri::command]
pub async fn create_invitation(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    invitation: InvitationInput,
) -> Result<Invitation, String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Validate email
    validate_email(&invitation.email)?;

    // Validate role
    let valid_roles = ["user", "preparer", "approver", "admin"];
    if !valid_roles.contains(&invitation.role.as_str()) {
        return Err(format!("Invalid role: {}", invitation.role));
    }

    // Verify user has admin access to invite
    verify_profile_access(
        pool,
        &claims.sub,
        &invitation.profile_id,
        &["owner", "admin"],
    )
    .await?;

    // Check if user already has access
    let existing_access: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM user_profile_roles WHERE profile_id = ? AND user_id IN (SELECT id FROM users WHERE email = ?)",
    )
    .bind(&invitation.profile_id)
    .bind(invitation.email.to_lowercase())
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if existing_access.is_some() {
        return Err("User already has access to this profile".to_string());
    }

    // Check for existing pending invitation
    let existing_invitation: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM invitations WHERE email = ? AND profile_id = ? AND status = 'pending'",
    )
    .bind(invitation.email.to_lowercase())
    .bind(&invitation.profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if existing_invitation.is_some() {
        return Err("An invitation is already pending for this email".to_string());
    }

    // Create invitation
    let invitation_id = Uuid::new_v4().to_string();
    let invite_token = generate_invitation_token();
    let now = Utc::now();
    let expires_at = now + Duration::hours(72);

    sqlx::query(
        r#"
        INSERT INTO invitations (id, email, profile_id, role, token, token_expires_at, invited_by_user_id, message, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        "#,
    )
    .bind(&invitation_id)
    .bind(invitation.email.to_lowercase())
    .bind(&invitation.profile_id)
    .bind(&invitation.role)
    .bind(&invite_token)
    .bind(expires_at)
    .bind(&claims.sub)
    .bind(&invitation.message)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create invitation: {}", e))?;

    // Log invitation
    log_audit_event(
        pool,
        Some(&claims.sub),
        "invitation_created",
        "success",
        Some(&invitation.email),
        None,
        Some(&invitation.profile_id),
    )
    .await;

    sqlx::query_as("SELECT id, email, profile_id, role, status, message, token_expires_at, created_at FROM invitations WHERE id = ?")
        .bind(&invitation_id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))
}

/// Get all invitations for a profile
#[tauri::command]
pub async fn get_profile_invitations(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    profile_id: String,
) -> Result<Vec<Invitation>, String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Verify user has admin access
    verify_profile_access(pool, &claims.sub, &profile_id, &["owner", "admin"]).await?;

    let invitations: Vec<Invitation> = sqlx::query_as(
        r#"
        SELECT id, email, profile_id, role, status, message, token_expires_at, created_at
        FROM invitations
        WHERE profile_id = ?
        ORDER BY created_at DESC
        "#,
    )
    .bind(&profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(invitations)
}

/// Accept an invitation (can be used by new or existing users)
#[tauri::command]
pub async fn accept_invitation(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    invitation_token: String,
    user_token: Option<String>,
    new_user: Option<RegisterInput>,
) -> Result<AuthResponse, String> {
    let pool = &db.pool;

    // Find invitation by token
    let invitation: Option<(String, String, String, String, String, DateTime<Utc>)> =
        sqlx::query_as(
            r#"
        SELECT id, email, profile_id, role, status, token_expires_at
        FROM invitations WHERE token = ?
        "#,
        )
        .bind(&invitation_token)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let (inv_id, inv_email, profile_id, role, status, expires_at) =
        invitation.ok_or("Invalid invitation token")?;

    // Check invitation status
    if status != "pending" {
        return Err(format!("Invitation has already been {}", status));
    }

    // Check expiration
    if expires_at < Utc::now() {
        sqlx::query("UPDATE invitations SET status = 'expired' WHERE id = ?")
            .bind(&inv_id)
            .execute(pool)
            .await
            .ok();
        return Err("Invitation has expired".to_string());
    }

    let user_id: String;
    let user_email: String;

    // Handle existing user login or new user registration
    if let Some(token) = user_token {
        // Existing user accepting invitation
        let claims = verify_access_token(&token, auth.get_jwt_secret())?;

        // Verify email matches
        if claims.email.to_lowercase() != inv_email.to_lowercase() {
            return Err("This invitation was sent to a different email address".to_string());
        }

        user_id = claims.sub;
        user_email = claims.email;
    } else if let Some(input) = new_user {
        // New user registration
        if input.email.to_lowercase() != inv_email.to_lowercase() {
            return Err("Email must match the invitation email".to_string());
        }

        // Register the new user (but don't create default profile)
        validate_email(&input.email)?;
        validate_password_strength(&input.password, 8)?;

        let password_hash = hash_password(&input.password)?;
        let new_user_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?)
            "#,
        )
        .bind(&new_user_id)
        .bind(input.email.to_lowercase())
        .bind(&password_hash)
        .bind(&input.display_name)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to create user: {}", e))?;

        user_id = new_user_id;
        user_email = input.email.to_lowercase();
    } else {
        return Err(
            "Must provide either user_token (existing user) or new_user (registration)".to_string(),
        );
    }

    // Add user to profile with the invited role
    let role_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO user_profile_roles (id, user_id, profile_id, role, status, invited_at, accepted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
        "#,
    )
    .bind(&role_id)
    .bind(&user_id)
    .bind(&profile_id)
    .bind(&role)
    .bind(now)
    .bind(now)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to add user to profile: {}", e))?;

    // Mark invitation as accepted
    sqlx::query("UPDATE invitations SET status = 'accepted', accepted_at = ? WHERE id = ?")
        .bind(now)
        .bind(&inv_id)
        .execute(pool)
        .await
        .ok();

    // Create session and return tokens
    create_session_and_tokens(&db, &auth, &user_id, &user_email, None, None).await
}

/// Revoke an invitation
#[tauri::command]
pub async fn revoke_invitation(
    db: State<'_, DatabaseState>,
    auth: State<'_, AuthState>,
    token: String,
    invitation_id: String,
) -> Result<(), String> {
    let claims = verify_access_token(&token, auth.get_jwt_secret())?;
    let pool = &db.pool;

    // Get invitation to verify profile access
    let invitation: Option<(String,)> =
        sqlx::query_as("SELECT profile_id FROM invitations WHERE id = ? AND status = 'pending'")
            .bind(&invitation_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

    let (profile_id,) = invitation.ok_or("Invitation not found or not pending")?;

    // Verify user has admin access
    verify_profile_access(pool, &claims.sub, &profile_id, &["owner", "admin"]).await?;

    sqlx::query("UPDATE invitations SET status = 'revoked' WHERE id = ?")
        .bind(&invitation_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to revoke invitation: {}", e))?;

    Ok(())
}

// ============================================================================
// Helper Functions
// ============================================================================

async fn get_user_by_id(pool: &sqlx::SqlitePool, user_id: &str) -> Result<User, String> {
    sqlx::query_as(
        r#"
        SELECT id, email, email_verified, display_name, avatar_url, status,
               two_factor_enabled, last_login_at, created_at, updated_at,
               first_name, last_name, phone, company, job_title, department, location,
               timezone, language, date_format,
               email_notifications, sms_notifications, login_alerts
        FROM users WHERE id = ?
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("User not found: {}", e))
}

async fn create_session_and_tokens(
    db: &State<'_, DatabaseState>,
    auth: &State<'_, AuthState>,
    user_id: &str,
    email: &str,
    device_name: Option<&str>,
    device_type: Option<&str>,
) -> Result<AuthResponse, String> {
    let pool = &db.pool;
    let session_id = generate_session_id();
    let now = Utc::now();
    let expires_at = now + Duration::days(7);

    // Generate tokens
    let access_token = generate_access_token(user_id, email, auth.get_jwt_secret(), Some(15))?;

    let refresh_token = crate::core::auth_helpers::generate_refresh_token(
        user_id,
        email,
        &session_id,
        auth.get_jwt_secret(),
        Some(7),
    )?;

    // Store session
    sqlx::query(
        r#"
        INSERT INTO sessions (id, user_id, refresh_token_hash, device_name, device_type, expires_at, created_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&session_id)
    .bind(user_id)
    .bind(hash_token(&refresh_token))
    .bind(device_name)
    .bind(device_type)
    .bind(expires_at)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create session: {}", e))?;

    // Cache session
    auth.cache_session(&session_id, user_id, email);

    // Get user
    let user = get_user_by_id(pool, user_id).await?;

    Ok(AuthResponse {
        access_token,
        refresh_token,
        user,
        expires_in: 15 * 60, // 15 minutes in seconds
    })
}

async fn verify_profile_access(
    pool: &sqlx::SqlitePool,
    user_id: &str,
    profile_id: &str,
    required_roles: &[&str],
) -> Result<(), String> {
    let role: Option<(String, String)> = sqlx::query_as(
        "SELECT role, status FROM user_profile_roles WHERE user_id = ? AND profile_id = ?",
    )
    .bind(user_id)
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    match role {
        Some((role, status)) => {
            if status != "active" {
                return Err("Your access to this profile has been suspended".to_string());
            }
            if !required_roles.contains(&role.as_str()) {
                return Err(format!(
                    "Insufficient permissions. Required: {:?}, you have: {}",
                    required_roles, role
                ));
            }
            Ok(())
        }
        None => Err("You don't have access to this profile".to_string()),
    }
}

async fn log_audit_event(
    pool: &sqlx::SqlitePool,
    user_id: Option<&str>,
    event_type: &str,
    event_status: &str,
    event_details: Option<&str>,
    target_user_id: Option<&str>,
    target_profile_id: Option<&str>,
) {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO auth_audit_log (id, user_id, event_type, event_status, event_details, target_user_id, target_profile_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(user_id)
    .bind(event_type)
    .bind(event_status)
    .bind(event_details)
    .bind(target_user_id)
    .bind(target_profile_id)
    .bind(Utc::now())
    .execute(pool)
    .await
    .ok();
}
