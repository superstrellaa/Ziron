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

static EARLY_BUFFER: Lazy<Mutex<Vec<String>>> =
    Lazy::new(|| Mutex::new(Vec::new()));

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
    let filename = format!("ziron-studio_{}_{}.log", date, *RUN_ID);
    logs_dir.push(filename);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&logs_dir)
        .map_err(|e| e.to_string())?;

    let drained: Vec<String> = EARLY_BUFFER.lock().unwrap().drain(..).collect();
    for line in &drained {
        let _ = writeln!(file, "{}", line);
    }

    *LOG_FILE.lock().unwrap() = Some(file);

    let msg = format!(
        "Logger started — RUN_ID: {} ({} buffered lines flushed)",
        *RUN_ID,
        drained.len()
    );
    println!("{}", msg);
    log("INFO".to_string(), "logger".to_string(), msg.clone(), None, None);
    Ok(msg)
}

#[tauri::command]
pub fn log(
    level: String,
    module: String,
    message: String,
    ts: Option<String>,
    seq: Option<u64>,
) {
    let timestamp = ts.unwrap_or_else(|| Utc::now().to_rfc3339());
    let seq_part = seq.map(|s| format!(" [#{}]", s)).unwrap_or_default();
    let line = format!(
        "[{}]{} [{:5}] [{}] {}",
        timestamp, seq_part, level, module, message
    );
    println!("{}", line);

    let mut guard = LOG_FILE.lock().unwrap();
    match guard.as_mut() {
        Some(file) => {
            let _ = writeln!(file, "{}", line);
        }
        None if !cfg!(debug_assertions) => {
            EARLY_BUFFER.lock().unwrap().push(line);
        }
        None => {}
    }
}