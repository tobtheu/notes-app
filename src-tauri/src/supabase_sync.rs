/// Supabase authentication helpers.
///
/// This module only handles sign-in / sign-up / token refresh.
/// All data sync is now handled client-side by ElectricSQL + PGlite.
use reqwest::Client;
use serde::{Deserialize, Serialize};
use log::info;

pub const SUPABASE_URL: &str = "https://rbyidtxmvzxzvaayllxe.supabase.co";
pub const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJieWlkdHhtdnp4enZhYXlsbHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDMxNTEsImV4cCI6MjA5MDE3OTE1MX0.uQZurIYUL6fCd-gUtH-KUlUEZrVcX5cQ4lfYnIwxPx8";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseCredentials {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: String,
    pub email: String,
}

#[derive(Deserialize, Debug)]
struct AuthUser {
    id: String,
    email: Option<String>,
}

#[derive(Deserialize, Debug)]
struct AuthResponse {
    access_token: String,
    refresh_token: String,
    user: AuthUser,
}

// ---------------------------------------------------------------------------
// Auth API calls
// ---------------------------------------------------------------------------

/// Sign in with email + password. Returns credentials on success.
pub async fn sign_in(email: &str, password: &str) -> Result<SupabaseCredentials, String> {
    let client = Client::new();
    let url = format!("{}/auth/v1/token?grant_type=password", SUPABASE_URL);

    let res = client
        .post(&url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Sign in failed ({}): {}", status, body));
    }

    let auth: AuthResponse = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
    info!("[supabase_auth] signed in: {}", auth.user.email.as_deref().unwrap_or("?"));

    Ok(SupabaseCredentials {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        user_id: auth.user.id,
        email: auth.user.email.unwrap_or_default(),
    })
}

/// Sign up with email + password. Returns credentials on success.
pub async fn sign_up(email: &str, password: &str) -> Result<SupabaseCredentials, String> {
    let client = Client::new();
    let url = format!("{}/auth/v1/signup", SUPABASE_URL);

    let res = client
        .post(&url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Sign up failed ({}): {}", status, body));
    }

    let auth: AuthResponse = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
    info!("[supabase_auth] signed up: {}", auth.user.email.as_deref().unwrap_or("?"));

    Ok(SupabaseCredentials {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        user_id: auth.user.id,
        email: auth.user.email.unwrap_or_default(),
    })
}

/// Refreshes a Supabase session using the stored refresh token.
pub async fn refresh_session(refresh_token: &str) -> Result<SupabaseCredentials, String> {
    let client = Client::new();
    let url = format!("{}/auth/v1/token?grant_type=refresh_token", SUPABASE_URL);

    let res = client
        .post(&url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed ({}): {}", status, body));
    }

    let auth: AuthResponse = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
    info!("[supabase_auth] token refreshed for: {}", auth.user.email.as_deref().unwrap_or("?"));

    Ok(SupabaseCredentials {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        user_id: auth.user.id,
        email: auth.user.email.unwrap_or_default(),
    })
}
