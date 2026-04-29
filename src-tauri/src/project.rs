use std::fs::{create_dir_all, read_to_string, write};
use std::path::{Path, PathBuf};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Manager;

use crate::LaunchProject;

// ── Estructuras ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectMeta {
    pub name: String,
    pub version: String,
    pub ziron_version: String,
    pub created_at: String,
    pub last_opened: String,
    pub startup_scene: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentProject {
    pub name: String,
    pub path: String,       // path al .ziron.project
    pub last_opened: String,
}

// ── Helpers de ruta ───────────────────────────────────────────────────────────

fn recents_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    path.push("config");
    create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("recent_projects.json");
    Ok(path)
}

// ── Comandos ──────────────────────────────────────────────────────────────────

/// Crea un proyecto nuevo en el path dado (debe ser una carpeta vacía o nueva)
#[tauri::command]
pub fn create_project(folder_path: String, name: String) -> Result<String, String> {
    let folder = Path::new(&folder_path);
    create_dir_all(folder).map_err(|e| e.to_string())?;

    create_dir_all(folder.join("scenes")).map_err(|e| e.to_string())?;
    create_dir_all(folder.join("assets")).map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();

    let meta = ProjectMeta {
        name: name.clone(),
        version: "1.0.0".to_string(),
        ziron_version: env!("CARGO_PKG_VERSION").to_string(),
        created_at: now.clone(),
        last_opened: now.clone(),
        startup_scene: "scenes/main.ziron.scene".to_string(),
    };
    let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    let project_file = folder.join(format!("{}.ziron.project", name));
    write(&project_file, meta_json).map_err(|e| e.to_string())?;

    // Escena inicial vacía pues eso
    let scene = json!({
        "name": "main",
        "entities": []
    });
    let scene_json = serde_json::to_string_pretty(&scene).map_err(|e| e.to_string())?;
    write(folder.join("scenes/main.ziron.scene"), scene_json).map_err(|e| e.to_string())?;

    Ok(project_file.to_string_lossy().to_string())
}

/// Carga los metadatos de un proyecto dado el path al .ziron.project
#[tauri::command]
pub fn load_project(app: tauri::AppHandle, project_file: String) -> Result<Value, String> {
    let path = Path::new(&project_file);
    if !path.exists() {
        return Err(format!("Project file not found: {}", project_file));
    }

    let text = read_to_string(path).map_err(|e| e.to_string())?;
    let mut meta: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;

    meta["last_opened"] = json!(Utc::now().to_rfc3339());
    let updated = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    write(path, updated).map_err(|e| e.to_string())?;

    let folder = path.parent().unwrap().to_string_lossy().to_string();
    let name = meta["name"].as_str().unwrap_or("Unknown").to_string();
    add_recent(&app, RecentProject {
        name,
        path: project_file.clone(),
        last_opened: meta["last_opened"].as_str().unwrap_or("").to_string(),
    })?;

    let mut result = meta;
    result["_folder"] = json!(folder);
    result["_project_file"] = json!(project_file);
    Ok(result)
}

/// Guarda la escena activa
#[tauri::command]
pub fn save_scene(scene_path: String, scene_data: Value) -> Result<(), String> {
    let path = Path::new(&scene_path);
    if let Some(parent) = path.parent() {
        create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(&scene_data).map_err(|e| e.to_string())?;
    write(path, text).map_err(|e| e.to_string())?;
    Ok(())
}

/// Carga una escena dado su path absoluto
#[tauri::command]
pub fn load_scene(scene_path: String) -> Result<Value, String> {
    let path = Path::new(&scene_path);
    if !path.exists() {
        return Err(format!("Scene not found: {}", scene_path));
    }
    let text = read_to_string(path).map_err(|e| e.to_string())?;
    let scene: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(scene)
}

/// Revisa los argumentos de lanzamiento para ver si se abrió un proyecto directamente
#[tauri::command]
pub fn get_launch_project(state: tauri::State<LaunchProject>) -> Option<String> {
    state.0.clone()
}

/// Devuelve la lista de proyectos recientes
#[tauri::command]
pub fn get_recent_projects(app: tauri::AppHandle) -> Result<Vec<RecentProject>, String> {
    let path = recents_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let text = read_to_string(&path).map_err(|e| e.to_string())?;
    let list: Vec<RecentProject> = serde_json::from_str(&text).unwrap_or_default();
    Ok(list)
}

/// Elimina un proyecto de la lista de recientes (no borra los archivos)
#[tauri::command]
pub fn remove_recent_project(app: tauri::AppHandle, project_path: String) -> Result<(), String> {
    let path = recents_path(&app)?;
    if !path.exists() { return Ok(()); }
    let text = read_to_string(&path).map_err(|e| e.to_string())?;
    let mut list: Vec<RecentProject> = serde_json::from_str(&text).unwrap_or_default();
    let normalized = normalize_path(&project_path);
    list.retain(|r| normalize_path(&r.path) != normalized);
    let updated = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    write(&path, updated).map_err(|e| e.to_string())?;
    Ok(())
}

/// Abre el diálogo nativo del sistema para elegir una carpeta
#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::{Arc, Mutex};

    let (tx, rx) = std::sync::mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));

    app.dialog()
        .file()
        .pick_folder(move |folder| {
            if let Some(tx) = tx.lock().unwrap().take() {
                let _ = tx.send(folder.map(|p| p.to_string()));
            }
        });

    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pick_project_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::{Arc, Mutex};

    let (tx, rx) = std::sync::mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));

    app.dialog()
        .file()
        .add_filter("ZIRON Project", &["ziron.project"])
        .pick_file(move |file| {
            if let Some(tx) = tx.lock().unwrap().take() {
                let _ = tx.send(file.map(|p| p.to_string()));
            }
        });

    rx.recv().map_err(|e| e.to_string())
}

// ── Interno ───────────────────────────────────────────────────────────────────

fn normalize_path(p: &str) -> String {
    Path::new(p)
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| p.replace('\\', "/").trim_end_matches('/').to_string())
}

fn add_recent(app: &tauri::AppHandle, project: RecentProject) -> Result<(), String> {
    let path = recents_path(app)?;
    let mut list: Vec<RecentProject> = if path.exists() {
        let text = read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).unwrap_or_default()
    } else {
        vec![]
    };

    let normalized_incoming = normalize_path(&project.path);
    list.retain(|r| normalize_path(&r.path) != normalized_incoming);
    list.insert(0, project);
    list.truncate(10);

    let text = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    write(&path, text).map_err(|e| e.to_string())?;
    Ok(())
}