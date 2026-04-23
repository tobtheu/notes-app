use std::env;

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    if target_os == "ios" {
        println!("cargo:rustc-link-lib=z");
        println!("cargo:rustc-link-lib=iconv");
    }

    // Load .env file so VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
    // are available to supabase_sync.rs at compile time via env!()
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let env_path = std::path::Path::new(&manifest_dir).parent().unwrap().join(".env");
    if env_path.exists() {
        for line in std::fs::read_to_string(&env_path).unwrap_or_default().lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') { continue; }
            if let Some((key, val)) = line.split_once('=') {
                let key = key.trim();
                let val = val.trim();
                if key == "VITE_SUPABASE_URL" || key == "VITE_SUPABASE_ANON_KEY" || key == "VITE_LAMA_SECRET" {
                    println!("cargo:rustc-env={}={}", key, val);
                }
            }
        }
    }
    println!("cargo:rerun-if-changed=../.env");

    tauri_build::build()
}
