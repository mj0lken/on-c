use std::fs;
use std::path::{Path, PathBuf};

fn sanitize_export_parts(filename: &str) -> (String, &'static str) {
    let base_name = Path::new(filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("onc-sheet.md");

    let raw_stem = Path::new(base_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("onc-sheet")
        .trim()
        .trim_start_matches('.');

    let stem = if raw_stem.is_empty() {
        "onc-sheet".to_string()
    } else {
        raw_stem.to_string()
    };

    let ext = match Path::new(base_name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("csv") => "csv",
        Some("txt") => "txt",
        _ => "md",
    };

    (stem, ext)
}

#[tauri::command]
fn save_export_file(filename: String, content: String) -> Result<String, String> {
    let (stem, ext) = sanitize_export_parts(&filename);
    let safe_name = format!("{stem}.{ext}");

    let home = std::env::var("HOME").map_err(|_| "Could not resolve HOME directory".to_string())?;
    let downloads_dir = PathBuf::from(&home).join("Downloads");
    let target_dir = if downloads_dir.is_dir() {
        downloads_dir
    } else {
        PathBuf::from(&home)
    };

    let mut candidate = target_dir.join(&safe_name);
    let mut counter = 2u32;
    while candidate.exists() && counter < 1000 {
        candidate = target_dir.join(format!("{stem} ({counter}).{ext}"));
        counter += 1;
    }

    fs::write(&candidate, content.as_bytes()).map_err(|e| format!("Export failed: {e}"))?;

    let final_name = candidate
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&safe_name);
    Ok(format!("~/Downloads/{final_name}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_export_file])
        .run(tauri::generate_context!())
        .expect("error while running on/c application");
}

#[cfg(test)]
mod tests {
    use super::sanitize_export_parts;

    #[test]
    fn preserves_supported_extensions() {
        assert_eq!(
            sanitize_export_parts("studio-trip.md"),
            ("studio-trip".to_string(), "md")
        );
        assert_eq!(
            sanitize_export_parts("budget-2026.CSV"),
            ("budget-2026".to_string(), "csv")
        );
        assert_eq!(
            sanitize_export_parts("notes.txt"),
            ("notes".to_string(), "txt")
        );
    }

    #[test]
    fn strips_traversal_dotfiles_and_disallowed_extensions() {
        assert_eq!(
            sanitize_export_parts("../../etc/passwd"),
            ("passwd".to_string(), "md")
        );
        assert_eq!(
            sanitize_export_parts("../.zshrc"),
            ("zshrc".to_string(), "md")
        );
        assert_eq!(
            sanitize_export_parts("autorun.command"),
            ("autorun".to_string(), "md")
        );
        assert_eq!(sanitize_export_parts(".."), ("onc-sheet".to_string(), "md"));
    }
}
