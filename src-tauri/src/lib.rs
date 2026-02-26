use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use std::sync::{Arc, Mutex};
use notify::{Watcher, RecursiveMode};
use tauri::Emitter;

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
    let files = get_files_recursively(root);
    
    let mut notes = Vec::new();
    for file in files {
        if file.extension().map_or(false, |ext| ext == "md") {
            let content = fs::read_to_string(&file).unwrap_or_default();
            let metadata = fs::metadata(&file).map_err(|e| e.to_string())?;
            let updated_at: String = metadata.modified()
                .map(|m| {
                    let dt: DateTime<Utc> = m.into();
                    dt.to_rfc3339()
                })
                .unwrap_or_else(|_| Utc::now().to_rfc3339());

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

#[tauri::command]
async fn list_folders(folder_path: String) -> Result<Vec<String>, String> {
    let mut folders = Vec::new();
    let entries = fs::read_dir(folder_path).map_err(|e| e.to_string())?;
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
async fn save_note(folder_path: String, filename: String, content: String) -> Result<(), String> {
    let path = Path::new(&folder_path).join(filename);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_note(folder_path: String, filename: String) -> Result<(), String> {
    let path = Path::new(&folder_path).join(filename);
    fs::remove_file(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn rename_note(folder_path: String, old_filename: String, new_filename: String) -> Result<(), String> {
    let old_path = Path::new(&folder_path).join(old_filename);
    let new_path = Path::new(&folder_path).join(new_filename);
    fs::rename(old_path, new_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn read_metadata(root_path: String) -> Result<AppMetadata, String> {
    let config_path = Path::new(&root_path).join("notizapp-config.json");
    let legacy_path = Path::new(&root_path).join(".notizapp-metadata.json");

    let mut needs_migration = !config_path.exists() && legacy_path.exists();

    // Migration robustness: If config exists but is effectively empty (no folders, no settings),
    // and we have a legacy file, we should still attempt to migrate.
    if config_path.exists() && legacy_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(metadata) = serde_json::from_str::<serde_json::Value>(&content) {
                // If the new config has no folder groupings yet, it's safe to migrate from legacy.
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
        let metadata: AppMetadata = serde_json::from_str(&content).unwrap_or_else(|_| AppMetadata { 
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
async fn rename_folder(root_path: String, old_name: String, new_name: String) -> Result<(), String> {
    let old_path = Path::new(&root_path).join(old_name);
    let new_path = Path::new(&root_path).join(new_name);
    fs::rename(old_path, new_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn create_folder(folder_path: String) -> Result<(), String> {
    fs::create_dir_all(folder_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_folder_recursive(folder_path: String) -> Result<(), String> {
    fs::remove_dir_all(folder_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_folder_move_contents(folder_path: String, root_path: String) -> Result<(), String> {
    let folder = Path::new(&folder_path);
    let root = Path::new(&root_path);
    
    let files = get_files_recursively(folder);
    for file in files {
        if file.extension().map_or(false, |ext| ext == "md") {
            let basename = file.file_name().unwrap();
            let mut target_path = root.join(basename);
            
            // Handle collisions
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

struct WatcherState(Arc<Mutex<Option<notify::RecommendedWatcher>>>);

#[tauri::command]
async fn start_watch(app: tauri::AppHandle, folder_path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_guard = state.0.lock().map_err(|e| e.to_string())?;
    
    // Stop old watcher if exists
    if let Some(mut old_watcher) = watcher_guard.take() {
        old_watcher.unwatch(Path::new(&folder_path)).ok();
    }

    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        match res {
            Ok(_event) => {
                app_handle.emit("file-changed", ()).ok();
            },
            Err(e) => println!("watch error: {:?}", e),
        }
    }).map_err(|e| e.to_string())?;

    watcher.watch(Path::new(&folder_path), RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    
    *watcher_guard = Some(watcher);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            list_notes,
            list_folders,
            save_note,
            delete_note,
            rename_note,
            read_metadata,
            save_metadata,
            rename_folder,
            create_folder,
            delete_folder_recursive,
            delete_folder_move_contents,
            get_app_version,
            start_watch
        ])
        .manage(WatcherState(Arc::new(Mutex::new(None))))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
