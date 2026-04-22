use tauri::PhysicalPosition;

#[tauri::command]
pub fn grab_cursor(window: tauri::Window) {
    let _ = window.set_cursor_visible(false);
}

#[tauri::command]
pub fn release_cursor(window: tauri::Window) {
    let _ = window.set_cursor_visible(true);
}

#[tauri::command]
pub fn recenter_cursor(window: tauri::Window) -> Result<(i32, i32), String> {
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let cx = (size.width / 2) as i32;
    let cy = (size.height / 2) as i32;
    window
        .set_cursor_position(PhysicalPosition::new(cx, cy))
        .map_err(|e| e.to_string())?;
    Ok((cx, cy))
}