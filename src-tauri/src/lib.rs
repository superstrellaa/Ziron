use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::sync::Mutex;

use chrono::Utc;
use once_cell::sync::Lazy;
use rand::{Rng};
use tauri::{ Manager, PhysicalPosition };

// =========================
// GLOBAL STATE
// =========================

static RUN_ID: Lazy<String> = Lazy::new(|| {
    let mut rng = rand::thread_rng();
    (0..8)
        .map(|_| format!("{:X}", rng.gen_range(0..16)))
        .collect()
});

static LOG_FILE: Lazy<Mutex<Option<std::fs::File>>> =
    Lazy::new(|| Mutex::new(None));

// =========================
// LOGGER INIT
// =========================

#[tauri::command]
fn init_logger(app: tauri::AppHandle) -> Result<String, String> {
    let mut logs_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    logs_dir.push("logs");

    create_dir_all(&logs_dir).map_err(|e| e.to_string())?;

    let date = Utc::now().format("%Y-%m-%d");
    let filename = format!("ziron-engine_{}_{}.log", date, *RUN_ID);

    logs_dir.push(filename);

    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&logs_dir)
        .map_err(|e| e.to_string())?;

    *LOG_FILE.lock().unwrap() = Some(file);

    let msg = format!("Logger started — RUN_ID: {}", *RUN_ID);
    println!("{}", msg);

    Ok(msg)
}

// =========================
// LOG FUNCTION
// =========================

#[tauri::command]
fn log(level: String, module: String, message: String) {
    let timestamp = Utc::now().to_rfc3339();

    let line = format!(
        "[{}] [{:5}] [{}] {}",
        timestamp,
        level,
        module,
        message
    );

    println!("{}", line);

    if let Some(file) = &mut *LOG_FILE.lock().unwrap() {
        let _ = writeln!(file, "{}", line);
    }
}

// =========================
// CURSOR CONTROL
// =========================

#[tauri::command]
fn grab_cursor(window: tauri::Window) {
    let _ = window.set_cursor_visible(false);
}

#[tauri::command]
fn release_cursor(window: tauri::Window) {
    let _ = window.set_cursor_visible(true);
}

#[tauri::command]
fn recenter_cursor(window: tauri::Window) -> Result<(i32, i32), String> {
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let cx = (size.width / 2) as i32;
    let cy = (size.height / 2) as i32;
    window
        .set_cursor_position(PhysicalPosition::new(cx, cy))
        .map_err(|e| e.to_string())?;
    Ok((cx, cy))
}

// =========================
// RUN APPLICATION
// =========================

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
            log,
            init_logger,
            grab_cursor,
            release_cursor,
            recenter_cursor
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}