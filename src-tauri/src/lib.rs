use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use std::sync::{Arc, Mutex};
use notify::{Watcher, RecursiveMode};
use tauri::{Emitter, Manager};
use base64::{engine::general_purpose, Engine as _};

mod git;
mod github;
mod store;

// use tauri_plugin_positioner::{WindowExt, Position};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncResultPayload {
    pub had_changes: bool,
    pub had_conflicts: bool,
    pub conflict_pairs: Vec<git::ConflictPair>,
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
async fn save_note(app: tauri::AppHandle, root_path: String, folder_path: String, filename: String, content: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    let target_dir = Path::new(&folder_path);
    let file_path = target_dir.join(&filename);
    
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    // Inject/update frontmatter with current timestamp (ISO 8601 with timezone)
    let now = chrono::Local::now().to_rfc3339();
    let final_content = inject_frontmatter(&content, &now);
    
    fs::write(&file_path, final_content).map_err(|e| e.to_string())?;
    
    if let Ok(_) = git::ensure_repo(root) {
        let msg = format!("Update: {}", filename);
        if let Ok(_) = git::commit_changes(root, &msg) {
            spawn_sync(app, root_path);
        }
    }
    
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
async fn delete_note(app: tauri::AppHandle, root_path: String, folder_path: String, filename: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    let target_dir = Path::new(&folder_path);
    let path = target_dir.join(&filename);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }

    if let Ok(_) = git::ensure_repo(root) {
        let msg = format!("Delete: {}", filename);
        if let Ok(_) = git::commit_changes(root, &msg) {
            println!("[lib.rs] Commited deletion: {}", filename);
            if let Some(creds) = store::get_github_credentials(&app) {
                match git::push_changes(root, &creds.token, &creds.username) {
                    Ok(success) => println!("[lib.rs] Push deletion success: {}", success),
                    Err(e) => println!("[lib.rs] Push deletion FAILED: {}", e),
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn rename_note(app: tauri::AppHandle, root_path: String, old_filename: String, new_filename: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    let old_path = root.join(&old_filename);
    let new_path = root.join(&new_filename);
    fs::rename(old_path, new_path).map_err(|e| e.to_string())?;

    if let Ok(_) = git::ensure_repo(root) {
        let msg = format!("Rename: {} -> {}", old_filename, new_filename);
        if let Ok(_) = git::commit_changes(root, &msg) {
            if let Some(creds) = store::get_github_credentials(&app) {
                let _ = git::push_changes(root, &creds.token, &creds.username);
            }
        }
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
async fn rename_folder(app: tauri::AppHandle, root_path: String, old_name: String, new_name: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    let old_path = root.join(&old_name);
    let new_path = root.join(&new_name);
    fs::rename(old_path, new_path).map_err(|e| e.to_string())?;

    if let Ok(_) = git::ensure_repo(root) {
        let msg = format!("Rename folder: {} -> {}", old_name, new_name);
        if let Ok(_) = git::commit_changes(root, &msg) {
            if let Some(creds) = store::get_github_credentials(&app) {
                let _ = git::push_changes(root, &creds.token, &creds.username);
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn create_folder(app: tauri::AppHandle, root_path: String, folder_path: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;
    
    // Create .gitkeep to ensure Git tracks the empty folder
    let gitkeep_path = Path::new(&folder_path).join(".gitkeep");
    if !gitkeep_path.exists() {
        let _ = fs::write(gitkeep_path, "");
    }

    if let Ok(_) = git::ensure_repo(root) {
        let folder_name = Path::new(&folder_path).file_name().unwrap_or_default().to_string_lossy();
        let msg = format!("Created folder: {}", folder_name);
        if let Ok(_) = git::commit_changes(root, &msg) {
            if let Some(creds) = store::get_github_credentials(&app) {
                let _ = git::push_changes(root, &creds.token, &creds.username);
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn delete_folder_recursive(app: tauri::AppHandle, root_path: String, folder_path: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    fs::remove_dir_all(&folder_path).map_err(|e| e.to_string())?;

    if let Ok(_) = git::ensure_repo(root) {
        let folder_name = Path::new(&folder_path).file_name().unwrap_or_default().to_string_lossy();
        let msg = format!("Deleted folder (recursive): {}", folder_name);
        if let Ok(_) = git::commit_changes(root, &msg) {
            if let Some(creds) = store::get_github_credentials(&app) {
                let _ = git::push_changes(root, &creds.token, &creds.username);
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn delete_folder_move_contents(app: tauri::AppHandle, folder_path: String, root_path: String) -> Result<(), String> {
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

    if let Ok(_) = git::ensure_repo(root) {
        let folder_name = folder.file_name().unwrap_or_default().to_string_lossy();
        let msg = format!("Deleted folder (moved contents): {}", folder_name);
        if let Ok(_) = git::commit_changes(root, &msg) {
            if let Some(creds) = store::get_github_credentials(&app) {
                let _ = git::push_changes(root, &creds.token, &creds.username);
            }
        }
    }

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

#[tauri::command]
async fn sync_now(app: tauri::AppHandle, folder_path: String) -> Result<SyncResultPayload, String> {
    let root = Path::new(&folder_path);
    
    // Ensure the folder exists
    if !root.exists() {
        fs::create_dir_all(root).map_err(|e| format!("Could not create folder: {}", e))?;
    }

    // Ensure repo exists
    let repo = git::ensure_repo(root).map_err(|e| format!("Repo init failed: {}", e))?;

    if let Some(creds) = store::get_github_credentials(&app) {
        // Automatically add remote if missing
        if repo.find_remote("origin").is_err() {
            let repo_url = github::ensure_remote_repo(&creds.token, &creds.username).await
                .map_err(|e| format!("Remote lookup failed: {}", e))?;
            
            let auth_url = repo_url.replace("https://", &format!("https://{}:{}@", creds.username, creds.token));
            git::add_remote(root, &auth_url).map_err(|e| format!("Remote link failed: {}", e))?;
        }

        // CRITICAL: Commit local changes BEFORE pulling to prevent data loss.
        // Without this, pull would overwrite uncommitted local edits.
        // BUT: Only do this if the repo already has a HEAD (existing history).
        // On a FRESH repo (no HEAD), committing creates a divergent empty commit
        // that causes pull to treat ALL remote files as conflicts, deleting them.
        if repo.head().is_ok() {
            let _ = git::commit_changes(root, "Auto-save");
        }

        let pull_result = git::pull_changes(root, &creds.token, &creds.username)
            .map_err(|e| format!("Pull failed: {}", e))?;

        
        // 1. Recover physical folders from metadata that might be missing after a pull
        // (This addresses the "missing empty folder" issue since Git doesn't track them without .gitkeep)
        if let Ok(meta) = read_metadata(folder_path.clone()).await {
            if let Some(folder_order) = meta.folder_order {
                for folder_name in folder_order {
                    if folder_name.starts_with('.') { continue; }
                    let full_path = root.join(&folder_name);
                    if !full_path.exists() {
                        let _ = fs::create_dir_all(&full_path);
                        let _ = fs::write(full_path.join(".gitkeep"), "");
                    }
                }
            }
        }

        // Commit any merge results before pushing
        let _ = git::commit_changes(root, "Merge remote changes");

        let push_succeeded = git::push_changes(root, &creds.token, &creds.username).unwrap_or(false);

        let mut conflict_pairs = pull_result.conflict_pairs;
        let mut had_conflicts = pull_result.had_conflicts;

        // If no new conflicts, still check for "ongoing" conflicts on disk
        if !had_conflicts {
            let disk_conflicts = detect_ongoing_conflicts(root);
            if !disk_conflicts.is_empty() {
                conflict_pairs = disk_conflicts;
                had_conflicts = true;
            }
        }

        let payload = SyncResultPayload {
            had_changes: pull_result.had_changes,
            had_conflicts,
            conflict_pairs,
            push_succeeded,
        };
        app.emit("sync-complete", &payload).ok();
        Ok(payload)
    } else {
        // No GitHub credentials, but we still check for local conflict files (e.g. from iCloud or offline sync)
        let disk_conflicts = detect_ongoing_conflicts(root);
        let had_conflicts = !disk_conflicts.is_empty();
        
        let payload = SyncResultPayload {
            had_changes: false,
            had_conflicts,
            conflict_pairs: disk_conflicts,
            push_succeeded: false,
        };
        app.emit("sync-complete", &payload).ok();
        Ok(payload)
    }
}

/// Scans the directory for files containing " (Konflikt " and returns them as ConflictPairs.
fn detect_ongoing_conflicts(root: &Path) -> Vec<git::ConflictPair> {
    let mut pairs = Vec::new();
    let files = get_files_recursively(root);
    for file in files {
        let filename = file.file_name().unwrap_or_default().to_string_lossy();
        if filename.contains(" (Konflikt ") {
            println!("[lib.rs] Detected ongoing conflict file: {}", filename);
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
    
    if let Ok(_) = git::ensure_repo(root) {
        let msg = format!("Added asset: {}", filename);
        if let Ok(_) = git::commit_changes(root, &msg) {
            spawn_sync(app, root_path);
        }
    }
    
    Ok(SaveAssetResponse {
        success: true,
        path: Some(format!(".assets/{}", filename).replace("\\", "/")),
        error: None,
    })
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
            get_app_version, get_document_dir, connect_github,
            start_github_oauth, complete_github_oauth, sync_now, start_watch,
            clear_github_credentials, save_asset, /* hide_quick_note, open_quick_note_devtools */
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
