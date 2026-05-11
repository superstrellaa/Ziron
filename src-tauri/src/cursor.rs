use tauri::PhysicalPosition;

#[tauri::command]
pub fn start_fly(window: tauri::Window) -> Result<(), String> {
    window.set_cursor_visible(false).map_err(|e| e.to_string())?;
    window.set_cursor_grab(true).map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    window
        .set_cursor_position(PhysicalPosition::new(size.width / 2, size.height / 2))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn stop_fly(window: tauri::Window) -> Result<(), String> {
    window.set_cursor_grab(false).map_err(|e| e.to_string())?;
    window.set_cursor_visible(true).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn recenter_cursor(window: tauri::Window) -> Result<(), String> {
    let size = window.inner_size().map_err(|e| e.to_string())?;
    window
        .set_cursor_position(PhysicalPosition::new(size.width / 2, size.height / 2))
        .map_err(|e| e.to_string())?;
    Ok(())
}