use serde::{Deserialize, Serialize};
use log::info;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use std::sync::{Arc, Mutex};
use notify::{Watcher, RecursiveMode};
use tauri::{Emitter, Manager};
use base64::{engine::general_purpose, Engine as _};

#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod git;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod github;
mod store;
mod supabase_sync;

// use tauri_plugin_positioner::{WindowExt, Position};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncResultPayload {
    pub had_changes: bool,
    pub had_conflicts: bool,
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    pub conflict_pairs: Vec<git::ConflictPair>,
    #[cfg(any(target_os = "ios", target_os = "android"))]
    pub conflict_pairs: Vec<String>,
    pub push_succeeded: bool,
}

#[derive(Serialize, Deserialize, Debug)]
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

fn get_files_recursively(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with('.') || name_str == "node_modules" || name_str == "target" || name_str == "dist" || name_str == "src-tauri" {
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

#[tauri::command]
async fn list_notes(folder_path: String) -> Result<Vec<Note>, String> {
    let root = Path::new(&folder_path);
    if !root.exists() {
        return Ok(Vec::new());
    }
    let files = get_files_recursively(root);
    
    let mut notes = Vec::new();
    for file in files {
        if file.extension().map_or(false, |ext| ext == "md") {
            let raw_content = fs::read_to_string(&file).unwrap_or_default();
            
            // Parse frontmatter for `updated` timestamp
            let (content, updated_at) = parse_frontmatter(&raw_content, &file);

            let relative_path = file.strip_prefix(root).map_err(|e| e.to_string())?;
            let folder = relative_path.parent()
                .map(|p| p.to_string_lossy().replace("\\", "/"))
                .unwrap_or_default();

            notes.push(Note {
                filename: file.file_name().unwrap().to_string_lossy().into_owned(),
                folder,
                content,
                updated_at,
            });
        }
    }
    Ok(notes)
}

/// Parses YAML frontmatter from a markdown file to extract the `updated` timestamp.
/// Returns (content_without_frontmatter, updated_at_rfc3339).
/// Falls back to filesystem modified time if no frontmatter is present.
fn parse_frontmatter(raw: &str, file_path: &Path) -> (String, String) {
    if raw.starts_with("---\n") || raw.starts_with("---\r\n") {
        let after_open = if raw.starts_with("---\r\n") { 5 } else { 4 };
        // Find the closing --- that must be preceded by a newline
        if let Some(close_index_rel) = raw[after_open..].find("\n---") {
            let close_index = after_open + close_index_rel;
            let frontmatter = &raw[after_open..close_index];
            
            // The content starts after "\n---" (4 chars) followed by optional newline
            let content_start = close_index + 4;
            
            // Extract content safely
            let content = if content_start < raw.len() {
                let remainder = &raw[content_start..];
                if remainder.starts_with('\n') {
                    &remainder[1..]
                } else if remainder.starts_with("\r\n") {
                    &remainder[2..]
                } else {
                    remainder
                }
            } else {
                ""
            };

            let mut updated_at: Option<String> = None;
            for line in frontmatter.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("updated:") {
                    let value = trimmed.trim_start_matches("updated:").trim().trim_matches('"').trim_matches('\'');
                    if let Ok(dt) = DateTime::parse_from_rfc3339(value) {
                        updated_at = Some(dt.with_timezone(&Utc).to_rfc3339());
                    } else {
                        updated_at = Some(value.to_string());
                    }
                }
            }
            
            return (content.to_string(), updated_at.unwrap_or_else(|| get_fs_timestamp(file_path)));
        }
    }
    (raw.to_string(), get_fs_timestamp(file_path))
}

/// Gets the filesystem modification time as RFC 3339.
fn get_fs_timestamp(file_path: &Path) -> String {
    fs::metadata(file_path)
        .and_then(|m| m.modified())
        .map(|m| {
            let dt: DateTime<Utc> = m.into();
            dt.to_rfc3339()
        })
        .unwrap_or_else(|_| Utc::now().to_rfc3339())
}

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
async fn save_note(_app: tauri::AppHandle, root_path: String, folder_path: String, filename: String, content: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    let target_dir = Path::new(&folder_path);
    let file_path = target_dir.join(&filename);
    
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    // Inject/update frontmatter with current UTC timestamp.
    // UTC ensures timestamps sort correctly across devices with different timezones.
    let now = chrono::Utc::now().to_rfc3339();
    let final_content = inject_frontmatter(&content, &now);
    
    fs::write(&file_path, final_content).map_err(|e| e.to_string())?;
    Ok(())
}

/// Injects or updates the `updated` field in YAML frontmatter.
fn inject_frontmatter(content: &str, timestamp: &str) -> String {
    if content.starts_with("---\n") || content.starts_with("---\r\n") {
        let after_open = if content.starts_with("---\r\n") { 5 } else { 4 };
        if let Some(close_pos) = content[after_open..].find("\n---") {
            let frontmatter = &content[after_open..after_open + close_pos];
            let rest = &content[after_open + close_pos + 4..]; // after "\n---"
            
            // Replace existing `updated:` line or add it
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
    // No existing frontmatter — add one
    format!("---\nupdated: {}\n---\n{}", timestamp, content)
}

#[tauri::command]
async fn delete_note(_app: tauri::AppHandle, root_path: String, folder_path: String, filename: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    let target_dir = Path::new(&folder_path);
    let path = target_dir.join(&filename);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn rename_note(_app: tauri::AppHandle, root_path: String, old_filename: String, new_filename: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    let old_path = root.join(&old_filename);
    let new_path = root.join(&new_filename);
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    // After rename, stamp a fresh `updated:` timestamp into the frontmatter.
    // fs::rename preserves the old mtime, so without this the moved/renamed file
    // keeps its old timestamp. If Supabase has a stale (but newer-timestamped)
    // entry for the new path, sync would overwrite the local file with remote
    // content. A fresh timestamp ensures local always wins after a move/rename.
    if let Ok(content) = fs::read_to_string(&new_path) {
        let now = chrono::Utc::now().to_rfc3339();
        let updated = inject_frontmatter(&content, &now);
        let _ = fs::write(&new_path, updated);
    }

    Ok(())
}

#[tauri::command]
async fn read_metadata(root_path: String) -> Result<AppMetadata, String> {
    let config_path = Path::new(&root_path).join("notizapp-config.json");
    let legacy_path = Path::new(&root_path).join(".notizapp-metadata.json");

    let mut needs_migration = !config_path.exists() && legacy_path.exists();

    if config_path.exists() && legacy_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(metadata) = serde_json::from_str::<serde_json::Value>(&content) {
                let folders = metadata.get("folders");
                let folders_empty = folders.map_or(true, |f| f.is_object() && f.as_object().unwrap().is_empty());
                if folders_empty {
                    needs_migration = true;
                }
            }
        }
    }

    if needs_migration {
        if let Ok(content) = fs::read_to_string(&legacy_path) {
            let _ = fs::write(&config_path, content);
        }
    }

    if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        let metadata = serde_json::from_str::<AppMetadata>(&content).unwrap_or_else(|_| AppMetadata { 
            folders: serde_json::json!({}), 
            pinned_notes: Vec::new(),
            folder_order: None,
            settings: None,
        });
        Ok(metadata)
    } else {
        Ok(AppMetadata { 
            folders: serde_json::json!({}), 
            pinned_notes: Vec::new(),
            folder_order: None,
            settings: None,
        })
    }
}

#[tauri::command]
async fn save_metadata(root_path: String, metadata: AppMetadata) -> Result<(), String> {
    let config_path = Path::new(&root_path).join("notizapp-config.json");
    let content = serde_json::to_string_pretty(&metadata).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn rename_folder(_app: tauri::AppHandle, root_path: String, old_name: String, new_name: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    let old_path = root.join(&old_name);
    let new_path = root.join(&new_name);
    fs::rename(old_path, new_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn create_folder(_app: tauri::AppHandle, root_path: String, folder_path: String) -> Result<(), String> {
    let _root = Path::new(&root_path);
    fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_folder_recursive(_app: tauri::AppHandle, _root_path: String, folder_path: String) -> Result<(), String> {
    fs::remove_dir_all(&folder_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_folder_move_contents(_app: tauri::AppHandle, folder_path: String, root_path: String) -> Result<(), String> {
    let folder = Path::new(&folder_path);
    let root = Path::new(&root_path);
    
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
                    if path_str.contains(".git") || path_str.contains("node_modules") || path_str.contains("target") || 
                       path_str.contains("dist") || path_str.contains("src-tauri") || path_str.contains("config.json") {
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

/// Scans the directory for files containing " (Konflikt " and returns them as ConflictPairs.
#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn detect_ongoing_conflicts(root: &Path) -> Vec<git::ConflictPair> {
    let mut pairs = Vec::new();
    let files = get_files_recursively(root);
    for file in files {
        let filename = file.file_name().unwrap_or_default().to_string_lossy();
        if filename.contains(" (Konflikt ") {
            info!("[lib.rs] Detected ongoing conflict file: {}", filename);
            // Reconstruct the potential original filename: "Note (Konflikt 2024-01-01).md" -> "Note.md"
            if let Some(pos) = filename.find(" (Konflikt ") {
                let stem = &filename[..pos];
                let ext = file.extension().and_then(|e| e.to_str()).unwrap_or("md");
                let original_filename = format!("{}.{}", stem, ext);
                
                let relative_conflict = file.strip_prefix(root).ok()
                    .map(|p| p.to_string_lossy().replace("\\", "/"))
                    .unwrap_or_default();
                    
                let relative_original = file.parent().and_then(|p| p.strip_prefix(root).ok())
                    .map(|p| p.join(&original_filename).to_string_lossy().replace("\\", "/"))
                    .unwrap_or_else(|| original_filename.clone());

                pairs.push(git::ConflictPair {
                    original: relative_original,
                    conflict_copy: relative_conflict,
                });
            }
        }
    }
    pairs
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn spawn_sync(app: tauri::AppHandle, folder_path: String) {
    tauri::async_runtime::spawn(async move {
        if let Some(creds) = store::get_github_credentials(&app) {
            let root = PathBuf::from(&folder_path);
            let _ = git::push_changes(&root, &creds.token, &creds.username);
        }
    });
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SaveAssetResponse {
    pub success: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
async fn save_asset(app: tauri::AppHandle, root_path: String, filename: String, content_base64: String) -> Result<SaveAssetResponse, String> {
    let root = Path::new(&root_path);
    let assets_dir = root.join(".assets");
    
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    }
    
    // Create .gitkeep to ensure Git tracks the folder
    let gitkeep_path = assets_dir.join(".gitkeep");
    if !gitkeep_path.exists() {
        let _ = fs::write(&gitkeep_path, "");
    }
    
    // Decode base64 
    // Handle potential data URI prefix e.g., "data:image/png;base64,iVBORw0K..."
    let b64_data = if let Some(idx) = content_base64.find("base64,") {
        &content_base64[idx + 7..]
    } else {
        &content_base64
    };
    
    let decoded = general_purpose::STANDARD.decode(b64_data).map_err(|e| format!("Base64 Error: {}", e))?;
    let file_path = assets_dir.join(&filename);
    
    fs::write(&file_path, decoded).map_err(|e| e.to_string())?;
    Ok(SaveAssetResponse {
        success: true,
        path: Some(format!(".assets/{}", filename).replace("\\", "/")),
        error: None,
    })
}

// ---------------------------------------------------------------------------
// Supabase Auth + Sync commands
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseAuthResult {
    pub user_id: String,
    pub email: String,
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

/// Attempts to refresh the access token. Updates stored credentials on success.
async fn refresh_supabase_token(app: &tauri::AppHandle, refresh_token: &str) -> Option<store::SupabaseStoredCredentials> {
    match supabase_sync::refresh_session(refresh_token).await {
        Ok(new_creds) => {
            let stored = store::SupabaseStoredCredentials {
                access_token: new_creds.access_token,
                refresh_token: new_creds.refresh_token,
                user_id: new_creds.user_id,
                email: new_creds.email,
            };
            store::save_supabase_credentials(app, &stored);
            Some(stored)
        }
        Err(e) => {
            info!("[lib.rs] token refresh failed: {}", e);
            None
        }
    }
}

/// Deletes the local sync-state checkpoint, forcing the next sync to push ALL
/// local notes and pull ALL remote notes. Used when the sync state is stale.
#[tauri::command]
async fn reset_sync_state(folder_path: String) -> Result<(), String> {
    let path = Path::new(&folder_path).join("notizapp-sync-state.json");
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Could not reset sync state: {}", e))?;
        info!("[lib.rs] sync state reset: {:?}", path);
    }
    Ok(())
}

/// New sync_now using Supabase. Falls back gracefully if not connected.
#[tauri::command]
async fn sync_now(app: tauri::AppHandle, folder_path: String) -> Result<SyncResultPayload, String> {
    let root = Path::new(&folder_path);

    if !root.exists() {
        fs::create_dir_all(root).map_err(|e| format!("Could not create folder '{}': {}", root.display(), e))?;
    }

    // Check for Supabase credentials
    let mut stored_creds = match store::get_supabase_credentials(&app) {
        Some(c) => c,
        None => {
            // Not connected to Supabase yet — check for ongoing conflicts on disk only
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            let disk_conflicts = detect_ongoing_conflicts(root);
            #[cfg(any(target_os = "ios", target_os = "android"))]
            let disk_conflicts: Vec<String> = Vec::new();
            let had_conflicts = !disk_conflicts.is_empty();
            let payload = SyncResultPayload {
                had_changes: false,
                had_conflicts,
                conflict_pairs: disk_conflicts,
                push_succeeded: false,
            };
            app.emit("sync-complete", &payload).ok();
            return Ok(payload);
        }
    };

    // Try to refresh token if needed (Supabase tokens expire after 1 hour)
    // We attempt sync first; if we get an auth error, refresh and retry once.
    let supabase_creds = supabase_sync::SupabaseCredentials {
        access_token: stored_creds.access_token.clone(),
        refresh_token: stored_creds.refresh_token.clone(),
        user_id: stored_creds.user_id.clone(),
        email: stored_creds.email.clone(),
    };

    let result = match supabase_sync::sync(&supabase_creds, root).await {
        Ok(r) => r,
        Err(e) if e.contains("401") || e.contains("403") || e.contains("JWT") => {
            info!("[lib.rs] auth error, attempting token refresh: {}", e);
            // Try refreshing token
            if let Some(refreshed) = refresh_supabase_token(&app, &stored_creds.refresh_token).await {
                stored_creds = refreshed;
                let new_creds = supabase_sync::SupabaseCredentials {
                    access_token: stored_creds.access_token.clone(),
                    refresh_token: stored_creds.refresh_token.clone(),
                    user_id: stored_creds.user_id.clone(),
                    email: stored_creds.email.clone(),
                };
                supabase_sync::sync(&new_creds, root).await
                    .map_err(|e2| format!("Sync after refresh failed: {}", e2))?
            } else {
                return Err("Sitzung abgelaufen. Bitte erneut anmelden.".to_string());
            }
        }
        Err(e) => return Err(format!("Sync fehlgeschlagen: {}", e)),
    };

    // Convert conflict count to ConflictPairs for the existing UI
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    let disk_conflicts = detect_ongoing_conflicts(root);
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let disk_conflicts: Vec<String> = Vec::new();
    let had_conflicts = !disk_conflicts.is_empty();

    let payload = SyncResultPayload {
        had_changes: result.had_changes,
        had_conflicts,
        conflict_pairs: disk_conflicts,
        push_succeeded: result.pushed_count > 0,
    };
    app.emit("sync-complete", &payload).ok();
    Ok(payload)
}

/*
#[tauri::command]
async fn hide_quick_note(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("quick-note") {
        let _ = window.hide();
        #[cfg(target_os = "macos")]
        {
            // Release focus back to the previous application by hiding the app process
            let _ = app.hide();
        }
    }
}

#[tauri::command]
async fn open_quick_note_devtools(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("quick-note") {
        window.open_devtools();
    }
}
*/

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
            .level(log::LevelFilter::Info)
            .build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            list_notes, list_folders, save_note, delete_note, rename_note,
            read_metadata, save_metadata, rename_folder, create_folder,
            delete_folder_recursive, delete_folder_move_contents,
            get_app_version, get_document_dir, sync_now, start_watch,
            clear_github_credentials, save_asset,
            supabase_sign_in, supabase_sign_up, supabase_sign_out, get_supabase_user,
            reset_sync_state,
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            connect_github,
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            start_github_oauth,
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            complete_github_oauth,
        ])
        .manage(WatcherState(Arc::new(Mutex::new(None))))
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::tray::TrayIconBuilder; // TrayIconEvent, MouseButtonState
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
                            "quit" => {
                                app.exit(0);
                            }
                            "show_main" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|_tray, event| {
                        tauri_plugin_positioner::on_tray_event(_tray.app_handle(), &event);
                    })
                    .build(app)?;
            }

            let window = app.get_webview_window("main").unwrap();
            
            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;
                let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
            }

            #[cfg(all(desktop, not(target_os = "macos")))]
            {
                let _ = window.set_decorations(false);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ===========================================================================
// TESTS
// ===========================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // -----------------------------------------------------------------------
    // parse_frontmatter
    // -----------------------------------------------------------------------

    #[test]
    fn parse_frontmatter_extracts_updated_timestamp() {
        let raw = "---\nupdated: 2026-01-15T12:30:00+00:00\n---\n# Hello World";
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("note.md");
        fs::write(&file, raw).unwrap();

        let (content, updated_at) = parse_frontmatter(raw, &file);
        assert_eq!(content, "# Hello World");
        assert!(updated_at.contains("2026-01-15"), "updated_at should contain the date: {}", updated_at);
    }

    #[test]
    fn parse_frontmatter_strips_frontmatter_from_content() {
        let raw = "---\nupdated: 2026-01-01T00:00:00Z\ntitle: Test\n---\n# Content here";
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("note.md");
        fs::write(&file, raw).unwrap();

        let (content, _) = parse_frontmatter(raw, &file);
        assert_eq!(content, "# Content here");
        assert!(!content.contains("---"));
    }

    #[test]
    fn parse_frontmatter_no_frontmatter_returns_full_content() {
        let raw = "# Just a heading\nSome text";
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("note.md");
        fs::write(&file, raw).unwrap();

        let (content, updated_at) = parse_frontmatter(raw, &file);
        assert_eq!(content, raw);
        // Falls back to filesystem mtime — should be a valid timestamp
        assert!(updated_at.contains("20"), "should be a date string: {}", updated_at);
    }

    #[test]
    fn parse_frontmatter_empty_frontmatter() {
        // Empty frontmatter (nothing between --- delimiters) — parser can't find
        // content between markers, so it returns raw content and falls back to mtime.
        let raw = "---\n---\n# Empty frontmatter";
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("note.md");
        fs::write(&file, raw).unwrap();

        let (content, updated_at) = parse_frontmatter(raw, &file);
        // With zero bytes between "---\n" and "\n---" the parser treats it as no
        // valid frontmatter. Content stays as-is, timestamp falls back to mtime.
        assert_eq!(content, raw);
        assert!(chrono::DateTime::parse_from_rfc3339(&updated_at).is_ok());
    }

    #[test]
    fn parse_frontmatter_crlf_line_endings() {
        let raw = "---\r\nupdated: 2026-06-01T10:00:00Z\r\n---\r\n# Windows style";
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("note.md");
        fs::write(&file, raw).unwrap();

        let (content, updated_at) = parse_frontmatter(raw, &file);
        assert!(content.contains("Windows style"));
        assert!(updated_at.contains("2026-06-01"));
    }

    #[test]
    fn parse_frontmatter_multiple_fields() {
        let raw = "---\ntitle: My Note\nupdated: 2026-03-15T08:00:00Z\ntags: work\n---\n# Content";
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("note.md");
        fs::write(&file, raw).unwrap();

        let (content, updated_at) = parse_frontmatter(raw, &file);
        assert_eq!(content, "# Content");
        assert!(updated_at.contains("2026-03-15"));
    }

    #[test]
    fn parse_frontmatter_quoted_timestamp() {
        let raw = "---\nupdated: \"2026-03-15T08:00:00Z\"\n---\n# Quoted";
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("note.md");
        fs::write(&file, raw).unwrap();

        let (_, updated_at) = parse_frontmatter(raw, &file);
        assert!(updated_at.contains("2026-03-15"));
    }

    // -----------------------------------------------------------------------
    // inject_frontmatter
    // -----------------------------------------------------------------------

    #[test]
    fn inject_frontmatter_creates_new_frontmatter() {
        let content = "# New Note";
        let ts = "2026-04-01T12:00:00Z";
        let result = inject_frontmatter(content, ts);

        assert!(result.starts_with("---\n"));
        assert!(result.contains("updated: 2026-04-01T12:00:00Z"));
        assert!(result.contains("# New Note"));
    }

    #[test]
    fn inject_frontmatter_updates_existing_timestamp() {
        let content = "---\nupdated: 2025-01-01T00:00:00Z\n---\n# Old note";
        let ts = "2026-04-01T12:00:00Z";
        let result = inject_frontmatter(content, ts);

        assert!(result.contains("updated: 2026-04-01T12:00:00Z"));
        assert!(!result.contains("2025-01-01"));
        assert!(result.contains("# Old note"));
    }

    #[test]
    fn inject_frontmatter_preserves_other_fields() {
        let content = "---\ntitle: My Note\nupdated: 2025-01-01T00:00:00Z\ntags: work\n---\n# Content";
        let ts = "2026-04-01T12:00:00Z";
        let result = inject_frontmatter(content, ts);

        assert!(result.contains("title: My Note"));
        assert!(result.contains("tags: work"));
        assert!(result.contains("updated: 2026-04-01T12:00:00Z"));
        assert!(!result.contains("2025-01-01"));
    }

    #[test]
    fn inject_frontmatter_adds_updated_if_missing_from_existing_frontmatter() {
        let content = "---\ntitle: My Note\n---\n# Content";
        let ts = "2026-04-01T12:00:00Z";
        let result = inject_frontmatter(content, ts);

        assert!(result.contains("title: My Note"));
        assert!(result.contains("updated: 2026-04-01T12:00:00Z"));
    }

    #[test]
    fn inject_frontmatter_roundtrip_with_parse() {
        let original = "# Hello World";
        let ts = "2026-04-01T12:00:00+00:00";

        let injected = inject_frontmatter(original, ts);
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("note.md");
        fs::write(&file, &injected).unwrap();

        let (content, updated_at) = parse_frontmatter(&injected, &file);
        assert_eq!(content, "# Hello World");
        assert!(updated_at.contains("2026-04-01"), "roundtrip updated_at: {}", updated_at);
    }

    // -----------------------------------------------------------------------
    // get_files_recursively
    // -----------------------------------------------------------------------

    #[test]
    fn get_files_recursively_finds_md_files() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("note.md"), "# test").unwrap();
        fs::write(tmp.path().join("readme.txt"), "text").unwrap();

        let files = get_files_recursively(tmp.path());
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn get_files_recursively_traverses_subdirectories() {
        let tmp = TempDir::new().unwrap();
        let sub = tmp.path().join("subfolder");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("nested.md"), "# nested").unwrap();
        fs::write(tmp.path().join("root.md"), "# root").unwrap();

        let files = get_files_recursively(tmp.path());
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn get_files_recursively_skips_hidden_directories() {
        let tmp = TempDir::new().unwrap();
        let hidden = tmp.path().join(".hidden");
        fs::create_dir(&hidden).unwrap();
        fs::write(hidden.join("secret.md"), "# secret").unwrap();
        fs::write(tmp.path().join("visible.md"), "# visible").unwrap();

        let files = get_files_recursively(tmp.path());
        assert_eq!(files.len(), 1);
        assert!(files[0].to_string_lossy().contains("visible"));
    }

    #[test]
    fn get_files_recursively_skips_node_modules_and_target() {
        let tmp = TempDir::new().unwrap();
        for dir in &["node_modules", "target", "dist", "src-tauri"] {
            let p = tmp.path().join(dir);
            fs::create_dir(&p).unwrap();
            fs::write(p.join("file.md"), "# skip").unwrap();
        }
        fs::write(tmp.path().join("keep.md"), "# keep").unwrap();

        let files = get_files_recursively(tmp.path());
        assert_eq!(files.len(), 1);
    }

    #[test]
    fn get_files_recursively_empty_directory() {
        let tmp = TempDir::new().unwrap();
        let files = get_files_recursively(tmp.path());
        assert!(files.is_empty());
    }

    // -----------------------------------------------------------------------
    // delete_folder_move_contents (collision handling)
    // -----------------------------------------------------------------------

    #[test]
    fn delete_folder_move_contents_avoids_overwrite() {
        let tmp = TempDir::new().unwrap();
        let sub = tmp.path().join("subfolder");
        fs::create_dir(&sub).unwrap();

        // Same filename in root and subfolder
        fs::write(tmp.path().join("note.md"), "# root version").unwrap();
        fs::write(sub.join("note.md"), "# sub version").unwrap();

        // Simulate the collision logic from delete_folder_move_contents
        let files = get_files_recursively(&sub);
        for file in files {
            if file.extension().map_or(false, |ext| ext == "md") {
                let basename = file.file_name().unwrap();
                let mut target_path = tmp.path().join(basename);
                let mut counter = 1;
                while target_path.exists() {
                    let name = file.file_stem().unwrap().to_string_lossy();
                    let ext = file.extension().unwrap().to_string_lossy();
                    target_path = tmp.path().join(format!("{}_{}.{}", name, counter, ext));
                    counter += 1;
                }
                fs::rename(&file, &target_path).unwrap();
            }
        }

        // Both files should exist
        assert!(tmp.path().join("note.md").exists());
        assert!(tmp.path().join("note_1.md").exists());
        assert_eq!(fs::read_to_string(tmp.path().join("note.md")).unwrap(), "# root version");
        assert_eq!(fs::read_to_string(tmp.path().join("note_1.md")).unwrap(), "# sub version");
    }

    // -----------------------------------------------------------------------
    // Metadata migration
    // -----------------------------------------------------------------------

    #[test]
    fn read_metadata_migrates_legacy_file() {
        let tmp = TempDir::new().unwrap();
        let legacy_path = tmp.path().join(".notizapp-metadata.json");
        let config_path = tmp.path().join("notizapp-config.json");

        let meta = r#"{"folders":{"Work":{"icon":"briefcase","color":"blue"}},"pinnedNotes":["test.md"]}"#;
        fs::write(&legacy_path, meta).unwrap();

        // Simulate migration check
        let needs_migration = !config_path.exists() && legacy_path.exists();
        assert!(needs_migration);

        // Perform migration
        if needs_migration {
            let content = fs::read_to_string(&legacy_path).unwrap();
            fs::write(&config_path, &content).unwrap();
        }

        assert!(config_path.exists());
        let migrated: serde_json::Value = serde_json::from_str(&fs::read_to_string(&config_path).unwrap()).unwrap();
        assert!(migrated.get("folders").unwrap().get("Work").is_some());
    }
}
