mod browser;
mod commands;
mod settings;
mod tray;
mod window;

use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::StateFlags;

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            window::show(app)
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .with_denylist(&["preferences"])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .manage(commands::AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::set_unread,
            commands::notify,
            commands::get_theme,
            commands::open_preferences,
            commands::open_external,
            commands::call_in_browser,
            commands::get_preferences,
            commands::sign_out,
            commands::set_preferences
        ])
        .setup(|app| {
            app.manage(settings::SettingsStore::load(app.handle()));
            app.manage(settings::ThemeMenus::default());
            #[cfg(target_os = "macos")]
            app_menu(app)?;
            window::create(app)?;
            tray::create(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    window::close_main(window.app_handle());
                }
                WindowEvent::ThemeChanged(_) => {
                    let app = window.app_handle();
                    if let Some(main) = app.get_webview_window("main") {
                        settings::apply_chrome(
                            &main,
                            app.state::<settings::SettingsStore>().get().theme,
                        );
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to start PureMessenger");
    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = event {
            window::show(app);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}

/// Adds "Preferences…" (⌘,) and "Sign Out…" below "About" and an Appearance submenu to View in the default
/// macOS application menu.
#[cfg(target_os = "macos")]
fn app_menu(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, MenuItemKind, PredefinedMenuItem};

    let menu = Menu::default(app.handle())?;
    if let Some(MenuItemKind::Submenu(app_submenu)) = menu.items()?.first() {
        let preferences = MenuItem::with_id(
            app,
            "app-preferences",
            "Preferences…",
            true,
            Some("CmdOrCtrl+,"),
        )?;
        let sign_out = MenuItem::with_id(app, "app-sign-out", "Sign Out…", true, None::<&str>)?;
        app_submenu.insert(&PredefinedMenuItem::separator(app)?, 1)?;
        app_submenu.insert(&preferences, 2)?;
        app_submenu.insert(&sign_out, 3)?;
    }
    if let Some(view) = settings::find_submenu(menu.items()?, "View") {
        let theme = app.state::<settings::SettingsStore>().get().theme;
        view.prepend(&settings::appearance_menu(app, theme)?)?;
    }
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| match event.id().as_ref() {
        "app-sign-out" => commands::confirm_sign_out(app),
        "app-preferences" => {
            let _ = window::show_preferences(app);
        }
        id => {
            if let Some(theme) = settings::ThemeChoice::from_menu_id(id) {
                let _ = settings::set_theme(app, theme);
            }
        }
    });
    Ok(())
}
