mod logger;
mod cursor;
mod config;
mod project;

use tauri::Manager;

struct LaunchProject(Option<String>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let project = args.windows(2)
                .find(|pair| pair[0] == "--project")
                .map(|pair| pair[1].clone());
            app.manage(LaunchProject(project));

            let window = app.get_webview_window("main").unwrap();

            // ── Aplicar config de ventana ──────────────────────────────────
            let cfg = config::read_config(&app.app_handle());
            let win_cfg = &cfg["window"];

            let maximized = win_cfg["maximized"].as_bool().unwrap_or(true);
            let width     = win_cfg["width"].as_f64().unwrap_or(800.0);
            let height    = win_cfg["height"].as_f64().unwrap_or(600.0);

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
                    let window = app_handle.get_webview_window("main").unwrap();
                    let is_maximized = window.is_maximized().unwrap_or(false);
                    
                    let (w, h) = if is_maximized {
                        // Guardar tamaño por defecto si está maximizado
                        (800.0, 600.0)
                    } else {
                        let size = window.inner_size().unwrap_or(
                            tauri::PhysicalSize { width: 800, height: 600 }
                        );
                        let scale = window.scale_factor().unwrap_or(1.0);
                        (size.width as f64 / scale, size.height as f64 / scale)
                    };

                    let mut current = config::read_config(&app_handle);
                    current["window"]["maximized"] = serde_json::json!(is_maximized);
                    current["window"]["width"]     = serde_json::json!(w);
                    current["window"]["height"]    = serde_json::json!(h);

                    let path = config::config_path(&app_handle).unwrap();
                    let text = serde_json::to_string_pretty(&current).unwrap();
                    let _ = std::fs::write(&path, text);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            logger::log,
            logger::init_logger,
            cursor::grab_cursor,
            cursor::release_cursor,
            cursor::recenter_cursor,
            config::load_config,
            config::save_config,
            project::create_project,
            project::load_project,
            project::save_scene,
            project::load_scene,
            project::get_recent_projects,
            project::remove_recent_project,
            project::pick_folder,
            project::pick_project_file,
            project::get_launch_project,
            project::update_project_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}