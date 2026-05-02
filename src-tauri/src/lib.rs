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
            let _ = window.maximize();
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}