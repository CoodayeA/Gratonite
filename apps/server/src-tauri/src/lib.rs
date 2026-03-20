mod docker;
mod config;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
};

#[tauri::command]
async fn check_docker() -> Result<bool, String> {
    docker::is_docker_running().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_status() -> Result<docker::InstanceStatus, String> {
    docker::get_instance_status().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_instance(app: tauri::AppHandle) -> Result<config::InstanceConfig, String> {
    // Generate config if first run
    let cfg = config::ensure_config().map_err(|e| e.to_string())?;

    // Pull images and start containers
    docker::start_instance(&app, &cfg).await.map_err(|e| e.to_string())?;

    Ok(cfg)
}

#[tauri::command]
async fn stop_instance() -> Result<(), String> {
    docker::stop_instance().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_config() -> Result<config::InstanceConfig, String> {
    config::load_config().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_logs(service: String, lines: u64) -> Result<Vec<String>, String> {
    docker::get_logs(&service, lines).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn pull_updates(app: tauri::AppHandle) -> Result<(), String> {
    docker::pull_images(&app).await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Build tray menu
            let open = MenuItemBuilder::with_id("open", "Open Gratonite").build(app)?;
            let start = MenuItemBuilder::with_id("start", "Start").build(app)?;
            let stop = MenuItemBuilder::with_id("stop", "Stop").build(app)?;
            let update = MenuItemBuilder::with_id("update", "Check for Updates").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&open)
                .separator()
                .item(&start)
                .item(&stop)
                .separator()
                .item(&update)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Gratonite Server")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "open" => {
                            let _ = tauri_plugin_opener::open_url("https://localhost:8443", None::<&str>);
                        }
                        "start" => {
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = docker::start_instance_quick(&app).await;
                            });
                        }
                        "stop" => {
                            tauri::async_runtime::spawn(async {
                                let _ = docker::stop_instance().await;
                            });
                        }
                        "update" => {
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = docker::pull_images(&app).await;
                            });
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_docker,
            get_status,
            start_instance,
            stop_instance,
            get_config,
            get_logs,
            pull_updates,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
