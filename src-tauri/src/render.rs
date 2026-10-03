use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::sync::{Arc, Mutex};

#[tauri::command]
pub async fn save_render_png(
    app: tauri::AppHandle,
    default_name: String,
    data_base64: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let bytes = STANDARD.decode(&data_base64).map_err(|e| e.to_string())?;

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

    let chosen = rx.recv().map_err(|e| e.to_string())?;

    if let Some(path_str) = &chosen {
        std::fs::write(path_str, &bytes).map_err(|e| e.to_string())?;
    }

    Ok(chosen)
}