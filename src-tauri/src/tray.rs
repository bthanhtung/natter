use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

pub fn icon(unread: bool) -> Result<Image<'static>, tauri::Error> {
    let bytes = if unread {
        include_bytes!("../icons/tray-unread.png").as_slice()
    } else {
        include_bytes!("../icons/tray.png").as_slice()
    };
    Image::from_bytes(bytes)
}

pub fn create(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show PureMessenger", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let builder = TrayIconBuilder::with_id("main")
        .icon(icon(false)?)
        .icon_as_template(false)
        .tooltip("PureMessenger")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => crate::window::show(app),
            "quit" => {
                let _ = app.save_window_state(StateFlags::all() - StateFlags::VISIBLE);
                app.exit(0);
            }
            _ => {}
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
                    if window.is_visible().unwrap_or(false) {
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
