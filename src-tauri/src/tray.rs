use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

pub fn icon(unread: bool) -> Result<Image<'static>, tauri::Error> {
    let bytes = if unread {
        include_bytes!("../icons/tray-unread.png").as_slice()
    } else {
        include_bytes!("../icons/tray.png").as_slice()
    };
    Image::from_bytes(bytes)
}

pub fn create(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Pure Messenger Lite", true, None::<&str>)?;
    let preferences = MenuItem::with_id(app, "preferences", "Preferences…", true, None::<&str>)?;
    let appearance = crate::settings::appearance_menu(
        app,
        app.state::<crate::settings::SettingsStore>().get().theme,
    )?;
    let sign_out = MenuItem::with_id(app, "sign-out", "Sign Out…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &appearance,
            &preferences,
            &separator,
            &sign_out,
            &quit,
        ],
    )?;
    let builder = TrayIconBuilder::with_id("main")
        .icon(icon(false)?)
        .icon_as_template(false)
        .tooltip("Pure Messenger Lite")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => crate::window::show(app),
            "preferences" => {
                let _ = crate::window::show_preferences(app);
            }
            "sign-out" => crate::commands::confirm_sign_out(app),
            "quit" => crate::window::quit(app),
            id => {
                if let Some(theme) = crate::settings::ThemeChoice::from_menu_id(id) {
                    let _ = crate::settings::set_theme(app, theme);
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Linux AppIndicator does not emit left-click events; use its menu instead.
            #[cfg(not(target_os = "linux"))]
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    // A window hidden behind others is brought forward instead of hidden.
                    if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false)
                    {
                        let _ = window.hide();
                    } else {
                        crate::window::show(app);
                    }
                }
            }
            #[cfg(target_os = "linux")]
            let _ = (tray, event);
        });
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let builder = builder.show_menu_on_left_click(false);
    builder.build(app)?;
    Ok(())
}
