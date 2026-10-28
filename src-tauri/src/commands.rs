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
use tauri_plugin_notification::NotificationExt;

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
    let title = sanitize(&title, 64);
    if title.is_empty() {
        return Ok(());
    }
    let body = sanitize(&body, 256);
    let mut notifications = state
        .notifications
        .lock()
        .map_err(|_| "notification unavailable")?;
    if !notifications.allow(&title, Instant::now()) {
        return Ok(());
    }
    drop(notifications);
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|_| "notification unavailable".to_owned())
}

#[tauri::command]
pub fn window_control(app: tauri::AppHandle, action: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("main window unavailable")?;
    match action.as_str() {
        "minimize" => window.minimize(),
        "maximize" => {
            if window
                .is_maximized()
                .map_err(|_| "window operation failed")?
            {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "close" => window.hide(),
        _ => return Err("invalid action".to_owned()),
    }
    .map_err(|_| "window operation failed".to_owned())
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
