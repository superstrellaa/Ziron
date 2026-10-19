use std::fs::{create_dir_all, read_to_string, write, remove_dir_all, rename, read_dir};
use std::path::{Component, Path, PathBuf};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Manager;

use crate::logger;
use crate::util::{run_blocking, write_atomic};
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

// ── Helpers ───────────────────────────────────────────────────────────

fn recents_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    path.push("config");
    create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("recent_projects.json");
    Ok(path)
}

fn log_warn(message: String) {
    logger::log("WARN".to_string(), "project".to_string(), message, None, None);
}

const SCENE_BACKUPS_KEPT: usize = 3;

fn files_identical(a: &Path, b: &Path) -> std::io::Result<bool> {
    use std::io::Read;

    let len = std::fs::metadata(a)?.len();
    if len != std::fs::metadata(b)?.len() {
        return Ok(false);
    }

    let mut fa = std::io::BufReader::new(std::fs::File::open(a)?);
    let mut fb = std::io::BufReader::new(std::fs::File::open(b)?);
    let mut buf_a = vec![0u8; 64 * 1024];
    let mut buf_b = vec![0u8; 64 * 1024];

    let mut remaining = len;
    while remaining > 0 {
        let n = remaining.min(buf_a.len() as u64) as usize;
        fa.read_exact(&mut buf_a[..n])?;
        fb.read_exact(&mut buf_b[..n])?;
        if buf_a[..n] != buf_b[..n] {
            return Ok(false);
        }
        remaining -= n as u64;
    }
    Ok(true)
}

fn scene_backups(path: &Path, file_name: &str) -> Vec<PathBuf> {
    let Some(dir) = path.parent() else { return vec![] };
    let Ok(entries) = read_dir(dir) else { return vec![] };
    let prefix = format!("{file_name}.bak-");

    let mut backups: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .map(|n| n.to_string_lossy().starts_with(&prefix))
                .unwrap_or(false)
        })
        .collect();

    backups.sort(); // el sello de fecha ordena cronológicamente
    backups
}

fn resolve_in_assets(project_folder: &str, relative: &str) -> Result<PathBuf, String> {
    let rel = Path::new(relative);
    let mut has_name = false;

    for component in rel.components() {
        match component {
            Component::Normal(_) => has_name = true,
            Component::CurDir => {}
            _ => return Err(format!("Path escapes the assets folder: {relative}")),
        }
    }
    if !has_name {
        return Err("Empty asset path".to_string());
    }

    Ok(Path::new(project_folder).join("assets").join(rel))
}

fn is_same_entry(a: &Path, b: &Path) -> bool {
    matches!((a.canonicalize(), b.canonicalize()), (Ok(a), Ok(b)) if a == b)
}

fn ensure_destination_free(from: &Path, to: &Path) -> Result<(), String> {
    if to.exists() && !is_same_entry(from, to) {
        return Err(format!("asset_exists: {}", to.display()));
    }
    Ok(())
}

fn discard_partial_file(path: &Path) {
    if let Err(e) = std::fs::remove_file(path) {
        if e.kind() != std::io::ErrorKind::NotFound {
            log_warn(format!("Could not remove partial file {}: {e}", path.display()));
        }
    }
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

    let text = read_to_string(path)
        .map_err(|e| format!("Could not read project file: {e}"))?;
    let mut meta: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Project file is not valid JSON: {e}"))?;
    if !meta.is_object() {
        return Err("Project file is not a valid ZIRON project".to_string());
    }

    meta["last_opened"] = json!(Utc::now().to_rfc3339());
    match serde_json::to_string_pretty(&meta) {
        Ok(updated) => {
            if let Err(e) = write_atomic(path, updated.as_bytes()) {
                log_warn(format!("Could not update last_opened: {e}"));
            }
        }
        Err(e) => log_warn(format!("Could not serialize project metadata: {e}")),
    }

    let folder = path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or("Project file has no parent folder")?;
    let name = meta["name"].as_str().unwrap_or("Unknown").to_string();

    if let Err(e) = add_recent(&app, RecentProject {
        name,
        path: project_file.clone(),
        last_opened: meta["last_opened"].as_str().unwrap_or("").to_string(),
    }) {
        log_warn(format!("Could not update recent projects: {e}"));
    }

    let mut result = meta;
    result["_folder"] = json!(folder);
    result["_project_file"] = json!(project_file);
    Ok(result)
}

/// Guarda la escena activa
#[tauri::command]
pub fn save_scene(scene_path: String, scene_data: Value) -> Result<(), String> {
    if !scene_data.get("entities").map_or(false, Value::is_array) {
        return Err("Refusing to save: scene data has no entity list".to_string());
    }

    let path = Path::new(&scene_path);
    if let Some(parent) = path.parent() {
        create_dir_all(parent)
            .map_err(|e| format!("Could not create {}: {e}", parent.display()))?;
    }
    let text = serde_json::to_string_pretty(&scene_data).map_err(|e| e.to_string())?;

    write_atomic(path, text.as_bytes())
}

/// Carga una escena dado su path absoluto
#[tauri::command]
pub fn load_scene(scene_path: String) -> Result<Value, String> {
    let path = Path::new(&scene_path);
    if !path.exists() {
        return Err(format!("scene_not_found: {scene_path}"));
    }

    let text = read_to_string(path)
        .map_err(|e| format!("Could not read scene {scene_path}: {e}"))?;

    let scene: Value = serde_json::from_str(&text).map_err(|e| {
        format!("scene_corrupt: {scene_path} is not valid JSON ({e}). The file was left untouched; backups (*.bak-*) may exist next to it.")
    })?;

    if !scene.is_object() {
        return Err(format!(
            "scene_corrupt: {scene_path} is not a scene (root is not an object). The file was left untouched."
        ));
    }

    Ok(scene)
}

#[tauri::command]
pub fn backup_scene(scene_path: String) -> Result<String, String> {
    let path = Path::new(&scene_path);
    if !path.is_file() {
        return Err(format!("Scene not found: {scene_path}"));
    }
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or("Invalid scene path")?;

    let existing = scene_backups(path, &file_name);
    if let Some(latest) = existing.last() {
        if files_identical(path, latest).unwrap_or(false) {
            return Ok(latest.to_string_lossy().to_string());
        }
    }

    let stamp = Utc::now().format("%Y%m%d-%H%M%S");
    let backup = path.with_file_name(format!("{file_name}.bak-{stamp}"));
    std::fs::copy(path, &backup)
        .map_err(|e| format!("Could not back up scene {}: {e}", path.display()))?;

    let mut all = scene_backups(path, &file_name);
    while all.len() > SCENE_BACKUPS_KEPT {
        let old = all.remove(0);
        if let Err(e) = std::fs::remove_file(&old) {
            log_warn(format!("Could not remove old backup {}: {e}", old.display()));
        }
    }

    Ok(backup.to_string_lossy().to_string())
}

/// Actualiza la versión de Ziron en el .ziron.project (usado para actualizar proyectos antiguos)
#[tauri::command]
pub fn update_project_version(project_file: String, new_version: String) -> Result<(), String> {
    let path = Path::new(&project_file);
    let text = read_to_string(path)
        .map_err(|e| format!("Could not read project file: {e}"))?;
    let mut meta: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Project file is not valid JSON: {e}"))?;
    if !meta.is_object() {
        return Err("Project file is not a valid ZIRON project".to_string());
    }
    meta["ziron_version"] = json!(new_version);
    let updated = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    write_atomic(path, updated.as_bytes())
}

/// Revisa los argumentos de lanzamiento para ver si se abrió un proyecto directamente
#[tauri::command]
pub fn get_launch_project(state: tauri::State<LaunchProject>) -> Option<String> {
    state.0.clone()
}

/// Devuelve la lista de proyectos recientes
fn load_recents(path: &Path) -> Result<Vec<RecentProject>, String> {
    if !path.exists() {
        return Ok(vec![]);
    }
    let text = read_to_string(path)
        .map_err(|e| format!("Could not read recent projects: {e}"))?;

    match serde_json::from_str::<Vec<RecentProject>>(&text) {
        Ok(list) => Ok(list),
        Err(parse_err) => {
            let stamp = Utc::now().format("%Y%m%d-%H%M%S");
            let aside = path.with_file_name(format!("recent_projects.json.corrupt-{stamp}"));
            match rename(path, &aside) {
                Ok(()) => Err(format!(
                    "recent_projects_corrupt: the file is invalid ({parse_err}); moved to {}",
                    aside.display()
                )),
                Err(e) => Err(format!(
                    "recent_projects_corrupt: the file is invalid ({parse_err}) and could not be moved aside ({e})"
                )),
            }
        }
    }
}

#[tauri::command]
pub fn get_recent_projects(app: tauri::AppHandle) -> Result<Vec<RecentProject>, String> {
    let path = recents_path(&app)?;
    load_recents(&path)
}

#[tauri::command]
pub fn remove_recent_project(app: tauri::AppHandle, project_path: String) -> Result<(), String> {
    let path = recents_path(&app)?;
    if !path.exists() {
        return Ok(());
    }
    let mut list = load_recents(&path)?;
    let normalized = normalize_path(&project_path);
    list.retain(|r| normalize_path(&r.path) != normalized);
    let updated = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    write_atomic(&path, updated.as_bytes())
}

fn add_recent(app: &tauri::AppHandle, project: RecentProject) -> Result<(), String> {
    let path = recents_path(app)?;
    let mut list = load_recents(&path)?;

    let normalized_incoming = normalize_path(&project.path);
    list.retain(|r| normalize_path(&r.path) != normalized_incoming);
    list.insert(0, project);
    list.truncate(10);

    let text = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    write_atomic(&path, text.as_bytes())
}

/// Abre el diálogo nativo del sistema para elegir una carpeta
#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let picked = run_blocking(move || app.dialog().file().blocking_pick_folder()).await?;
    Ok(picked.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn pick_project_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let picked = run_blocking(move || {
        app.dialog()
            .file()
            .add_filter("ZIRON Project", &["ziron.project"])
            .blocking_pick_file()
    })
    .await?;
    Ok(picked.map(|p| p.to_string()))
}

// ── Interno ───────────────────────────────────────────────────────────────────

fn normalize_path(p: &str) -> String {
    Path::new(p)
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| p.replace('\\', "/").trim_end_matches('/').to_string())
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
    let path = resolve_in_assets(&project_folder, &folder_path)?;
    if path.exists() && !path.is_dir() {
        return Err(format!("asset_exists: {}", path.display()));
    }
    create_dir_all(&path)
        .map_err(|e| format!("Could not create folder {}: {e}", path.display()))
}

#[tauri::command]
pub fn delete_asset_folder(project_folder: String, folder_name: String) -> Result<(), String> {
    let path = resolve_in_assets(&project_folder, &folder_name)?;
    remove_dir_all(&path)
        .map_err(|e| format!("Could not delete folder {}: {e}", path.display()))
}

#[tauri::command]
pub fn rename_asset_folder(
    project_folder: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let from = resolve_in_assets(&project_folder, &old_name)?;
    let to = resolve_in_assets(&project_folder, &new_name)?;

    if !from.is_dir() {
        return Err(format!("Folder not found: {}", from.display()));
    }
    ensure_destination_free(&from, &to)?;

    rename(&from, &to)
        .map_err(|e| format!("Could not rename folder {}: {e}", from.display()))
}

fn copy_dir_recursive_renamed(src: &Path, dst: &Path) -> Result<(), String> {
    create_dir_all(dst).map_err(|e| format!("Could not create {}: {e}", dst.display()))?;

    for entry in read_dir(src).map_err(|e| format!("Could not read {}: {e}", src.display()))? {
        let entry =
            entry.map_err(|e| format!("Could not read an entry of {}: {e}", src.display()))?;
        let ft = entry
            .file_type()
            .map_err(|e| format!("Could not inspect {}: {e}", entry.path().display()))?;
        let src_path = entry.path();

        if ft.is_dir() {
            // Se mantiene tu comportamiento: las subcarpetas también llevan " Copy"
            let name = entry.file_name().to_string_lossy().to_string();
            copy_dir_recursive_renamed(&src_path, &dst.join(format!("{name} Copy")))?;
        } else {
            std::fs::copy(&src_path, dst.join(entry.file_name()))
                .map_err(|e| format!("Could not copy {}: {e}", src_path.display()))?;
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
    let from = resolve_in_assets(&project_folder, &source_path)?;
    let to = resolve_in_assets(&project_folder, &dest_path)?;

    if !from.is_dir() {
        return Err(format!("Folder not found: {}", from.display()));
    }
    if to.starts_with(&from) {
        return Err("Cannot copy a folder into itself".to_string());
    }
    if to.exists() {
        return Err(format!("asset_exists: {}", to.display()));
    }

    if let Err(e) = copy_dir_recursive_renamed(&from, &to) {
        if let Err(cleanup) = remove_dir_all(&to) {
            if cleanup.kind() != std::io::ErrorKind::NotFound {
                log_warn(format!("Could not remove partial copy {}: {cleanup}", to.display()));
            }
        }
        return Err(e);
    }
    Ok(())
}

/// SISTEMA PARA ASSETS PERO MODELOS Y ASSETS ESPECIFICOS | TAMBIEN IMAGENES DE TEXTURAS
#[tauri::command]
pub async fn pick_model_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let picked = run_blocking(move || {
        app.dialog()
            .file()
            .add_filter("3D Model", &["glb", "gltf", "obj", "fbx"])
            .blocking_pick_file()
    })
    .await?;
    Ok(picked.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn pick_texture_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let picked = run_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Image", &["png", "jpg", "jpeg", "webp"])
            .blocking_pick_files()
    })
    .await?;

    Ok(picked
        .map(|files| files.into_iter().map(|p| p.to_string()).collect())
        .unwrap_or_default())
}

fn unique_destination(dir: &Path, file_name: &std::ffi::OsStr) -> Result<PathBuf, String> {
    let first = dir.join(file_name);
    if !first.exists() {
        return Ok(first);
    }

    let original = Path::new(file_name);
    let stem = original
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = original
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    for n in 1..=999 {
        let candidate = dir.join(format!("{stem} ({n}){ext}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(format!("Too many assets named {}", file_name.to_string_lossy()))
}

#[tauri::command]
pub fn import_asset_file(
    project_folder: String,
    source_path: String,
    target_folder: String,
) -> Result<String, String> {
    let src = Path::new(&source_path);
    if !src.is_file() {
        return Err(format!("Source file not found: {source_path}"));
    }
    let file_name = src.file_name().ok_or("Invalid source path")?;

    let dest_dir = if target_folder.is_empty() {
        Path::new(&project_folder).join("assets")
    } else {
        resolve_in_assets(&project_folder, &target_folder)?
    };
    create_dir_all(&dest_dir)
        .map_err(|e| format!("Could not create {}: {e}", dest_dir.display()))?;

    let original_name = file_name.to_string_lossy().to_string();

    let dest = unique_destination(&dest_dir, file_name)?;
    let final_name = dest
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| original_name.clone());
    if final_name != original_name {
        log_warn(format!(
            "Asset name \"{original_name}\" is taken; importing it as \"{final_name}\""
        ));
    }

    if let Err(e) = std::fs::copy(src, &dest) {
        discard_partial_file(&dest); // el destino no existía antes de copiar
        return Err(format!("Could not import {}: {e}", src.display()));
    }
    Ok(final_name)
}

#[tauri::command]
pub fn delete_asset_file(project_folder: String, file_path: String) -> Result<(), String> {
    let path = resolve_in_assets(&project_folder, &file_path)?;
    std::fs::remove_file(&path)
        .map_err(|e| format!("Could not delete file {}: {e}", path.display()))
}

#[tauri::command]
pub fn rename_asset_file(
    project_folder: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let from = resolve_in_assets(&project_folder, &old_path)?;
    let to = resolve_in_assets(&project_folder, &new_path)?;

    if !from.is_file() {
        return Err(format!("File not found: {}", from.display()));
    }
    ensure_destination_free(&from, &to)?;

    rename(&from, &to).map_err(|e| format!("Could not rename {}: {e}", from.display()))
}

#[tauri::command]
pub fn copy_asset_file(
    project_folder: String,
    source_path: String,
    dest_path: String,
) -> Result<(), String> {
    let from = resolve_in_assets(&project_folder, &source_path)?;
    let to = resolve_in_assets(&project_folder, &dest_path)?;

    if !from.is_file() {
        return Err(format!("File not found: {}", from.display()));
    }
    if to.exists() {
        return Err(format!("asset_exists: {}", to.display()));
    }

    if let Err(e) = std::fs::copy(&from, &to) {
        discard_partial_file(&to);
        return Err(format!("Could not copy {}: {e}", from.display()));
    }
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