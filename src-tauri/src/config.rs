use std::fs::{create_dir_all, read_to_string, write};
use serde_json::{Value, json};
use tauri::Manager;

pub fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    path.push("config");
    create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("config.ziron.json");
    Ok(path)
}

fn default_config() -> Value {
    json!({
        "_comment": "'Hackers', feel free to modify whatever you want at your own risk.",
        "keybinds": {
            "TOOL_TRANSLATE": { "key": "w", "ctrl": false, "shift": false, "alt": false },
            "TOOL_ROTATE":    { "key": "e", "ctrl": false, "shift": false, "alt": false },
            "TOOL_SCALE":     { "key": "r", "ctrl": false, "shift": false, "alt": false },
            "UNDO":           { "key": "z", "ctrl": true,  "shift": false, "alt": false },
            "REDO":           { "key": "y", "ctrl": true,  "shift": false, "alt": false },
            "SAVE":           { "key": "s", "ctrl": true,  "shift": false, "alt": false },
            "DELETE":         { "key": "Delete", "ctrl": false, "shift": false, "alt": false },
            "DUPLICATE":      { "key": "d", "ctrl": true,  "shift": false, "alt": false },
            "RENAME":         { "key": "F2", "ctrl": false, "shift": false, "alt": false },
            "COPY":           { "key": "c", "ctrl": true,  "shift": false, "alt": false },
            "PASTE":          { "key": "v", "ctrl": true,  "shift": false, "alt": false },
            "SELECT_ADD": { "key": "shift", "ctrl": false, "shift": true, "alt": false },
            "_BLOCK_FIND":    { "key": "f", "ctrl": true,  "shift": false, "alt": false },
            "_BLOCK_PRINT":   { "key": "p", "ctrl": true,  "shift": false, "alt": false },
            "_BLOCK_GOTO":    { "key": "g", "ctrl": true,  "shift": false, "alt": false }
        },
        "editor": {
            "locale": "en",
            "projects_folder": ""
        },
        "window": {
            "width": 800,
            "height": 600,
            "maximized": true
        }
    })
}

#[tauri::command]
pub fn load_config(app: tauri::AppHandle) -> Result<Value, String> {
    let path = config_path(&app)?;

    if !path.exists() {
        let defaults = default_config();
        let text = serde_json::to_string_pretty(&defaults).map_err(|e| e.to_string())?;
        write(&path, text).map_err(|e| e.to_string())?;
        return Ok(defaults);
    }

    let text = read_to_string(&path).map_err(|e| e.to_string())?;
    let mut config: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;

    merge_defaults(&mut config, &default_config());

    Ok(config)
}

#[tauri::command]
pub fn save_config(app: tauri::AppHandle, config: Value) -> Result<(), String> {
    let path = config_path(&app)?;
    let text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    write(&path, text).map_err(|e| e.to_string())?;
    Ok(())
}

fn merge_defaults(target: &mut Value, defaults: &Value) {
    if let (Some(target_obj), Some(defaults_obj)) = (target.as_object_mut(), defaults.as_object()) {
        for (key, default_val) in defaults_obj {
            if !target_obj.contains_key(key) {
                target_obj.insert(key.clone(), default_val.clone());
            } else {
                merge_defaults(target_obj.get_mut(key).unwrap(), default_val);
            }
        }
    }
}

pub fn read_config(app: &tauri::AppHandle) -> Value {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return default_config(),
    };

    if !path.exists() {
        return default_config();
    }

    let text = match read_to_string(&path) {
        Ok(t) => t,
        Err(_) => return default_config(),
    };

    let mut config: Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => return default_config(),
    };

    merge_defaults(&mut config, &default_config());
    config
}