use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::logger;

const PNG_SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];

fn render_file_write_error(error: std::io::Error) -> String {
    #[cfg(windows)]
    if matches!(error.raw_os_error(), Some(32) | Some(33) | Some(1224)) {
        return format!("render_file_locked: {error}");
    }

    error.to_string()
}

fn write_png_atomically(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut tmp_name = path.as_os_str().to_owned();
    tmp_name.push(".ziron-tmp");
    let tmp = PathBuf::from(tmp_name);

    let result = std::fs::write(&tmp, bytes).and_then(|_| std::fs::rename(&tmp, path));

    if let Err(e) = result {
        if let Err(cleanup_err) = std::fs::remove_file(&tmp) {
            if cleanup_err.kind() != std::io::ErrorKind::NotFound {
                logger::log(
                    "WARN".to_string(),
                    "render".to_string(),
                    format!("Could not remove temp render file {}: {cleanup_err}", tmp.display()),
                    None,
                    None,
                );
            }
        }
        return Err(render_file_write_error(e));
    }

    Ok(())
}

#[tauri::command]
pub async fn save_render_png(
    app: tauri::AppHandle,
    default_name: String,
    data_base64: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let bytes = STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Render data is not valid base64: {e}"))?;

    if bytes.len() <= PNG_SIGNATURE.len() || !bytes.starts_with(&PNG_SIGNATURE) {
        return Err("Render data is not a valid PNG image".to_string());
    }

    let (tx, rx) = std::sync::mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));

    app.dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("PNG Image", &["png"])
        .save_file(move |path| {
            if let Some(tx) = tx.lock().unwrap().take() {
                let _ = tx.send(path.map(|p| p.to_string()));
            }
        });

    let chosen = rx
        .recv()
        .map_err(|_| "Save dialog closed without a result".to_string())?;

    if let Some(path_str) = &chosen {
        write_png_atomically(Path::new(path_str), &bytes)?;
    }

    Ok(chosen)
}