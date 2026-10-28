use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
#[cfg(target_os = "windows")]
use tauri::image::Image;
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

use crate::settings::{Settings, SettingsStore, ThemeChoice};

#[cfg(target_os = "macos")]
const SOUND: &str = "Pop";
#[cfg(target_os = "windows")]
const SOUND: &str = "IM";
#[cfg(target_os = "linux")]
const SOUND: &str = "message-new-instant";

pub struct AppState {
    unread: AtomicU32,
    notifications: Mutex<NotificationState>,
}

#[derive(Default)]
struct NotificationState {
    recent: HashMap<String, Instant>,
    global: Vec<Instant>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            unread: AtomicU32::new(0),
            notifications: Mutex::new(NotificationState::default()),
        }
    }
}

fn sanitize(input: &str, limit: usize) -> String {
    input
        .chars()
        .filter(|character| !character.is_control())
        .take(limit)
        .collect::<String>()
        .trim()
        .to_owned()
}

impl NotificationState {
    fn allow(&mut self, title: &str, now: Instant) -> bool {
        self.recent
            .retain(|_, time| now.duration_since(*time) < Duration::from_secs(3));
        self.global
            .retain(|time| now.duration_since(*time) < Duration::from_secs(10));
        if self.recent.contains_key(title) || self.global.len() >= 10 {
            return false;
        }
        self.recent.insert(title.to_owned(), now);
        self.global.push(now);
        true
    }
}

#[tauri::command]
pub fn set_unread(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    count: u32,
) -> Result<(), String> {
    let count = count.min(9999);
    if state.unread.swap(count, Ordering::Relaxed) == count {
        return Ok(());
    }
    let window = app
        .get_webview_window("main")
        .ok_or("main window unavailable")?;
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let _ = window.set_badge_count((count > 0).then_some(count as i64));
    #[cfg(target_os = "windows")]
    {
        let overlay = if count > 0 {
            Some(
                Image::from_bytes(include_bytes!("../icons/badge.png"))
                    .map_err(|_| "badge unavailable")?,
            )
        } else {
            None
        };
        let _ = window.set_overlay_icon(overlay);
    }
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_icon(Some(
            crate::tray::icon(count > 0).map_err(|_| "tray icon unavailable")?,
        ));
        #[cfg(any(target_os = "linux", target_os = "windows"))]
        let _ = tray.set_tooltip(Some(if count > 0 {
            format!("PureMessenger — {count} unread")
        } else {
            "PureMessenger".to_owned()
        }));
    }
    Ok(())
}

#[tauri::command]
pub fn notify(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    title: String,
    body: String,
) -> Result<(), String> {
    let settings = app.state::<SettingsStore>().get();
    let title = sanitize(&title, 64);
    if settings.do_not_disturb || title.is_empty() {
        return Ok(());
    }
    let body = if settings.show_previews {
        sanitize(&body, 256)
    } else {
        "New message".to_owned()
    };
    let mut notifications = state
        .notifications
        .lock()
        .map_err(|_| "notification unavailable")?;
    if !notifications.allow(&title, Instant::now()) {
        return Ok(());
    }
    drop(notifications);
    let builder = app.notification().builder().title(title).body(body);
    let builder = if settings.sounds {
        builder.sound(SOUND)
    } else {
        builder
    };
    builder
        .show()
        .map_err(|_| "notification unavailable".to_owned())
}

/// Opens a link the chat-only window will not show, such as a profile, in the default browser.
#[tauri::command]
pub fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let url = url::Url::parse(&url).map_err(|_| "invalid URL")?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("unsupported URL".to_owned());
    }
    let url = crate::window::external_new_window_url(&url);
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "browser unavailable".to_owned())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    #[serde(flatten)]
    settings: Settings,
    launch_at_login: bool,
}

fn preferences(app: &tauri::AppHandle) -> Preferences {
    Preferences {
        settings: app.state::<SettingsStore>().get(),
        launch_at_login: app.autolaunch().is_enabled().unwrap_or(false),
    }
}

#[tauri::command]
pub fn get_theme(store: tauri::State<'_, SettingsStore>) -> ThemeChoice {
    store.get().theme
}

#[tauri::command]
pub fn open_preferences(app: tauri::AppHandle) -> Result<(), String> {
    crate::window::show_preferences(&app).map_err(|_| "preferences unavailable".to_owned())
}

#[tauri::command]
pub fn get_preferences(app: tauri::AppHandle) -> Preferences {
    preferences(&app)
}

#[tauri::command]
pub fn set_preferences(
    app: tauri::AppHandle,
    store: tauri::State<'_, SettingsStore>,
    settings: Settings,
    launch_at_login: bool,
) -> Result<Preferences, String> {
    let previous = store.get();
    store.replace(settings.clone())?;
    if previous.theme != settings.theme {
        crate::settings::apply_theme(&app, settings.theme);
    }
    let autolaunch = app.autolaunch();
    if autolaunch.is_enabled().unwrap_or(false) != launch_at_login {
        if launch_at_login {
            autolaunch.enable()
        } else {
            autolaunch.disable()
        }
        .map_err(|_| "launch at login could not be changed")?;
    }
    Ok(preferences(&app))
}

#[cfg(test)]
mod tests {
    use super::{sanitize, NotificationState};
    use std::time::{Duration, Instant};

    #[test]
    fn truncates_on_character_boundaries() {
        assert_eq!(sanitize(" 🐱é\n💜 ", 3), "🐱é");
        assert_eq!(sanitize(&"💜".repeat(100), 64).chars().count(), 64);
    }

    #[test]
    fn per_title_and_global_limits() {
        let mut state = NotificationState::default();
        let now = Instant::now();
        assert!(state.allow("same", now));
        assert!(!state.allow("same", now + Duration::from_secs(2)));
        assert!(state.allow("same", now + Duration::from_secs(3)));
        for index in 0..8 {
            assert!(state.allow(&format!("title-{index}"), now + Duration::from_secs(3)));
        }
        assert!(!state.allow("overflow", now + Duration::from_secs(3)));
        assert!(state.allow("overflow", now + Duration::from_secs(11)));
    }
}
