use std::env;

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    
    if target_os == "ios" {
        println!("cargo:rustc-link-lib=z");
        println!("cargo:rustc-link-lib=iconv");
    }

    tauri_build::build()
}
