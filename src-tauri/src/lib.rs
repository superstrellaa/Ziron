mod logger;
mod cursor;
mod config;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.maximize();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            logger::log,
            logger::init_logger,
            cursor::grab_cursor,
            cursor::release_cursor,
            cursor::recenter_cursor,
            config::load_config,
            config::save_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}