use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn save_export_file(filename: String, content: String) -> Result<String, String> {
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("onc-sheet.md");

    let home = std::env::var("HOME").map_err(|_| "Could not resolve HOME directory".to_string())?;
    let downloads_dir = PathBuf::from(&home).join("Downloads");
    let target_dir = if downloads_dir.is_dir() {
        downloads_dir
    } else {
        PathBuf::from(&home)
    };

    let stem = std::path::Path::new(safe_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("onc-sheet");
    let ext = std::path::Path::new(safe_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("md");

    let mut candidate = target_dir.join(safe_name);
    let mut counter = 2u32;
    while candidate.exists() && counter < 1000 {
        candidate = target_dir.join(format!("{stem} ({counter}).{ext}"));
        counter += 1;
    }

    fs::write(&candidate, content.as_bytes()).map_err(|e| format!("Export failed: {e}"))?;

    let final_name = candidate
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(safe_name);
    Ok(format!("~/Downloads/{final_name}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_export_file])
        .run(tauri::generate_context!())
        .expect("error while running on/c application");
}
