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

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub last_sync_at: String,        // ISO 8601 — fetch remote changes newer than this
    #[serde(default)]
    pub known_ids: Vec<String>,      // note IDs present after the last successful sync
}

impl Default for SyncState {
    fn default() -> Self {
        Self { last_sync_at: "1970-01-01T00:00:00.000Z".to_string(), known_ids: Vec::new() }
    }
}

/// Returns true if the path looks like a conflict copy ("Note (Konflikt 2026-03-27).md").
fn is_conflict_copy(id: &str) -> bool {
    id.contains(" (Konflikt ")
}

pub fn load_sync_state(folder_path: &Path) -> SyncState {
    let path = folder_path.join("notizapp-sync-state.json");
    if let Ok(content) = std::fs::read_to_string(&path) {
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

pub async fn fetch_config(access_token: &str) -> Result<Option<serde_json::Value>, String> {
    let res = make_client()
        .get(format!("{}/rest/v1/app_config?select=metadata&limit=1", SUPABASE_URL))
        .headers(auth_headers(access_token))
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let rows: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().next().and_then(|r| r.get("metadata").cloned()))
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

fn is_newer(a: &str, b: &str) -> bool {
    // Returns true if timestamp a is strictly after b.
    // Falls back to string comparison (ISO 8601 is lexicographically sortable).
    a > b
}

/// Full sync: push local changes, pull remote changes, handle conflicts.
pub async fn sync(
    creds: &SupabaseCredentials,
    folder_path: &Path,
) -> Result<SupabaseSyncResult, String> {
    let mut state = load_sync_state(folder_path);

    // If there are no local .md files but the sync state is non-default,
    // this is a fresh device that somehow has a stale sync-state file.
    // Reset to epoch so we pull all notes from the server.
    let local_notes = collect_local_notes(folder_path);
    if local_notes.is_empty() && state.last_sync_at != SyncState::default().last_sync_at {
        info!("[supabase] fresh device detected (no local notes, stale sync state) — resetting last_sync_at to pull all");
        state.last_sync_at = SyncState::default().last_sync_at.clone();
    }

    let since = state.last_sync_at.clone();
    info!("[supabase] sync start, last_sync_at={}", &since[..10.min(since.len())]);
    let sync_started_at = chrono::Utc::now().to_rfc3339();

    let mut pushed = 0usize;
    let mut pulled = 0usize;
    let mut deleted = 0usize;
    let mut conflicts = 0usize;

    // ------------------------------------------------------------------
    // 1a. PUSH DELETIONS: notes that existed at last sync but are now gone
    // ------------------------------------------------------------------
    if !state.known_ids.is_empty() {
        for known_id in &state.known_ids {
            if !local_notes.contains_key(known_id.as_str()) {
                // Note was deleted locally — push deletion to Supabase
                let ts = chrono::Utc::now().to_rfc3339();
                match upsert_note(&creds.access_token, &creds.user_id, known_id, "", &ts, true).await {
                    Ok(_) => info!("[supabase] pushed deletion: {}", known_id),
                    Err(e) => info!("[supabase] push deletion failed for {}: {}", known_id, e),
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // 1b. PUSH: local notes changed since last sync (skip conflict copies)
    // ------------------------------------------------------------------
    for (rel_path, (content, updated_at)) in &local_notes {
        // Conflict copies are local resolution artifacts — never sync them
        if is_conflict_copy(rel_path) {
            continue;
        }
        if is_newer(updated_at.as_str(), since.as_str()) || since == SyncState::default().last_sync_at {
            match upsert_note(&creds.access_token, &creds.user_id, rel_path, content, updated_at, false).await {
                Ok(_) => {
                    pushed += 1;
                    info!("[supabase] pushed: {}", rel_path);
                }
                Err(e) => info!("[supabase] push failed for {}: {}", rel_path, e),
            }
        }
    }

    // ------------------------------------------------------------------
    // 2. PULL: all remote notes (full pull ensures no note is ever missed
    //    due to timestamp mismatches between devices)
    // ------------------------------------------------------------------
    let remote_notes = fetch_all_notes(&creds.access_token).await?;

    for remote in &remote_notes {
        // Conflict copies should never live on the server.
        // If one somehow exists (from an older build), mark it deleted and skip.
        if is_conflict_copy(&remote.id) {
            if !remote.deleted {
                let ts = chrono::Utc::now().to_rfc3339();
                let _ = upsert_note(&creds.access_token, &creds.user_id, &remote.id, "", &ts, true).await;
                info!("[supabase] cleaned up stale conflict copy from server: {}", remote.id);
            }
            // Also remove it locally if it somehow ended up on disk
            let local_path = folder_path.join(&remote.id);
            if local_path.exists() {
                let _ = std::fs::remove_file(&local_path);
            }
            continue;
        }

        let local_path = folder_path.join(&remote.id);

        if remote.deleted {
            // Remote deletion: only delete locally if we haven't modified the note since last sync
            if let Some((_, local_updated)) = local_notes.get(&remote.id) {
                if !is_newer(local_updated.as_str(), since.as_str()) {
                    // Not locally modified — apply remote deletion
                    if local_path.exists() {
                        let _ = std::fs::remove_file(&local_path);
                        deleted += 1;
                        info!("[supabase] deleted locally: {}", remote.id);
                    }
                }
                // else: locally modified after last sync → keep local, ignore remote deletion
            } else if local_path.exists() {
                let _ = std::fs::remove_file(&local_path);
                deleted += 1;
            }
            continue;
        }

        if let Some((local_content, local_updated)) = local_notes.get(&remote.id) {
            // Note exists both locally and remotely
            if is_newer(remote.updated_at.as_str(), local_updated.as_str()) {
                // Remote is newer → overwrite local
                if let Some(parent) = local_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&local_path, &remote.content);
                pulled += 1;
                info!("[supabase] pulled (remote newer): {}", remote.id);
            } else {
                // Conflict check: only when BOTH sides changed AFTER a real previous sync.
                // Skip on first-ever sync (since == epoch) — that would flag every note as a conflict
                // just because both timestamps are newer than 1970.
                let is_first_sync = since == SyncState::default().last_sync_at;
                let both_changed = !is_first_sync
                    && is_newer(local_updated.as_str(), since.as_str())
                    && is_newer(remote.updated_at.as_str(), since.as_str());

                if both_changed {
                    // Conflict: both changed since last sync
                    // Local wins, remote version saved as conflict copy
                    let stem = local_path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
                    let ext = local_path.extension().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "md".to_string());
                    let parent = local_path.parent().unwrap_or(folder_path);
                    let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
                    let conflict_path = parent.join(format!("{} (Konflikt {}).{}", stem, date, ext));
                    if !conflict_path.exists() {
                        let _ = std::fs::write(&conflict_path, &remote.content);
                        conflicts += 1;
                        info!("[supabase] conflict copy created: {}", remote.id);
                    }
                    // Push local version again to make sure remote has it
                    let _ = upsert_note(&creds.access_token, &creds.user_id, &remote.id, local_content, local_updated, false).await;
                }
                // else: local is newer or same, or first-sync → no action needed (already pushed above)
            }
        } else {
            // New note from remote → write locally
            if let Some(parent) = local_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(&local_path, &remote.content);
            pulled += 1;
            info!("[supabase] pulled (new): {}", remote.id);
        }
    }

    // ------------------------------------------------------------------
    // 3. Update sync state
    // ------------------------------------------------------------------
    state.last_sync_at = sync_started_at;
    // Snapshot current local IDs (excluding conflict copies) so next sync
    // can detect deletions and push them to Supabase.
    state.known_ids = local_notes.keys()
        .filter(|id| !is_conflict_copy(id))
        .cloned()
        .collect();
    save_sync_state(folder_path, &state);

    let had_changes = pulled > 0 || deleted > 0 || conflicts > 0;
    info!("[supabase] sync done — pushed={} pulled={} deleted={} conflicts={}", pushed, pulled, deleted, conflicts);

    Ok(SupabaseSyncResult {
        pushed_count: pushed,
        pulled_count: pulled,
        deleted_count: deleted,
        conflict_count: conflicts,
        had_changes,
    })
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

fn urlencoding(s: &str) -> String {
    s.replace(':', "%3A").replace('+', "%2B").replace(' ', "%20")
}
