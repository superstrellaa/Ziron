use std::fs::{rename, write};
use std::path::{Path, PathBuf};

use crate::logger;

fn log_warn(message: String) {
    logger::log("WARN".to_string(), "fs".to_string(), message, None, None);
}

pub fn write_atomic(path: &Path, contents: &[u8]) -> Result<(), String> {
    let mut tmp_name = path.as_os_str().to_owned();
    tmp_name.push(".ziron-tmp");
    let tmp = PathBuf::from(tmp_name);

    let result = write(&tmp, contents).and_then(|_| rename(&tmp, path));

    if let Err(e) = result {
        if let Err(cleanup) = std::fs::remove_file(&tmp) {
            if cleanup.kind() != std::io::ErrorKind::NotFound {
                log_warn(format!("Could not remove temp file {}: {cleanup}", tmp.display()));
            }
        }
        return Err(format!("Could not write {}: {e}", path.display()));
    }
    Ok(())
}

pub async fn run_blocking<T, F>(job: F) -> Result<T, String>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|e| format!("Background task failed: {e}"))
}