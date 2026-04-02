use reqwest::Client;
use serde::{Deserialize, Serialize};
use log::info;
use std::path::Path;
use std::collections::HashMap;

pub const SUPABASE_URL: &str = "https://rbyidtxmvzxzvaayllxe.supabase.co";
pub const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJieWlkdHhtdnp4enZhYXlsbHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDMxNTEsImV4cCI6MjA5MDE3OTE1MX0.uQZurIYUL6fCd-gUtH-KUlUEZrVcX5cQ4lfYnIwxPx8";

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseCredentials {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: String,
    pub email: String,
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RemoteNote {
    pub id: String,         // relative path, e.g. "Arbeit/notiz.md"
    pub content: String,
    pub updated_at: String, // ISO 8601
    pub deleted: bool,
}

// ---------------------------------------------------------------------------
// Sync state (stored per-device in notizapp-sync-state.json)
// ---------------------------------------------------------------------------

/// Per-device sync state. Stores the last-synced `updated_at` timestamp for
/// every note. This replaces the old GitHub-era `last_sync_at` + `known_ids`
/// approach: with a real database we compare per-note timestamps directly.
///
/// `known[id] = ts` means: "after the last sync, both local and remote agreed
/// on this note at timestamp `ts`."  Missing entry = never synced on this device.
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    #[serde(default)]
    pub known: HashMap<String, String>,
}

/// Returns true if the path looks like a conflict copy ("Note (Konflikt 2026-03-27).md").
fn is_conflict_copy(id: &str) -> bool {
    id.contains(" (Konflikt ")
}

pub fn load_sync_state(folder_path: &Path) -> SyncState {
    let path = folder_path.join("notizapp-sync-state.json");
    if let Ok(content) = std::fs::read_to_string(&path) {
        // Deserialise; gracefully falls back to empty state if format changed.
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        SyncState::default()
    }
}

pub fn save_sync_state(folder_path: &Path, state: &SyncState) {
    let path = folder_path.join("notizapp-sync-state.json");
    if let Ok(content) = serde_json::to_string_pretty(state) {
        let _ = std::fs::write(path, content);
    }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

fn make_client() -> Client {
    Client::new()
}

fn auth_headers(access_token: &str) -> reqwest::header::HeaderMap {
    let mut h = reqwest::header::HeaderMap::new();
    h.insert("apikey", SUPABASE_ANON_KEY.parse().unwrap());
    h.insert("Authorization", format!("Bearer {}", access_token).parse().unwrap());
    h.insert("Content-Type", "application/json".parse().unwrap());
    h
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

pub async fn sign_in(email: &str, password: &str) -> Result<SupabaseCredentials, String> {
    let res = make_client()
        .post(format!("{}/auth/v1/token?grant_type=password", SUPABASE_URL))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let auth: AuthResponse = res.json().await.map_err(|e| e.to_string())?;
        info!("[supabase] signed in as {}", auth.user.email.as_deref().unwrap_or("?"));
        Ok(SupabaseCredentials {
            access_token: auth.access_token,
            refresh_token: auth.refresh_token,
            user_id: auth.user.id,
            email: auth.user.email.unwrap_or_default(),
        })
    } else {
        let err = res.text().await.unwrap_or_default();
        Err(format!("Anmeldung fehlgeschlagen: {}", err))
    }
}

pub async fn sign_up(email: &str, password: &str) -> Result<SupabaseCredentials, String> {
    let res = make_client()
        .post(format!("{}/auth/v1/signup", SUPABASE_URL))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        // Supabase returns the user but may require email confirmation
        if let (Some(token), Some(refresh), Some(user)) = (
            body.get("access_token").and_then(|v| v.as_str()),
            body.get("refresh_token").and_then(|v| v.as_str()),
            body.get("user"),
        ) {
            info!("[supabase] signed up");
            Ok(SupabaseCredentials {
                access_token: token.to_string(),
                refresh_token: refresh.to_string(),
                user_id: user.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                email: user.get("email").and_then(|v| v.as_str()).unwrap_or(email).to_string(),
            })
        } else {
            // Email confirmation required
            Err("Registrierung fast abgeschlossen! Bitte bestätige deine E-Mail-Adresse und melde dich dann an.".to_string())
        }
    } else {
        let err = res.text().await.unwrap_or_default();
        Err(format!("Registrierung fehlgeschlagen: {}", err))
    }
}

pub async fn refresh_session(refresh_token: &str) -> Result<SupabaseCredentials, String> {
    let res = make_client()
        .post(format!("{}/auth/v1/token?grant_type=refresh_token", SUPABASE_URL))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "refresh_token": refresh_token }))
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let auth: AuthResponse = res.json().await.map_err(|e| e.to_string())?;
        info!("[supabase] token refreshed");
        Ok(SupabaseCredentials {
            access_token: auth.access_token,
            refresh_token: auth.refresh_token,
            user_id: auth.user.id,
            email: auth.user.email.unwrap_or_default(),
        })
    } else {
        Err("Sitzung abgelaufen. Bitte erneut anmelden.".to_string())
    }
}

// ---------------------------------------------------------------------------
// Notes CRUD
// ---------------------------------------------------------------------------

/// Fetch ALL notes for the current user (no date filter).
/// Used during the pull phase so new devices always receive every note,
/// regardless of when the note was originally written or pushed.
pub async fn fetch_all_notes(access_token: &str) -> Result<Vec<RemoteNote>, String> {
    // Supabase REST: no row limit by default; set a generous ceiling via Range header.
    let url = format!(
        "{}/rest/v1/notes?select=id,content,updated_at,deleted&order=updated_at.asc",
        SUPABASE_URL
    );
    let res = make_client()
        .get(&url)
        .headers(auth_headers(access_token))
        .header("Range-Unit", "items")
        .header("Range", "0-9999")
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let notes: Vec<RemoteNote> = res.json().await.map_err(|e| e.to_string())?;
        info!("[supabase] fetch_all_notes: {} notes", notes.len());
        Ok(notes)
    } else {
        let err = res.text().await.unwrap_or_default();
        Err(format!("Notizen abrufen fehlgeschlagen: {}", err))
    }
}

/// Insert or update a note. `id` is the relative path (e.g. "Folder/note.md").
pub async fn upsert_note(
    access_token: &str,
    user_id: &str,
    id: &str,
    content: &str,
    updated_at: &str,
    deleted: bool,
) -> Result<(), String> {
    let res = make_client()
        .post(format!("{}/rest/v1/notes", SUPABASE_URL))
        .headers(auth_headers(access_token))
        .header("Prefer", "resolution=merge-duplicates,return=minimal")
        .json(&serde_json::json!({
            "id": id,
            "user_id": user_id,
            "content": content,
            "updated_at": updated_at,
            "deleted": deleted
        }))
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() || res.status().as_u16() == 201 || res.status().as_u16() == 204 {
        Ok(())
    } else {
        let err = res.text().await.unwrap_or_default();
        Err(format!("Notiz '{}' speichern fehlgeschlagen: {}", id, err))
    }
}

// ---------------------------------------------------------------------------
// App config (folder order, pins, settings)
// ---------------------------------------------------------------------------

pub async fn fetch_config(access_token: &str) -> Result<Option<(serde_json::Value, String)>, String> {
    let res = make_client()
        .get(format!("{}/rest/v1/app_config?select=metadata,updated_at&limit=1", SUPABASE_URL))
        .headers(auth_headers(access_token))
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let rows: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
        if let Some(row) = rows.into_iter().next() {
            let meta = row.get("metadata").cloned().unwrap_or(serde_json::json!({}));
            let updated_at = row.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
            Ok(Some((meta, updated_at)))
        } else {
            Ok(None)
        }
    } else {
        let err = res.text().await.unwrap_or_default();
        Err(format!("Konfiguration abrufen fehlgeschlagen: {}", err))
    }
}

pub async fn upsert_config(
    access_token: &str,
    user_id: &str,
    metadata: &serde_json::Value,
) -> Result<(), String> {
    let res = make_client()
        .post(format!("{}/rest/v1/app_config", SUPABASE_URL))
        .headers(auth_headers(access_token))
        .header("Prefer", "resolution=merge-duplicates,return=minimal")
        .json(&serde_json::json!({
            "user_id": user_id,
            "metadata": metadata,
            "updated_at": chrono::Utc::now().to_rfc3339()
        }))
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() || res.status().as_u16() == 201 || res.status().as_u16() == 204 {
        Ok(())
    } else {
        let err = res.text().await.unwrap_or_default();
        Err(format!("Konfiguration speichern fehlgeschlagen: {}", err))
    }
}

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseSyncResult {
    pub pulled_count: usize,
    pub pushed_count: usize,
    pub deleted_count: usize,
    pub conflict_count: usize,
    pub had_changes: bool,
}

/// Reads all local .md files. Returns HashMap<relative_path, (content, updated_at)>.
fn collect_local_notes(folder_path: &Path) -> HashMap<String, (String, String)> {
    let mut map = HashMap::new();
    collect_recursive(folder_path, folder_path, &mut map);
    map
}

fn collect_recursive(root: &Path, dir: &Path, out: &mut HashMap<String, (String, String)>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                if !name.starts_with('.') {
                    collect_recursive(root, &path, out);
                }
            } else if path.extension().map_or(false, |e| e == "md") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    let relative = path.strip_prefix(root)
                        .map(|p| p.to_string_lossy().replace('\\', "/"))
                        .unwrap_or_default()
                        .to_string();
                    let updated_at = extract_updated_at(&content, &path);
                    out.insert(relative, (content, updated_at));
                }
            }
        }
    }
}

/// Extracts `updated:` from frontmatter, or falls back to filesystem mtime.
fn extract_updated_at(content: &str, path: &Path) -> String {
    if content.starts_with("---\n") || content.starts_with("---\r\n") {
        let after = if content.starts_with("---\r\n") { 5 } else { 4 };
        if let Some(close) = content[after..].find("\n---") {
            for line in content[after..after + close].lines() {
                if line.trim().starts_with("updated:") {
                    let val = line.trim_start_matches("updated:").trim().trim_matches('"').trim_matches('\'');
                    if !val.is_empty() {
                        return val.to_string();
                    }
                }
            }
        }
    }
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.to_rfc3339()
        })
        .unwrap_or_else(|_| chrono::Utc::now().to_rfc3339())
}

/// Sets the filesystem mtime of a file to match a remote timestamp (RFC 3339).
/// This ensures notes without `updated:` frontmatter show the correct edit time
/// rather than the time they were written by sync.
fn set_file_mtime(path: &Path, ts: &str) {
    use chrono::DateTime;
    if let Ok(dt) = DateTime::parse_from_rfc3339(ts) {
        let mtime = filetime::FileTime::from_unix_time(dt.timestamp(), dt.timestamp_subsec_nanos());
        let _ = filetime::set_file_mtime(path, mtime);
    }
}

fn is_newer(a: &str, b: &str) -> bool {
    // Parse RFC 3339 for correct timezone-aware comparison.
    // "+01:00" and "Z" are handled correctly; falls back to string compare.
    use chrono::DateTime;
    match (DateTime::parse_from_rfc3339(a), DateTime::parse_from_rfc3339(b)) {
        (Ok(ta), Ok(tb)) => ta > tb,
        _ => a > b,
    }
}

/// Sync app config (folder icons/colors, pinned notes, folder order, settings).
///
/// Order: pull → merge → save locally → push merged.
/// Pulling first ensures changes from other devices are applied before we push.
/// Pushing AFTER merge ensures the server always has the latest merged state.
///
/// Per-device fields (fontSize, fontFamily) are never sent to Supabase and
/// are always preserved from the local file regardless of what remote says.
async fn sync_config(access_token: &str, user_id: &str, config_path: &Path) {
    // Step 1: pull remote config
    let remote_data = match fetch_config(access_token).await {
        Ok(r) => r,
        Err(e) => { info!("[supabase] config: fetch failed: {}", e); None }
    };

    // Step 2: read local config (or start from an empty base)
    let local_raw = std::fs::read_to_string(config_path).unwrap_or_default();
    let mut local: serde_json::Value = serde_json::from_str(&local_raw)
        .unwrap_or_else(|_| serde_json::json!({ "folders": {}, "pinnedNotes": [], "settings": {} }));

    // Preserve per-device settings before any merge overwrites them
    let per_device: HashMap<String, serde_json::Value> = {
        let mut m = HashMap::new();
        if let Some(ls) = local.get("settings").and_then(|s| s.as_object()) {
            for key in &["fontSize", "fontFamily"] {
                if let Some(v) = ls.get(*key) {
                    m.insert(key.to_string(), v.clone());
                }
            }
        }
        m
    };

    // Step 3: always merge remote into local.
    // File mtime is not a reliable signal (local writes from repair/init skew it).
    // Strategy: remote wins per-key for folders/settings; local-only keys are kept.
    if let Some((remote_meta, _)) = &remote_data {
        info!("[supabase] config: merging remote into local");

        // folders: remote values win per key, local-only keys kept
        if let Some(remote_folders) = remote_meta.get("folders").and_then(|f| f.as_object()) {
            let base = local["folders"].as_object().cloned().unwrap_or_default();
            let mut merged = base;
            for (k, v) in remote_folders {
                merged.insert(k.clone(), v.clone());
            }
            local["folders"] = serde_json::Value::Object(merged);
        }

        if let Some(pinned) = remote_meta.get("pinnedNotes").and_then(|p| p.as_array()) {
            let mut merged: Vec<serde_json::Value> = local["pinnedNotes"]
                .as_array().cloned().unwrap_or_default();
            for item in pinned {
                if !merged.contains(item) {
                    merged.push(item.clone());
                }
            }
            local["pinnedNotes"] = serde_json::Value::Array(merged);
        }
        if let Some(order) = remote_meta.get("folderOrder") {
            if !order.is_null() {
                local["folderOrder"] = order.clone();
            }
        }

        // settings: remote wins, then restore per-device fields on top
        if let Some(remote_settings) = remote_meta.get("settings").and_then(|s| s.as_object()) {
            let mut merged = remote_settings.clone();
            for (k, v) in &per_device {
                merged.insert(k.clone(), v.clone());
            }
            local["settings"] = serde_json::Value::Object(merged);
        }
    }

    // Ensure per-device fields are always present
    if let Some(settings) = local.get_mut("settings").and_then(|s| s.as_object_mut()) {
        for (k, v) in &per_device {
            settings.entry(k.clone()).or_insert_with(|| v.clone());
        }
    }

    // Step 4: save merged config locally
    if let Ok(merged_str) = serde_json::to_string_pretty(&local) {
        let _ = std::fs::write(config_path, &merged_str);
        info!("[supabase] config: saved locally");
    }

    // Step 5: push to remote if content differs from what remote has
    let mut push_payload = local.clone();
    if let Some(settings) = push_payload.get_mut("settings").and_then(|s| s.as_object_mut()) {
        settings.remove("fontSize");
        settings.remove("fontFamily");
    }

    let should_push = if let Some((ref remote_m, _)) = remote_data {
        &push_payload != remote_m
    } else {
        true // No remote data existed yet
    };

    if should_push {
        match upsert_config(access_token, user_id, &push_payload).await {
            Ok(_) => info!("[supabase] config: pushed"),
            Err(e) => info!("[supabase] config: push failed: {}", e),
        }
    } else {
        info!("[supabase] config: no changes to push");
    }
}

/// Full sync: pull remote → push local changes → sync config.
///
/// Uses per-note timestamp tracking (`state.known`) instead of a global
/// `last_sync_at`.  This is database-native: we compare each note's local
/// timestamp against the last-synced timestamp and the current remote
/// timestamp independently, so there is no ambiguity about "what changed".
///
/// Decision table (known = last synced state):
/// ┌─────────────────┬─────────────────┬─────────────────────────────┐
/// │ local changed?  │ remote changed? │ action                      │
/// ├─────────────────┼─────────────────┼─────────────────────────────┤
/// │ no              │ no              │ nothing                     │
/// │ yes             │ no              │ push local → server         │
/// │ no              │ yes             │ pull remote → local         │
/// │ yes             │ yes             │ newest timestamp wins       │
/// │ yes (deleted)   │ –               │ push deleted=true           │
/// │ –               │ yes (deleted)   │ delete local (if unchanged) │
/// └─────────────────┴─────────────────┴─────────────────────────────┘
pub async fn sync(
    creds: &SupabaseCredentials,
    folder_path: &Path,
) -> Result<SupabaseSyncResult, String> {
    let mut state = load_sync_state(folder_path);
    let local_notes = collect_local_notes(folder_path);

    info!("[supabase] sync start — {} local notes, {} known", local_notes.len(), state.known.len());

    let mut pushed = 0usize;
    let mut pulled = 0usize;
    let mut deleted = 0usize;

    // ------------------------------------------------------------------
    // 1. PULL: fetch all remote notes, apply changes to local filesystem
    // ------------------------------------------------------------------
    let remote_notes = fetch_all_notes(&creds.access_token).await?;
    let mut remote_map: HashMap<String, RemoteNote> = HashMap::new();
    for note in remote_notes {
        remote_map.insert(note.id.clone(), note);
    }

    for (id, remote) in &remote_map {
        // Conflict copies should never exist on the server — clean up any legacy ones.
        if is_conflict_copy(id) {
            if !remote.deleted {
                let ts = chrono::Utc::now().to_rfc3339();
                let _ = upsert_note(&creds.access_token, &creds.user_id, id, "", &ts, true).await;
                info!("[supabase] cleaned up stale conflict copy from server: {}", id);
            }
            let p = folder_path.join(id);
            if p.exists() { let _ = std::fs::remove_file(&p); }
            continue;
        }

        let local_path = folder_path.join(id);
        let known_ts = state.known.get(id.as_str()); // last agreed-upon timestamp, if any

        if remote.deleted {
            // Apply remote deletion only when local was not modified since last sync.
            let local_unchanged = match (local_notes.get(id.as_str()), known_ts) {
                (Some((_, local_ts)), Some(k)) => local_ts == k,
                (None, _) => true,  // already gone locally — nothing to do
                (Some(_), None) => false, // exists locally but never synced → locally new, keep it
            };
            if local_unchanged && local_path.exists() {
                let _ = std::fs::remove_file(&local_path);
                deleted += 1;
                info!("[supabase] deleted locally: {}", id);
            }
            continue;
        }

        let remote_changed = known_ts.map_or(true, |k| &remote.updated_at != k);

        match local_notes.get(id.as_str()) {
            None => {
                // Note exists remotely but not locally → pull it.
                if let Some(parent) = local_path.parent() { let _ = std::fs::create_dir_all(parent); }
                let _ = std::fs::write(&local_path, &remote.content);
                set_file_mtime(&local_path, &remote.updated_at);
                pulled += 1;
                info!("[supabase] pulled (new): {}", id);
            }
            Some((local_content, local_ts)) => {
                let local_changed = known_ts.map_or(true, |k| local_ts != k);

                if remote_changed && !local_changed {
                    // Only remote changed → overwrite local if content differs.
                    if remote.content.trim() != local_content.trim() {
                        if let Some(parent) = local_path.parent() { let _ = std::fs::create_dir_all(parent); }
                        let _ = std::fs::write(&local_path, &remote.content);
                        set_file_mtime(&local_path, &remote.updated_at);
                        pulled += 1;
                        info!("[supabase] pulled (remote changed): {}", id);
                    }
                } else if remote_changed && local_changed {
                    // Both changed → newest timestamp wins; no conflict copies.
                    if is_newer(remote.updated_at.as_str(), local_ts.as_str())
                        && remote.content.trim() != local_content.trim()
                    {
                        if let Some(parent) = local_path.parent() { let _ = std::fs::create_dir_all(parent); }
                        let _ = std::fs::write(&local_path, &remote.content);
                        set_file_mtime(&local_path, &remote.updated_at);
                        pulled += 1;
                        info!("[supabase] pulled (both changed, remote newer): {}", id);
                    }
                    // else: local is newer → will be pushed in step 2
                }
                // if only local changed or neither changed → no pull action needed
            }
        }
    }

    // Re-collect after pull so the push phase sees the updated local state.
    let local_after_pull = collect_local_notes(folder_path);

    // ------------------------------------------------------------------
    // 2. PUSH: local notes that are new or changed since last sync,
    //    and local deletions (note was in `known` but is gone now).
    // ------------------------------------------------------------------

    // 2a. Deletions
    for (known_id, _) in &state.known {
        if is_conflict_copy(known_id) { continue; }
        if !local_after_pull.contains_key(known_id.as_str()) {
            let ts = chrono::Utc::now().to_rfc3339();
            match upsert_note(&creds.access_token, &creds.user_id, known_id, "", &ts, true).await {
                Ok(_) => info!("[supabase] pushed deletion: {}", known_id),
                Err(e) => info!("[supabase] push deletion failed for {}: {}", known_id, e),
            }
        }
    }

    // 2b. New and modified notes
    for (id, (content, local_ts)) in &local_after_pull {
        if is_conflict_copy(id) { continue; }

        let local_changed = state.known.get(id.as_str()).map_or(true, |k| local_ts != k);
        let not_on_server = !remote_map.contains_key(id.as_str())
            || remote_map.get(id.as_str()).map_or(false, |r| r.deleted);

        if local_changed || not_on_server {
            // Don't push if we just pulled a newer version of this note.
            let remote_is_newer = remote_map.get(id.as_str())
                .map_or(false, |r| is_newer(r.updated_at.as_str(), local_ts.as_str()));
            if !remote_is_newer {
                match upsert_note(&creds.access_token, &creds.user_id, id, content, local_ts, false).await {
                    Ok(_) => { pushed += 1; info!("[supabase] pushed: {}", id); }
                    Err(e) => info!("[supabase] push failed for {}: {}", id, e),
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // 3. CONFIG SYNC
    // ------------------------------------------------------------------
    let config_path = folder_path.join("notizapp-config.json");
    sync_config(&creds.access_token, &creds.user_id, &config_path).await;

    // ------------------------------------------------------------------
    // 4. Save sync state: record the agreed-upon timestamp for every note
    //    that exists locally after this sync.
    // ------------------------------------------------------------------
    state.known = local_after_pull.iter()
        .filter(|(id, _)| !is_conflict_copy(id))
        .map(|(id, (_, ts))| (id.clone(), ts.clone()))
        .collect();
    save_sync_state(folder_path, &state);

    let had_changes = pulled > 0 || deleted > 0;
    info!("[supabase] sync done — pushed={} pulled={} deleted={}", pushed, pulled, deleted);

    Ok(SupabaseSyncResult {
        pushed_count: pushed,
        pulled_count: pulled,
        deleted_count: deleted,
        conflict_count: 0,
        had_changes,
    })
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

fn urlencoding(s: &str) -> String {
    s.replace(':', "%3A").replace('+', "%2B").replace(' ', "%20")
}
