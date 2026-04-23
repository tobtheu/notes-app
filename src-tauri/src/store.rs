use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Supabase credentials
// ---------------------------------------------------------------------------

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseStoredCredentials {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: String,
    pub email: String,
}

pub fn get_supabase_credentials(app: &AppHandle) -> Option<SupabaseStoredCredentials> {
    let store = app.store("settings.json").ok()?;
    let val = store.get("supabase-sync")?;
    serde_json::from_value(val).ok()
}

pub fn save_supabase_credentials(app: &AppHandle, creds: &SupabaseStoredCredentials) {
    if let Ok(store) = app.store("settings.json") {
        let _ = store.set("supabase-sync", serde_json::to_value(creds).unwrap_or_default());
        let _ = store.save();
    }
}

pub fn clear_supabase_credentials(app: &AppHandle) {
    if let Ok(store) = app.store("settings.json") {
        let _ = store.delete("supabase-sync");
        let _ = store.save();
    }
}

// ---------------------------------------------------------------------------
// GitHub credentials (legacy)
// ---------------------------------------------------------------------------

pub fn save_github_credentials(app: &AppHandle, token: &str, username: &str) {
    if let Ok(store) = app.store("settings.json") {
        let _ = store.set("github-sync", serde_json::json!({
            "token": token,
            "username": username
        }));
        let _ = store.save();
    }
}

pub fn clear_github_credentials(app: &AppHandle) {
    if let Ok(store) = app.store("settings.json") {
        let _ = store.delete("github-sync");
        let _ = store.save();
    }
}
