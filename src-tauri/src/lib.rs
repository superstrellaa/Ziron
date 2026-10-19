mod logger;
mod cursor;
mod config;
mod project;
mod render;
mod util;

use tauri::Manager;

struct LaunchProject(Option<String>);

fn resolve_launch_path(raw: &str) -> Option<String> {
    let path = std::path::Path::new(raw);
    let abs = std::path::absolute(path).ok()?;

    if abs.exists() {
        return Some(abs.to_string_lossy().to_string());
    }
    if path.is_absolute() {
        return Some(raw.to_string());
    }

    logger::log(
        "WARN".to_string(),
        "launch".to_string(),
        format!("Ignoring launch argument that can't be resolved: {raw}"),
        None,
        None,
    );
    None
}

fn persist_window_state(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;

    let (w, h) = if is_maximized {
        (800.0, 600.0)
    } else {
        let size = window.inner_size().map_err(|e| e.to_string())?;
        let scale = window.scale_factor().map_err(|e| e.to_string())?;
        (size.width as f64 / scale, size.height as f64 / scale)
    };

    config::update_window_state(app, is_maximized, w, h)
}

#[tauri::command]
async fn save_window_state(app: tauri::AppHandle) -> Result<(), String> {
    persist_window_state(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_drpc::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();

            fn is_project_file(s: &str) -> bool {
                let lower = s.to_lowercase();
                lower.ends_with(".ziron.project") || lower.ends_with(".ziron.scene")
            }

            let project = args
                .windows(2)
                .find(|pair| pair[0] == "--project" && is_project_file(&pair[1]))
                .map(|pair| pair[1].clone())
                .or_else(|| {
                    args.iter()
                        .skip(1)
                        .find(|a| is_project_file(a))
                        .cloned()
                })
                .and_then(|p| resolve_launch_path(&p));

            app.manage(LaunchProject(project));

            let window = app
                .get_webview_window("main")
                .ok_or("Main window not found")?;

            // ── Aplicar config de ventana ──────────────────────────────────
            let cfg = config::read_config(&app.app_handle());
            let win_cfg = &cfg["window"];

            let maximized = win_cfg["maximized"].as_bool().unwrap_or(true);
            let width = win_cfg["width"].as_f64().unwrap_or(800.0);
            let height = win_cfg["height"].as_f64().unwrap_or(600.0);

            if maximized {
                let _ = window.maximize();
            } else {
                let _ = window.set_size(tauri::Size::Logical(
                    tauri::LogicalSize { width, height }
                ));
                let _ = window.center();
            }

            // ── Guardar estado al cerrar ───────────────────────────────────
            let app_handle = app.app_handle().clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    if let Err(e) = persist_window_state(&app_handle) {
                        logger::log(
                            "ERROR".to_string(),
                            "window".to_string(),
                            format!("Could not save window state on close: {e}"),
                            None,
                            None,
                        );
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_window_state,
            logger::log,
            logger::init_logger,
            cursor::start_fly,
            cursor::stop_fly,
            cursor::recenter_cursor,
            config::load_config,
            config::save_config,
            config::get_default_config,
            project::create_project,
            project::load_project,
            project::save_scene,
            project::load_scene,
            project::backup_scene,
            project::get_recent_projects,
            project::remove_recent_project,
            project::pick_folder,
            project::pick_project_file,
            project::get_launch_project,
            project::update_project_version,
            project::list_asset_tree,
            project::create_asset_folder,
            project::delete_asset_folder,
            project::rename_asset_folder,
            project::copy_asset_folder,
            project::pick_model_file,
            project::import_asset_file,
            project::delete_asset_file,
            project::rename_asset_file,
            project::copy_asset_file,
            project::list_assets_by_extension,
            project::pick_texture_files,
            render::save_render_png
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}