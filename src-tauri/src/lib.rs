use serde::{Deserialize, Serialize};
use log::info;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;
use std::sync::{Arc, Mutex};
use notify::{Watcher, RecursiveMode};
use tauri::{Emitter, Manager};
use base64::{engine::general_purpose, Engine as _};
use filetime::FileTime;

#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod git;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod github;
mod store;
mod supabase_sync;

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub filename: String,
    pub folder: String,
    pub content: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppMetadata {
    pub folders: serde_json::Value,
    #[serde(default)]
    pub pinned_notes: Vec<String>,
    #[serde(default)]
    pub folder_order: Option<Vec<String>>,
    #[serde(default)]
    pub settings: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

fn get_files_recursively(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with('.') || name_str == "node_modules"
                        || name_str == "target" || name_str == "dist"
                        || name_str == "src-tauri"
                    {
                        continue;
                    }
                }
                files.extend(get_files_recursively(&path));
            } else {
                files.push(path);
            }
        }
    }
    files
}

/// Injects or updates the `updated` field in YAML frontmatter.
fn inject_frontmatter(content: &str, timestamp: &str) -> String {
    if content.starts_with("---\n") || content.starts_with("---\r\n") {
        let after_open = if content.starts_with("---\r\n") { 5 } else { 4 };
        if let Some(close_pos) = content[after_open..].find("\n---") {
            let frontmatter = &content[after_open..after_open + close_pos];
            let rest = &content[after_open + close_pos + 4..];
            let mut lines: Vec<String> = frontmatter.lines().map(|l| l.to_string()).collect();
            let mut found = false;
            for line in &mut lines {
                if line.trim().starts_with("updated:") {
                    *line = format!("updated: {}", timestamp);
                    found = true;
                    break;
                }
            }
            if !found {
                lines.push(format!("updated: {}", timestamp));
            }
            return format!("---\n{}\n---{}", lines.join("\n"), rest);
        }
    }
    format!("---\nupdated: {}\n---\n{}", timestamp, content)
}

// ---------------------------------------------------------------------------
// Path safety helpers
// ---------------------------------------------------------------------------

/// Returns true if a single path component is safe: no traversal, no absolute
/// paths, no null bytes, no control characters.
fn is_safe_component(s: &str) -> bool {
    !s.is_empty()
        && s != ".."
        && s != "."
        && !s.contains('\0')
        && !s.contains('/')
        && !s.contains('\\')
}

/// Validates that every component of a relative path (e.g. "Work/note.md") is safe.
fn is_safe_relative_path(rel: &str) -> bool {
    if rel.is_empty() { return true; }
    rel.split('/').all(is_safe_component)
}

/// Canonicalizes `path` and verifies it stays inside `root`.
/// Returns Err if the path escapes the root (path traversal).
fn assert_within_root(root: &std::path::Path, path: &std::path::Path) -> Result<(), String> {
    // If path doesn't exist yet, walk up until we find an existing ancestor.
    let canonical_path = {
        let mut p = path.to_path_buf();
        let mut suffix = std::path::PathBuf::new();
        loop {
            if p.exists() {
                let mut full = p.canonicalize().map_err(|e| e.to_string())?;
                full.push(suffix);
                break full;
            }
            match p.file_name() {
                Some(name) => {
                    suffix = std::path::Path::new(name).join(&suffix);
                    p = p.parent().unwrap_or(&p).to_path_buf();
                }
                None => break path.to_path_buf(),
            }
        }
    };
    let canonical_root = root.canonicalize().map_err(|e| e.to_string())?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err(format!("Path traversal detected: {:?} is outside {:?}", canonical_path, canonical_root));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// File Mirror — write .md files from PGlite changes
// ---------------------------------------------------------------------------

/// Payload sent from the frontend when a note changes in PGlite.
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MirrorNotePayload {
    pub mirror_folder: String,
    pub note: Note,
}

/// Payload for deleting a mirrored .md file.
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeleteMirrorPayload {
    pub mirror_folder: String,
    pub note_id: String,  // normalized path e.g. "work/my-note.md"
}

/// Build the absolute path for a mirrored note.
/// note_id is a normalized path like "work/my-note.md" or "my-note.md"
fn mirror_path(mirror_folder: &str, note_id: &str) -> PathBuf {
    Path::new(mirror_folder).join(note_id)
}

/// Writes a single note to the .md file mirror.
/// Called by the frontend whenever PGlite reports a note change.
#[tauri::command]
async fn write_mirror_file(payload: MirrorNotePayload) -> Result<(), String> {
    // Validate each folder segment and the filename independently
    if !payload.note.folder.is_empty() && !is_safe_relative_path(&payload.note.folder) {
        return Err("Invalid folder path".to_string());
    }
    if !is_safe_component(&payload.note.filename) {
        return Err("Invalid filename".to_string());
    }

    let rel = if payload.note.folder.is_empty() {
        payload.note.filename.clone()
    } else {
        format!("{}/{}", payload.note.folder, payload.note.filename)
    };

    let path = mirror_path(&payload.mirror_folder, &rel);
    let root = Path::new(&payload.mirror_folder);
    assert_within_root(root, &path)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let final_content = inject_frontmatter(&payload.note.content, &payload.note.updated_at);
    fs::write(&path, final_content).map_err(|e| e.to_string())?;

    // Preserve the note's canonical updated_at as the file's mtime.
    // Without this, fs::write stamps mtime = now, so the next scan_import_folder
    // would see a newer mtime than PGlite's updated_at and treat the file as
    // externally modified — causing a spurious re-import and "just edited" appearance.
    if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(&payload.note.updated_at) {
        let ft = FileTime::from_unix_time(ts.timestamp(), ts.timestamp_subsec_nanos());
        let _ = filetime::set_file_mtime(&path, ft); // best-effort — ignore errors
    }

    Ok(())
}

/// Deletes a note's .md mirror file (called on soft-delete / move).
#[tauri::command]
async fn delete_mirror_file(payload: DeleteMirrorPayload) -> Result<(), String> {
    if !is_safe_relative_path(&payload.note_id) {
        return Err("Invalid note_id path".to_string());
    }
    let path = mirror_path(&payload.mirror_folder, &payload.note_id);
    let root = Path::new(&payload.mirror_folder);
    assert_within_root(root, &path)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Folder operations (still filesystem-backed for the mirror)
// ---------------------------------------------------------------------------

#[tauri::command]
async fn list_folders(folder_path: String) -> Result<Vec<String>, String> {
    let mut folders = Vec::new();
    let root = Path::new(&folder_path);
    if !root.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(root).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                if !name_str.starts_with('.') {
                    folders.push(name_str.into_owned());
                }
            }
        }
    }
    Ok(folders)
}

#[tauri::command]
async fn rename_folder(_app: tauri::AppHandle, root_path: String, old_name: String, new_name: String) -> Result<(), String> {
    // Reject traversal attempts: both names must be safe relative paths within root.
    if !is_safe_relative_path(&old_name) || !is_safe_relative_path(&new_name) {
        return Err("Invalid folder name".to_string());
    }
    let root = Path::new(&root_path);
    let old_path = root.join(&old_name);
    let new_path = root.join(&new_name);
    assert_within_root(root, &old_path)?;
    assert_within_root(root, &new_path)?;
    fs::rename(old_path, new_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn create_folder(_app: tauri::AppHandle, root_path: String, folder_path: String) -> Result<(), String> {
    // folder_path is an absolute path; verify it stays inside root_path so the
    // renderer can't create directories anywhere on disk.
    let root = Path::new(&root_path);
    let target = Path::new(&folder_path);
    assert_within_root(root, target)?;
    fs::create_dir_all(target).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_folder_recursive(_app: tauri::AppHandle, root_path: String, folder_path: String) -> Result<(), String> {
    // Refuse to remove anything outside the workspace root.
    let root = Path::new(&root_path);
    let target = Path::new(&folder_path);
    assert_within_root(root, target)?;
    // Refuse to delete the root itself.
    if target.canonicalize().ok() == root.canonicalize().ok() {
        return Err("Refusing to delete workspace root".to_string());
    }
    fs::remove_dir_all(target).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_folder_move_contents(_app: tauri::AppHandle, folder_path: String, root_path: String) -> Result<(), String> {
    let folder = Path::new(&folder_path);
    let root = Path::new(&root_path);
    assert_within_root(root, folder)?;
    if folder.canonicalize().ok() == root.canonicalize().ok() {
        return Err("Refusing to delete workspace root".to_string());
    }

    let files = get_files_recursively(folder);
    for file in files {
        if file.extension().map_or(false, |ext| ext == "md") {
            let basename = file.file_name().unwrap();
            let mut target_path = root.join(basename);
            let mut counter = 1;
            while target_path.exists() {
                let name = file.file_stem().unwrap().to_string_lossy();
                let ext = file.extension().unwrap().to_string_lossy();
                target_path = root.join(format!("{}_{}.{}", name, counter, ext));
                counter += 1;
            }
            fs::rename(file, target_path).map_err(|e| e.to_string())?;
        }
    }
    fs::remove_dir_all(folder).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SaveAssetResponse {
    pub success: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
async fn save_asset(_app: tauri::AppHandle, root_path: String, filename: String, content_base64: String) -> Result<SaveAssetResponse, String> {
    // Only allow a flat filename — no path separators or traversal
    if !is_safe_component(&filename) {
        return Err("Invalid filename".to_string());
    }

    let root = Path::new(&root_path);
    let assets_dir = root.join(".assets");
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    }
    let gitkeep_path = assets_dir.join(".gitkeep");
    if !gitkeep_path.exists() {
        let _ = fs::write(&gitkeep_path, "");
    }

    let file_path = assets_dir.join(&filename);
    assert_within_root(&assets_dir, &file_path)?;

    let b64_data = if let Some(idx) = content_base64.find("base64,") {
        &content_base64[idx + 7..]
    } else {
        &content_base64
    };
    let decoded = general_purpose::STANDARD.decode(b64_data).map_err(|e| format!("Base64 Error: {}", e))?;
    fs::write(&file_path, decoded).map_err(|e| e.to_string())?;
    Ok(SaveAssetResponse {
        success: true,
        path: Some(format!(".assets/{}", filename).replace("\\", "/")),
        error: None,
    })
}

#[tauri::command]
async fn get_local_assets_dir(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let local_assets = app_data.join("local_assets");
    if !local_assets.exists() {
        fs::create_dir_all(&local_assets).map_err(|e| e.to_string())?;
    }
    Ok(local_assets.to_string_lossy().to_string())
}

#[tauri::command]
async fn save_local_asset(app: tauri::AppHandle, filename: String, content_base64: String) -> Result<SaveAssetResponse, String> {
    if !is_safe_component(&filename) {
        return Err("Invalid filename".to_string());
    }

    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let assets_dir = app_data.join("local_assets");
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    }

    let file_path = assets_dir.join(&filename);
    assert_within_root(&assets_dir, &file_path)?;

    let b64_data = if let Some(idx) = content_base64.find("base64,") {
        &content_base64[idx + 7..]
    } else {
        &content_base64
    };
    let decoded = general_purpose::STANDARD.decode(b64_data).map_err(|e| format!("Base64 Error: {}", e))?;
    fs::write(&file_path, decoded).map_err(|e| e.to_string())?;

    Ok(SaveAssetResponse {
        success: true,
        path: Some(format!("local-asset://{}", filename)),
        error: None,
    })
}

// ---------------------------------------------------------------------------
// App info
// ---------------------------------------------------------------------------

#[tauri::command]
async fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
async fn get_document_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path().document_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// File watcher (still used for legacy file events, low priority)
// ---------------------------------------------------------------------------

struct WatcherState(Arc<Mutex<Option<notify::RecommendedWatcher>>>);

#[tauri::command]
async fn start_watch(app: tauri::AppHandle, folder_path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    #[cfg(not(mobile))]
    {
        let mut watcher_guard = state.0.lock().map_err(|e| e.to_string())?;
        if let Some(mut old_watcher) = watcher_guard.take() {
            old_watcher.unwatch(Path::new(&folder_path)).ok();
        }
        let app_handle = app.clone();
        let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            if let Ok(event) = res {
                let mut notify = false;
                for path in event.paths {
                    let path_str = path.to_string_lossy().to_lowercase();
                    if path_str.contains(".git") || path_str.contains("node_modules")
                        || path_str.contains("target") || path_str.contains("dist")
                        || path_str.contains("src-tauri") || path_str.contains("config.json")
                    {
                        continue;
                    }
                    notify = true;
                    break;
                }
                if notify {
                    app_handle.emit("file-changed", ()).ok();
                }
            }
        }).map_err(|e| e.to_string())?;
        watcher.watch(Path::new(&folder_path), RecursiveMode::Recursive).map_err(|e| e.to_string())?;
        *watcher_guard = Some(watcher);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Supabase Auth commands
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseAuthResult {
    pub user_id: String,
    pub email: String,
}

/// Full stored credentials (access + refresh token).
/// Returned to the frontend so it can initialise supabase-js + Electric.
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseCredentialsResult {
    pub user_id: String,
    pub email: String,
    pub access_token: String,
    pub refresh_token: String,
}

#[tauri::command]
async fn supabase_sign_in(app: tauri::AppHandle, email: String, password: String) -> Result<SupabaseAuthResult, String> {
    let creds = supabase_sync::sign_in(&email, &password).await?;
    let stored = store::SupabaseStoredCredentials {
        access_token: creds.access_token.clone(),
        refresh_token: creds.refresh_token.clone(),
        user_id: creds.user_id.clone(),
        email: creds.email.clone(),
    };
    store::save_supabase_credentials(&app, &stored);
    info!("[lib.rs] supabase sign in: {}", creds.email);
    Ok(SupabaseAuthResult { user_id: creds.user_id, email: creds.email })
}

#[tauri::command]
async fn supabase_sign_up(app: tauri::AppHandle, email: String, password: String) -> Result<SupabaseAuthResult, String> {
    let creds = supabase_sync::sign_up(&email, &password).await?;
    let stored = store::SupabaseStoredCredentials {
        access_token: creds.access_token.clone(),
        refresh_token: creds.refresh_token.clone(),
        user_id: creds.user_id.clone(),
        email: creds.email.clone(),
    };
    store::save_supabase_credentials(&app, &stored);
    info!("[lib.rs] supabase sign up: {}", creds.email);
    Ok(SupabaseAuthResult { user_id: creds.user_id, email: creds.email })
}

#[tauri::command]
async fn supabase_sign_out(app: tauri::AppHandle) {
    store::clear_supabase_credentials(&app);
    info!("[lib.rs] supabase signed out");
}

#[tauri::command]
async fn get_supabase_user(app: tauri::AppHandle) -> Option<SupabaseAuthResult> {
    store::get_supabase_credentials(&app).map(|c| SupabaseAuthResult {
        user_id: c.user_id,
        email: c.email,
    })
}

/// Returns the full stored credentials including tokens.
/// The frontend uses these to initialise supabase-js and Electric auth.
#[tauri::command]
async fn get_supabase_credentials(app: tauri::AppHandle) -> Option<SupabaseCredentialsResult> {
    store::get_supabase_credentials(&app).map(|c| SupabaseCredentialsResult {
        user_id: c.user_id,
        email: c.email,
        access_token: c.access_token,
        refresh_token: c.refresh_token,
    })
}

/// Refreshes the Supabase access token and stores the new tokens.
/// Called by the frontend when Electric returns a 401.
#[tauri::command]
async fn refresh_supabase_token(app: tauri::AppHandle) -> Result<SupabaseCredentialsResult, String> {
    let stored = store::get_supabase_credentials(&app)
        .ok_or_else(|| "Not signed in".to_string())?;

    let new_creds = supabase_sync::refresh_session(&stored.refresh_token).await?;
    let new_stored = store::SupabaseStoredCredentials {
        access_token: new_creds.access_token.clone(),
        refresh_token: new_creds.refresh_token.clone(),
        user_id: new_creds.user_id.clone(),
        email: new_creds.email.clone(),
    };
    store::save_supabase_credentials(&app, &new_stored);

    Ok(SupabaseCredentialsResult {
        user_id: new_creds.user_id,
        email: new_creds.email,
        access_token: new_creds.access_token,
        refresh_token: new_creds.refresh_token,
    })
}

// ---------------------------------------------------------------------------
// GitHub (desktop only — kept for legacy users)
// ---------------------------------------------------------------------------

#[tauri::command]
async fn clear_github_credentials(app: tauri::AppHandle) {
    store::clear_github_credentials(&app);
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
async fn connect_github(token: String, folder_path: String) -> Result<String, String> {
    let username = github::verify_token(&token).await?;
    let repo_url = github::ensure_remote_repo(&token, &username).await?;
    let root = Path::new(&folder_path);
    git::ensure_repo(root).map_err(|e| format!("Git init failed: {}", e))?;
    let auth_url = repo_url.replace("https://", &format!("https://{}:{}@", username, token));
    git::add_remote(root, &auth_url).map_err(|e| format!("Remote add failed: {}", e))?;
    Ok(username)
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
async fn start_github_oauth() -> Result<serde_json::Value, String> {
    let flow = github::start_device_flow().await?;
    let url = flow.verification_uri.clone();
    #[cfg(not(mobile))]
    {
        std::thread::spawn(move || {
            #[cfg(target_os = "windows")]
            let _ = std::process::Command::new("cmd").args(&["/C", "start", &url]).spawn();
            #[cfg(target_os = "macos")]
            let _ = std::process::Command::new("open").arg(&url).spawn();
            #[cfg(target_os = "linux")]
            let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
        });
    }
    Ok(serde_json::json!({
        "deviceCode": flow.device_code,
        "userCode": flow.user_code,
        "verificationUri": flow.verification_uri,
        "interval": flow.interval,
        "expiresIn": flow.expires_in,
    }))
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
async fn complete_github_oauth(app: tauri::AppHandle, device_code: String, interval: u64, folder_path: String) -> Result<String, String> {
    let token = github::poll_device_flow(&device_code, interval).await?;
    let username = github::verify_token(&token).await?;
    store::save_github_credentials(&app, &token, &username);
    let repo_url = github::ensure_remote_repo(&token, &username).await?;
    let root = Path::new(&folder_path);
    git::ensure_repo(root).map_err(|e| format!("Git init failed: {}", e))?;
    let auth_url = repo_url.replace("https://", &format!("https://{}:{}@", username, token));
    git::add_remote(root, &auth_url).map_err(|e| format!("Remote add failed: {}", e))?;
    Ok(username)
}

// ---------------------------------------------------------------------------
// PDF export (desktop only)
// ---------------------------------------------------------------------------

#[cfg(not(any(target_os = "ios", target_os = "android")))]
/// A scanned note returned by scan_import_folder.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScannedNote {
    /// Normalized relative path from the import root, e.g. "work/meeting.md"
    pub rel_path: String,
    pub content: String,
    pub updated_at: String,
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
/// Scans a folder recursively and returns all .md files with their content.
/// rel_path is relative to root, e.g. "subfolder/note.md" or "note.md".
fn scan_md_files(dir: &Path, root: &Path) -> Vec<ScannedNote> {
    let mut results = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else { return results };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy();
        if name.starts_with('.') { continue; }
        if path.is_dir() {
            // Recurse into subdirectory
            results.extend(scan_md_files(&path, root));
        } else if path.is_file() && path.extension().map_or(false, |e| e == "md") {
            let content = fs::read_to_string(&path).unwrap_or_default();
            let rel = path.strip_prefix(root).unwrap_or(&path);
            let rel_path = rel.to_string_lossy().replace('\\', "/");
            let updated_at = path.metadata()
                .and_then(|m| m.modified())
                .map(|t| {
                    let secs = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
                    chrono::DateTime::from_timestamp(secs as i64, 0)
                        .unwrap_or_else(|| Utc::now())
                        .to_rfc3339()
                })
                .unwrap_or_else(|_| Utc::now().to_rfc3339());
            results.push(ScannedNote { rel_path, content, updated_at });
        }
    }
    results
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
async fn scan_import_folder(folder_path: String) -> Result<Vec<ScannedNote>, String> {
    let root = Path::new(&folder_path);
    if !root.exists() {
        return Err(format!("Folder not found: {}", folder_path));
    }
    Ok(scan_md_files(root, root))
}

#[tauri::command]
async fn export_pdf(_app: tauri::AppHandle, html: String) -> Result<bool, String> {
    info!("[lib.rs] export_pdf called, html length: {}", html.len());
    Ok(true)
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "ios")]
    let _ = rustls::crypto::ring::default_provider().install_default();

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                let _ = app.get_webview_window("main").expect("no main window").set_focus();
            }))
            .plugin(tauri_plugin_positioner::init())
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Debug)
            .target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::Stdout,
            ))
            .target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::Webview,
            ))
            .build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // File mirror
            write_mirror_file,
            delete_mirror_file,
            // Folder ops (mirror)
            list_folders,
            rename_folder,
            create_folder,
            delete_folder_recursive,
            delete_folder_move_contents,
            // Assets
            save_asset,
            save_local_asset,
            get_local_assets_dir,
            // App info
            get_app_version,
            get_document_dir,
            // File watcher
            start_watch,
            // Auth
            supabase_sign_in,
            supabase_sign_up,
            supabase_sign_out,
            get_supabase_user,
            get_supabase_credentials,
            refresh_supabase_token,
            // GitHub (desktop legacy)
            clear_github_credentials,
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            connect_github,
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            start_github_oauth,
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            complete_github_oauth,
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            export_pdf,
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            scan_import_folder,
        ])
        .manage(WatcherState(Arc::new(Mutex::new(None))))
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::LogicalSize;
                use tauri_plugin_store::StoreExt;

                if let Some(window) = app.get_webview_window("main") {
                    // Always enforce minimum size
                    let _ = window.set_min_size(Some(LogicalSize::new(800u32, 600u32)));

                    // On the very first launch (no saved window size in store),
                    // set the desired default size. On subsequent launches the OS
                    // restores the user's last size — we leave that alone.
                    let store = app.store("window.json").ok();
                    let first_launch = store.as_ref()
                        .map(|s| s.get("sized").is_none())
                        .unwrap_or(true);

                    if first_launch {
                        let _ = window.set_size(LogicalSize::new(1270u32, 900u32));
                        if let Some(s) = store {
                            let _ = s.set("sized", serde_json::json!(true));
                            let _ = s.save();
                        }
                    }
                }
            }
            #[cfg(desktop)]
            {
                use tauri::tray::TrayIconBuilder;
                use tauri::menu::{Menu, MenuItem};

                let show_main = MenuItem::with_id(app, "show_main", "Hauptfenster zeigen", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_main, &quit])?;

                let _tray = TrayIconBuilder::with_id("main-tray")
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        match event.id.as_ref() {
                            "show_main" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
            } // end tray #[cfg(desktop)]
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
