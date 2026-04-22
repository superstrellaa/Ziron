use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::sync::Mutex;

use chrono::Utc;
use once_cell::sync::Lazy;
use rand::Rng;

use tauri::Manager;

static RUN_ID: Lazy<String> = Lazy::new(|| {
    let mut rng = rand::thread_rng();
    (0..8)
        .map(|_| format!("{:X}", rng.gen_range(0..16)))
        .collect()
});

static LOG_FILE: Lazy<Mutex<Option<std::fs::File>>> =
    Lazy::new(|| Mutex::new(None));

#[tauri::command]
pub fn init_logger(app: tauri::AppHandle) -> Result<String, String> {
    if cfg!(debug_assertions) {
        println!("Logger: dev mode, skipping file creation");
        return Ok("dev mode".to_string());
    }

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

#[tauri::command]
pub fn log(level: String, module: String, message: String) {
    let timestamp = Utc::now().to_rfc3339();
    let line = format!("[{}] [{:5}] [{}] {}", timestamp, level, module, message);
    println!("{}", line);

    if let Some(file) = &mut *LOG_FILE.lock().unwrap() {
        let _ = writeln!(file, "{}", line);
    }
}