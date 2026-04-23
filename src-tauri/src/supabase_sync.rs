/// Supabase authentication helpers.
///
/// This module only handles sign-in / sign-up / token refresh.
/// All data sync is now handled client-side by ElectricSQL + PGlite.
use reqwest::Client;
use serde::{Deserialize, Serialize};
use log::info;
use std::time::Duration;

// Read from environment at compile time.
// Values are injected via GitHub Actions secrets (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
// and locally via the .env file (loaded by build.rs).
pub const SUPABASE_URL: &str = env!("VITE_SUPABASE_URL");
pub const SUPABASE_ANON_KEY: &str = env!("VITE_SUPABASE_ANON_KEY");
pub const LAMA_SECRET: &str = env!("VITE_LAMA_SECRET");

// Hard ceiling so a hung Supabase endpoint can't freeze sign-in/refresh.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("HTTP client init failed: {}", e))
}

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
    access_token: Option<String>,
    refresh_token: Option<String>,
    user: Option<AuthUser>,
    // GoTrue sign-up without autoconfirm returns id/email at top level
    id: Option<String>,
    email: Option<String>,
}

// ---------------------------------------------------------------------------
// Auth API calls
// ---------------------------------------------------------------------------

/// Sign in with email + password. Returns credentials on success.
pub async fn sign_in(email: &str, password: &str) -> Result<SupabaseCredentials, String> {
    let client = http_client()?;
    let url = format!("{}/auth/v1/token?grant_type=password", SUPABASE_URL);

    let res = client
        .post(&url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("X-Lama-Secret", LAMA_SECRET)
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
    let user_id = auth.user.as_ref().map(|u| u.id.clone())
        .or(auth.id.clone())
        .ok_or("No user id in response")?;
    let email_out = auth.user.as_ref().and_then(|u| u.email.clone())
        .or(auth.email.clone())
        .unwrap_or_default();
    info!("[supabase_auth] signed in: {}", email_out);

    Ok(SupabaseCredentials {
        access_token: auth.access_token.ok_or("No access_token in response")?,
        refresh_token: auth.refresh_token.ok_or("No refresh_token in response")?,
        user_id,
        email: email_out,
    })
}

/// Sign up with email + password. Returns credentials on success.
pub async fn sign_up(email: &str, password: &str) -> Result<SupabaseCredentials, String> {
    let client = http_client()?;
    let url = format!("{}/auth/v1/signup", SUPABASE_URL);

    let res = client
        .post(&url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("X-Lama-Secret", LAMA_SECRET)
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
    let user_id = auth.user.as_ref().map(|u| u.id.clone())
        .or(auth.id.clone())
        .ok_or("No user id in response")?;
    let email_out = auth.user.as_ref().and_then(|u| u.email.clone())
        .or(auth.email.clone())
        .unwrap_or_default();
    info!("[supabase_auth] signed up: {}", email_out);

    Ok(SupabaseCredentials {
        access_token: auth.access_token.ok_or("No access_token in response")?,
        refresh_token: auth.refresh_token.ok_or("No refresh_token in response")?,
        user_id,
        email: email_out,
    })
}

/// Refreshes a Supabase session using the stored refresh token.
pub async fn refresh_session(refresh_token: &str) -> Result<SupabaseCredentials, String> {
    let client = http_client()?;
    let url = format!("{}/auth/v1/token?grant_type=refresh_token", SUPABASE_URL);

    let res = client
        .post(&url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("X-Lama-Secret", LAMA_SECRET)
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
    let user_id = auth.user.as_ref().map(|u| u.id.clone())
        .or(auth.id.clone())
        .ok_or("No user id in response")?;
    let email_out = auth.user.as_ref().and_then(|u| u.email.clone())
        .or(auth.email.clone())
        .unwrap_or_default();
    info!("[supabase_auth] token refreshed for: {}", email_out);

    Ok(SupabaseCredentials {
        access_token: auth.access_token.ok_or("No access_token in response")?,
        refresh_token: auth.refresh_token.ok_or("No refresh_token in response")?,
        user_id,
        email: email_out,
    })
}
