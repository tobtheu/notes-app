use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct SyncCredentials {
    pub token: String,
    pub username: String,
}

pub fn get_github_credentials(app: &AppHandle) -> Option<SyncCredentials> {
    let store = match app.store("settings.json") {
        Ok(s) => s,
        Err(_) => return None,
    };

    let val = store.get("github-sync")?;
    serde_json::from_value(val).ok()
}

pub fn save_github_credentials(app: &AppHandle, token: &str, username: &str) {
    if let Ok(store) = app.store("settings.json") {
        let _ = store.set("github-sync", serde_json::json!({
            "token": token,
            "username": username
        }));
        let _ = store.save();
    }
}
