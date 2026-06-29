use std::fs::{create_dir_all, read_to_string, write, remove_dir_all, rename, read_dir};
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

/// Actualiza la versión de Ziron en el .ziron.project (usado para actualizar proyectos antiguos)
#[tauri::command]
pub fn update_project_version(project_file: String, new_version: String) -> Result<(), String> {
    let path = Path::new(&project_file);
    let text = read_to_string(path).map_err(|e| e.to_string())?;
    let mut meta: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    meta["ziron_version"] = json!(new_version);
    let updated = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    write(path, updated).map_err(|e| e.to_string())?;
    Ok(())
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

/// SISTEMA PARA VENTANA ASSETS

/// Esta función se queda comentada debido a que solo lee la primera entrada, no hace el sistema chulo de abajo
/* #[tauri::command]
pub fn list_asset_folders(project_folder: String) -> Result<Vec<String>, String> {
    let assets_path = Path::new(&project_folder).join("assets");
    create_dir_all(&assets_path).map_err(|e| e.to_string())?;

    let mut folders = vec![];
    for entry in read_dir(&assets_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            folders.push(entry.file_name().to_string_lossy().to_string());
        }
    }
    Ok(folders)
} */

#[derive(Serialize)]
pub struct FileNode {
    pub name: String,
}

#[derive(Serialize)]
pub struct FolderNode {
    pub name: String,
    pub children: Vec<FolderNode>,
    pub files: Vec<FileNode>,
}

fn read_folder_tree(path: &Path) -> Result<(Vec<FolderNode>, Vec<FileNode>), String> {
    let mut folders = vec![];
    let mut files = vec![];

    for entry in read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        if ft.is_dir() {
            let (children, child_files) = read_folder_tree(&entry.path())?;
            folders.push(FolderNode { name, children, files: child_files });
        } else if ft.is_file() {
            let lower = name.to_lowercase();
            if lower.ends_with(".glb") || lower.ends_with(".gltf")
                || lower.ends_with(".obj") || lower.ends_with(".fbx")
                || lower.ends_with(".png") || lower.ends_with(".jpg")
                || lower.ends_with(".jpeg") || lower.ends_with(".webp")
            {
                files.push(FileNode { name });
        }
}
    }
    Ok((folders, files))
}

#[derive(Serialize)]
pub struct AssetTree {
    pub folders: Vec<FolderNode>,
    pub files: Vec<FileNode>,
}

#[tauri::command]
pub fn list_asset_tree(project_folder: String) -> Result<AssetTree, String> {
    let assets_path = Path::new(&project_folder).join("assets");
    create_dir_all(&assets_path).map_err(|e| e.to_string())?;
    let (folders, files) = read_folder_tree(&assets_path)?;
    Ok(AssetTree { folders, files })
}

#[tauri::command]
pub fn create_asset_folder(project_folder: String, folder_path: String) -> Result<(), String> {
    let path = Path::new(&project_folder).join("assets").join(&folder_path);
    create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_asset_folder(project_folder: String, folder_name: String) -> Result<(), String> {
    let path = Path::new(&project_folder).join("assets").join(&folder_name);
    remove_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_asset_folder(
    project_folder: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let base = Path::new(&project_folder).join("assets");
    rename(base.join(&old_name), base.join(&new_name)).map_err(|e| e.to_string())?;
    Ok(())
}

fn copy_dir_recursive_renamed(src: &Path, dst: &Path) -> Result<(), String> {
    create_dir_all(dst).map_err(|e| e.to_string())?;

    for entry in read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        let src_path = entry.path();

        if ft.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            let new_name = format!("{} Copy", name);
            copy_dir_recursive_renamed(&src_path, &dst.join(&new_name))?;
        } else {
            // Cuando haya assets reales, los archivos se copian tal cual
            let file_name = entry.file_name();
            std::fs::copy(&src_path, dst.join(&file_name)).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn copy_asset_folder(
    project_folder: String,
    source_path: String,
    dest_path: String,
) -> Result<(), String> {
    let base = Path::new(&project_folder).join("assets");
    copy_dir_recursive_renamed(&base.join(&source_path), &base.join(&dest_path))
}

/// SISTEMA PARA ASSETS PERO MODELOS Y ASSETS ESPECIFICOS | TAMBIEN IMAGENES DE TEXTURAS
#[tauri::command]
pub async fn pick_model_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::{Arc, Mutex};

    let (tx, rx) = std::sync::mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));

    app.dialog()
        .file()
        .add_filter("3D Model", &["glb", "gltf", "obj", "fbx"])
        .pick_file(move |file| {
            if let Some(tx) = tx.lock().unwrap().take() {
                let _ = tx.send(file.map(|p| p.to_string()));
            }
        });

    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pick_texture_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::{Arc, Mutex};

    let (tx, rx) = std::sync::mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));

    app.dialog()
        .file()
        .add_filter("Image", &["png", "jpg", "jpeg", "webp"])
        .pick_files(move |files| {
            if let Some(tx) = tx.lock().unwrap().take() {
                let paths = files
                    .map(|fs| fs.into_iter().map(|p| p.to_string()).collect())
                    .unwrap_or_default();
                let _ = tx.send(paths);
            }
        });

    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_asset_file(
    project_folder: String,
    source_path: String,
    target_folder: String,
) -> Result<String, String> {
    let src = Path::new(&source_path);
    let file_name = src.file_name().ok_or("Invalid source path")?;
    let dest_dir = if target_folder.is_empty() {
        Path::new(&project_folder).join("assets")
    } else {
        Path::new(&project_folder).join("assets").join(&target_folder)
    };
    create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest = dest_dir.join(file_name);
    std::fs::copy(src, &dest).map_err(|e| e.to_string())?;
    Ok(file_name.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_asset_file(project_folder: String, file_path: String) -> Result<(), String> {
    let path = Path::new(&project_folder).join("assets").join(&file_path);
    std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_asset_file(
    project_folder: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let base = Path::new(&project_folder).join("assets");
    rename(base.join(&old_path), base.join(&new_path)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn copy_asset_file(
    project_folder: String,
    source_path: String,
    dest_path: String,
) -> Result<(), String> {
    let base = Path::new(&project_folder).join("assets");
    std::fs::copy(base.join(&source_path), base.join(&dest_path))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// PARA COSAS DEL ASSET PICKER
fn read_folder_tree_filtered(path: &Path, extensions: &[String]) -> Result<(Vec<FolderNode>, Vec<FileNode>), String> {
    let mut folders = vec![];
    let mut files = vec![];

    for entry in read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        if ft.is_dir() {
            let (children, child_files) = read_folder_tree_filtered(&entry.path(), extensions)?;
            folders.push(FolderNode { name, children, files: child_files });
        } else if ft.is_file() {
            let lower = name.to_lowercase();
            if extensions.iter().any(|ext| lower.ends_with(ext.as_str())) {
                files.push(FileNode { name });
            }
        }
    }
    Ok((folders, files))
}

/// Lista assets filtrados por extensión (usado por el asset picker de componentes)
#[tauri::command]
pub fn list_assets_by_extension(project_folder: String, extensions: Vec<String>) -> Result<AssetTree, String> {
    let assets_path = Path::new(&project_folder).join("assets");
    create_dir_all(&assets_path).map_err(|e| e.to_string())?;

    let normalized: Vec<String> = extensions
        .iter()
        .map(|e| {
            let e = e.to_lowercase();
            if e.starts_with('.') { e } else { format!(".{}", e) }
        })
        .collect();

    let (folders, files) = read_folder_tree_filtered(&assets_path, &normalized)?;
    Ok(AssetTree { folders, files })
}