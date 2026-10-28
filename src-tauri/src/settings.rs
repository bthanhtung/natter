use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{
    menu::{CheckMenuItem, IsMenuItem, MenuItemKind, Submenu},
    window::Color,
    AppHandle, Manager, Runtime, Theme, WebviewWindow, Wry,
};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ThemeChoice {
    #[default]
    System,
    Light,
    Grey,
    Dark,
    HighContrast,
}

pub const THEMES: [(ThemeChoice, &str); 5] = [
    (ThemeChoice::System, "System"),
    (ThemeChoice::Light, "Light"),
    (ThemeChoice::Grey, "Grey"),
    (ThemeChoice::Dark, "Dark"),
    (ThemeChoice::HighContrast, "High Contrast"),
];

impl ThemeChoice {
    /// The id of this theme's Appearance menu item.
    pub fn menu_id(self) -> String {
        format!("theme:{}", self.name())
    }

    pub fn from_menu_id(id: &str) -> Option<Self> {
        let name = id.strip_prefix("theme:")?;
        serde_json::from_value(serde_json::Value::String(name.to_owned())).ok()
    }

    fn name(self) -> String {
        serde_json::to_value(self)
            .ok()
            .and_then(|value| value.as_str().map(str::to_owned))
            .unwrap_or_default()
    }

    /// The native window appearance; `None` follows the operating system.
    pub fn native(self) -> Option<Theme> {
        match self {
            Self::System => None,
            Self::Light | Self::HighContrast => Some(Theme::Light),
            Self::Grey | Self::Dark => Some(Theme::Dark),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub theme: ThemeChoice,
    pub do_not_disturb: bool,
    pub show_previews: bool,
    pub sounds: bool,
    pub close_to_tray: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: ThemeChoice::System,
            do_not_disturb: false,
            show_previews: true,
            sounds: true,
            close_to_tray: true,
        }
    }
}

pub struct SettingsStore {
    path: Option<PathBuf>,
    current: Mutex<Settings>,
}

fn parse(contents: &str) -> Settings {
    serde_json::from_str(contents).unwrap_or_default()
}

impl SettingsStore {
    pub fn load(app: &AppHandle) -> Self {
        let path = app
            .path()
            .app_config_dir()
            .ok()
            .map(|dir| dir.join("settings.json"));
        let current = path
            .as_ref()
            .and_then(|path| fs::read_to_string(path).ok())
            .map(|contents| parse(&contents))
            .unwrap_or_default();
        Self {
            path,
            current: Mutex::new(current),
        }
    }

    pub fn get(&self) -> Settings {
        self.current
            .lock()
            .map(|settings| settings.clone())
            .unwrap_or_default()
    }

    pub fn replace(&self, settings: Settings) -> Result<(), String> {
        if let Some(path) = &self.path {
            if let Some(dir) = path.parent() {
                fs::create_dir_all(dir).map_err(|_| "settings directory unavailable")?;
            }
            let json = serde_json::to_string_pretty(&settings)
                .map_err(|_| "settings are not serializable")?;
            let temp = path.with_extension("json.tmp");
            fs::write(&temp, json).map_err(|_| "settings could not be saved")?;
            fs::rename(&temp, path).map_err(|_| "settings could not be saved")?;
        }
        *self.current.lock().map_err(|_| "settings unavailable")? = settings;
        Ok(())
    }
}

/// Every Appearance menu item, in the menu bar and the tray, kept in step with the setting.
#[derive(Default)]
pub struct ThemeMenus(Mutex<Vec<CheckMenuItem<Wry>>>);

/// An "Appearance" submenu with one check item per theme.
pub fn appearance_menu<M: Manager<Wry>>(
    manager: &M,
    current: ThemeChoice,
) -> tauri::Result<Submenu<Wry>> {
    let mut items = Vec::new();
    for (theme, label) in THEMES {
        items.push(CheckMenuItem::with_id(
            manager,
            theme.menu_id(),
            label,
            true,
            theme == current,
            None::<&str>,
        )?);
    }
    let refs: Vec<&dyn IsMenuItem<Wry>> = items
        .iter()
        .map(|item| item as &dyn IsMenuItem<Wry>)
        .collect();
    let submenu = Submenu::with_items(manager, "Appearance", true, &refs)?;
    if let Some(menus) = manager.try_state::<ThemeMenus>() {
        if let Ok(mut all) = menus.0.lock() {
            all.extend(items);
        }
    }
    Ok(submenu)
}

fn sync_menus(app: &AppHandle, theme: ThemeChoice) {
    if let Some(menus) = app.try_state::<ThemeMenus>() {
        if let Ok(all) = menus.0.lock() {
            let id = theme.menu_id();
            for item in all.iter() {
                let _ = item.set_checked(item.id().as_ref() == id);
            }
        }
    }
}

/// Saves and applies a theme chosen from a menu.
pub fn set_theme(app: &AppHandle, theme: ThemeChoice) -> Result<(), String> {
    let store = app.state::<SettingsStore>();
    let mut settings = store.get();
    settings.theme = theme;
    store.replace(settings)?;
    apply_theme(app, theme);
    Ok(())
}

/// Finds a submenu of the default application menu by title, such as "View".
pub fn find_submenu<R: Runtime>(items: Vec<MenuItemKind<R>>, title: &str) -> Option<Submenu<R>> {
    items.into_iter().find_map(|item| match item {
        MenuItemKind::Submenu(submenu) if submenu.text().is_ok_and(|text| text == title) => {
            Some(submenu)
        }
        _ => None,
    })
}

/// The window background, which also fills the transparent macOS title bar above the page.
#[cfg_attr(target_os = "macos", allow(dead_code))]
fn chrome_color(theme: ThemeChoice, system_dark: bool) -> Color {
    match theme {
        ThemeChoice::Light | ThemeChoice::HighContrast => Color(255, 255, 255, 255),
        ThemeChoice::Grey => Color(36, 37, 38, 255),
        ThemeChoice::Dark => Color(0, 0, 0, 255),
        ThemeChoice::System if system_dark => Color(36, 37, 38, 255),
        ThemeChoice::System => Color(255, 255, 255, 255),
    }
}

/// Recolors the main window's chrome; call again when the system appearance changes.
/// On macOS the window is glass and its material follows the native theme instead.
pub fn apply_chrome(window: &WebviewWindow, theme: ThemeChoice) {
    #[cfg(not(target_os = "macos"))]
    {
        let system_dark = window.theme().is_ok_and(|theme| theme == Theme::Dark);
        let _ = window.set_background_color(Some(chrome_color(theme, system_dark)));
    }
    #[cfg(target_os = "macos")]
    let _ = (window, theme);
}

/// Applies the theme to every native window and restyles the Messenger page in place.
pub fn apply_theme(app: &AppHandle, theme: ThemeChoice) {
    sync_menus(app, theme);
    for window in app.webview_windows().values() {
        let _ = window.set_theme(theme.native());
    }
    if let Some(window) = app.get_webview_window("main") {
        apply_chrome(&window, theme);
        if let Ok(theme) = serde_json::to_string(&theme) {
            let _ = window.eval(format!(
                "window.__PM_APPLY_THEME__&&window.__PM_APPLY_THEME__({theme})"
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{chrome_color, parse, Settings, ThemeChoice};
    use tauri::window::Color;

    #[test]
    fn missing_or_invalid_fields_fall_back_to_defaults() {
        assert_eq!(parse("not json"), Settings::default());
        let settings = parse(r#"{"theme":"high_contrast","sounds":false}"#);
        assert_eq!(settings.theme, ThemeChoice::HighContrast);
        assert!(!settings.sounds);
        assert!(settings.show_previews && settings.close_to_tray);
    }

    #[test]
    fn menu_ids_round_trip() {
        for (theme, _) in super::THEMES {
            assert_eq!(ThemeChoice::from_menu_id(&theme.menu_id()), Some(theme));
        }
        assert_eq!(ThemeChoice::HighContrast.menu_id(), "theme:high_contrast");
        assert_eq!(ThemeChoice::from_menu_id("theme:purple"), None);
        assert_eq!(ThemeChoice::from_menu_id("preferences"), None);
    }

    #[test]
    fn system_chrome_follows_the_appearance() {
        assert_eq!(
            chrome_color(ThemeChoice::System, false),
            Color(255, 255, 255, 255)
        );
        assert_eq!(
            chrome_color(ThemeChoice::System, true),
            chrome_color(ThemeChoice::Grey, false)
        );
        assert_eq!(chrome_color(ThemeChoice::Dark, false), Color(0, 0, 0, 255));
    }

    #[test]
    fn serializes_for_the_preferences_page() {
        let json = serde_json::to_value(Settings::default()).expect("settings serialize");
        assert_eq!(json["theme"], "system");
        assert_eq!(json["doNotDisturb"], false);
        assert_eq!(json["closeToTray"], true);
    }
}
