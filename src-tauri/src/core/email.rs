//! Email Service using Resend
//!
//! Provides email sending functionality for transactional emails
//! like verification, password reset, and security alerts.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

static RESEND_API_KEY: OnceLock<String> = OnceLock::new();

/// Initialize the email service with API key
pub fn init(api_key: String) {
    let _ = RESEND_API_KEY.set(api_key);
}

/// Get the API key, returns None if not initialized
fn get_api_key() -> Option<&'static String> {
    RESEND_API_KEY.get()
}

/// Email address with optional name
#[derive(Debug, Clone, Serialize)]
pub struct EmailAddress {
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

impl EmailAddress {
    pub fn new(email: impl Into<String>) -> Self {
        Self {
            email: email.into(),
            name: None,
        }
    }

    pub fn with_name(email: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            email: email.into(),
            name: Some(name.into()),
        }
    }
}

/// Request body for Resend API
#[derive(Debug, Serialize)]
struct ResendRequest {
    from: String,
    to: Vec<String>,
    subject: String,
    html: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
}

/// Response from Resend API
#[derive(Debug, Deserialize)]
struct ResendResponse {
    #[allow(dead_code)]
    id: String,
}

/// Error response from Resend API
#[derive(Debug, Deserialize)]
struct ResendError {
    message: String,
}

/// Send an email via Resend
pub async fn send_email(
    to: &str,
    subject: &str,
    html_body: &str,
    text_body: Option<&str>,
) -> Result<(), String> {
    let api_key = get_api_key().ok_or("Email service not initialized")?;

    let client = reqwest::Client::new();

    let request = ResendRequest {
        from: "Pacioli <noreply@pacioli.io>".to_string(),
        to: vec![to.to_string()],
        subject: subject.to_string(),
        html: html_body.to_string(),
        text: text_body.map(|s| s.to_string()),
    };

    let response = client
        .post("https://api.resend.com/emails")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to send email: {}", e))?;

    if response.status().is_success() {
        Ok(())
    } else {
        let error: ResendError = response
            .json()
            .await
            .unwrap_or(ResendError {
                message: "Unknown error".to_string(),
            });
        Err(format!("Email API error: {}", error.message))
    }
}

// =============================================================================
// Email Templates
// =============================================================================

/// Send email verification for email change
pub async fn send_email_change_verification(
    to: &str,
    verification_token: &str,
    new_email: &str,
) -> Result<(), String> {
    let subject = "Verify your new email address - Pacioli";

    // For now, just include the token. In production, this would be a clickable link.
    let html_body = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #283747 0%, #1a252f 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Pacioli</h1>
        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Crypto-Inclusive Accounting Platform</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #283747; margin-top: 0;">Verify Your New Email Address</h2>

        <p>You've requested to change your email address to:</p>
        <p style="background: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 14px;">{}</p>

        <p>To complete this change, use the verification code below:</p>

        <div style="background: #283747; color: #fff; padding: 16px 24px; border-radius: 6px; text-align: center; margin: 24px 0;">
            <code style="font-size: 18px; letter-spacing: 2px;">{}</code>
        </div>

        <p style="color: #64748b; font-size: 14px;">This code expires in 24 hours. If you didn't request this change, you can safely ignore this email or use the cancellation link sent to your current email.</p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
            This email was sent by Pacioli. If you have questions, contact support@pacioli.io
        </p>
    </div>
</body>
</html>"#,
        new_email, verification_token
    );

    let text_body = format!(
        "Verify Your New Email Address\n\n\
        You've requested to change your email address to: {}\n\n\
        Verification code: {}\n\n\
        This code expires in 24 hours. If you didn't request this change, you can safely ignore this email.\n\n\
        - Pacioli Team",
        new_email, verification_token
    );

    send_email(to, subject, &html_body, Some(&text_body)).await
}

/// Send security alert about email change to old email
pub async fn send_email_change_alert(
    to: &str,
    cancellation_token: &str,
    new_email: &str,
) -> Result<(), String> {
    let subject = "Security Alert: Email Change Requested - Pacioli";

    let html_body = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #283747 0%, #1a252f 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Pacioli</h1>
        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Crypto-Inclusive Accounting Platform</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
            <strong style="color: #92400e;">Security Alert</strong>
        </div>

        <h2 style="color: #283747; margin-top: 0;">Email Change Requested</h2>

        <p>Someone has requested to change the email address associated with your Pacioli account to:</p>
        <p style="background: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 14px;">{}</p>

        <p><strong>If this was you:</strong> No action needed. The change will complete once the new email is verified.</p>

        <p><strong>If this wasn't you:</strong> Use the cancellation code below to stop this change immediately:</p>

        <div style="background: #dc2626; color: #fff; padding: 16px 24px; border-radius: 6px; text-align: center; margin: 24px 0;">
            <code style="font-size: 18px; letter-spacing: 2px;">{}</code>
        </div>

        <p style="color: #64748b; font-size: 14px;">This request expires in 24 hours. After that, no changes will be made to your account.</p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
            This email was sent by Pacioli. If you have questions, contact support@pacioli.io
        </p>
    </div>
</body>
</html>"#,
        new_email, cancellation_token
    );

    let text_body = format!(
        "SECURITY ALERT: Email Change Requested\n\n\
        Someone has requested to change the email address associated with your Pacioli account to: {}\n\n\
        If this was you: No action needed. The change will complete once the new email is verified.\n\n\
        If this wasn't you: Use this cancellation code to stop the change: {}\n\n\
        This request expires in 24 hours.\n\n\
        - Pacioli Team",
        new_email, cancellation_token
    );

    send_email(to, subject, &html_body, Some(&text_body)).await
}

/// Send password reset email
pub async fn send_password_reset(to: &str, reset_token: &str) -> Result<(), String> {
    let subject = "Reset your password - Pacioli";

    let html_body = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #283747 0%, #1a252f 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Pacioli</h1>
        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Crypto-Inclusive Accounting Platform</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #283747; margin-top: 0;">Reset Your Password</h2>

        <p>We received a request to reset your password. Use the code below to set a new password:</p>

        <div style="background: #283747; color: #fff; padding: 16px 24px; border-radius: 6px; text-align: center; margin: 24px 0;">
            <code style="font-size: 18px; letter-spacing: 2px;">{}</code>
        </div>

        <p style="color: #64748b; font-size: 14px;">This code expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
            This email was sent by Pacioli. If you have questions, contact support@pacioli.io
        </p>
    </div>
</body>
</html>"#,
        reset_token
    );

    let text_body = format!(
        "Reset Your Password\n\n\
        We received a request to reset your password.\n\n\
        Reset code: {}\n\n\
        This code expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.\n\n\
        - Pacioli Team",
        reset_token
    );

    send_email(to, subject, &html_body, Some(&text_body)).await
}

/// Send welcome email after registration
pub async fn send_welcome_email(to: &str, display_name: &str) -> Result<(), String> {
    let subject = "Welcome to Pacioli!";

    let html_body = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #283747 0%, #1a252f 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Pacioli</h1>
        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Crypto-Inclusive Accounting Platform</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #283747; margin-top: 0;">Welcome, {}!</h2>

        <p>Thanks for joining Pacioli. You're all set to start tracking and managing your crypto assets with professional-grade accounting tools.</p>

        <h3 style="color: #283747;">Getting Started</h3>
        <ul style="padding-left: 20px;">
            <li>Connect your wallets to start tracking transactions</li>
            <li>Set up your accounting profiles</li>
            <li>Import historical transaction data</li>
            <li>Generate reports for tax and compliance</li>
        </ul>

        <p>If you have any questions, don't hesitate to reach out to our support team.</p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
            This email was sent by Pacioli. If you have questions, contact support@pacioli.io
        </p>
    </div>
</body>
</html>"#,
        display_name
    );

    let text_body = format!(
        "Welcome, {}!\n\n\
        Thanks for joining Pacioli. You're all set to start tracking and managing your crypto assets with professional-grade accounting tools.\n\n\
        Getting Started:\n\
        - Connect your wallets to start tracking transactions\n\
        - Set up your accounting profiles\n\
        - Import historical transaction data\n\
        - Generate reports for tax and compliance\n\n\
        If you have any questions, don't hesitate to reach out to our support team.\n\n\
        - Pacioli Team",
        display_name
    );

    send_email(to, subject, &html_body, Some(&text_body)).await
}
