#[cfg(not(target_os = "macos"))]
use tauri::window::Color;
use tauri::{webview::NewWindowResponse, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use crate::settings::SettingsStore;
use url::Url;

const INJECT_JS: &str = include_str!("../inject/inject.js");
const CSS: &str = include_str!("../inject/inject.css");

// Refresh these with stable browser releases; WebKitGTK uses Safari/Mac rather than a Chrome fingerprint.
#[cfg(any(target_os = "macos", target_os = "linux"))]
const UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
#[cfg(target_os = "windows")]
const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";

fn allowed_host(host: &str) -> bool {
    [
        "facebook.com",
        "messenger.com",
        "fbcdn.net",
        "fbsbx.com",
        "facebook.net",
    ]
    .iter()
    .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

fn allowed_navigation(url: &Url) -> bool {
    url.as_str() == "about:blank"
        || (url.scheme() == "https" && url.host_str().is_some_and(allowed_host))
}

/// The destination of a Facebook link-shim redirect, when it is a web URL.
fn facebook_redirect_target(url: &Url) -> Option<Url> {
    if !(matches!(url.scheme(), "http" | "https")
        && matches!(url.host_str(), Some("l.facebook.com" | "lm.facebook.com"))
        && url.path() == "/l.php")
    {
        return None;
    }
    let (_, target) = url.query_pairs().find(|(key, _)| key == "u")?;
    Url::parse(&target)
        .ok()
        .filter(|target| matches!(target.scheme(), "http" | "https"))
}

pub(crate) fn external_new_window_url(url: &Url) -> Url {
    facebook_redirect_target(url).unwrap_or_else(|| url.clone())
}

pub fn create(app: &tauri::App) -> tauri::Result<()> {
    let platform = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    };
    let theme = app.state::<SettingsStore>().get().theme;
    let script = format!(
        "window.__PM_PLATFORM__={};window.__PM_THEME__={};window.__PM_CSS__={};\n{INJECT_JS}",
        serde_json::to_string(platform).expect("static platform is JSON-serializable"),
        serde_json::to_string(&theme).expect("theme is JSON-serializable"),
        serde_json::to_string(CSS).expect("static CSS is JSON-serializable")
    );
    let app_handle = app.handle().clone();
    let builder = WebviewWindowBuilder::new(
        app,
        "main",
        WebviewUrl::External(
            Url::parse("https://www.facebook.com/messages/")
                .expect("static Messenger URL is valid"),
        ),
    )
    .title("PureMessenger")
    .inner_size(1100.0, 760.0)
    .min_inner_size(480.0, 400.0)
    .theme(theme.native())
    .user_agent(UA)
    .initialization_script(&script)
    .on_navigation(move |url| {
        if let Some(target) = facebook_redirect_target(url) {
            let _ = app_handle.opener().open_url(target.as_str(), None::<&str>);
            return false;
        }
        if allowed_navigation(url) {
            return true;
        }
        if matches!(url.scheme(), "http" | "https" | "mailto") {
            let _ = app_handle.opener().open_url(url.as_str(), None::<&str>);
        }
        false
    })
    .on_new_window({
        let app_handle = app.handle().clone();
        move |url, _features| {
            if matches!(url.scheme(), "http" | "https" | "mailto") {
                let external_url = external_new_window_url(&url);
                let _ = app_handle
                    .opener()
                    .open_url(external_url.as_str(), None::<&str>);
            }
            NewWindowResponse::Deny
        }
    });

    // macOS: a glass window with the title bar overlaid on the page, like system apps; the
    // injected style pads both panes below the traffic lights. Elsewhere the title bar is native.
    #[cfg(target_os = "macos")]
    let builder = builder
        .transparent(true)
        .effects(glass())
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.background_color(Color(255, 255, 255, 255));

    let window = builder.build()?;
    crate::settings::apply_chrome(&window, theme);
    Ok(())
}

pub fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Liquid Glass on macOS 26 and later, the sidebar material on earlier releases.
#[cfg(target_os = "macos")]
fn glass() -> tauri::utils::config::WindowEffectsConfig {
    use tauri::window::{Effect, EffectState, EffectsBuilder};
    EffectsBuilder::new()
        .effect(Effect::LiquidGlassRegular)
        .effect(Effect::Sidebar)
        .state(EffectState::FollowsWindowActiveState)
        .build()
}

pub fn quit(app: &AppHandle) {
    let _ = app.save_window_state(StateFlags::all() - StateFlags::VISIBLE);
    app.exit(0);
}

/// Closing the main window hides it to the tray or quits, as chosen in Preferences.
pub fn close_main(app: &AppHandle) {
    if app.state::<SettingsStore>().get().close_to_tray {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
    } else {
        quit(app);
    }
}

pub fn show_preferences(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("preferences") {
        let _ = window.unminimize();
        window.show()?;
        return window.set_focus();
    }
    let builder = WebviewWindowBuilder::new(
        app,
        "preferences",
        WebviewUrl::App("preferences.html".into()),
    )
    .title("Preferences")
    .inner_size(480.0, 620.0)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .theme(app.state::<SettingsStore>().get().theme.native());
    #[cfg(target_os = "macos")]
    let builder = builder
        .transparent(true)
        .effects(glass())
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);
    builder.build()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        allowed_host, allowed_navigation, external_new_window_url, facebook_redirect_target,
    };

    #[test]
    fn exact_or_subdomain_only() {
        for host in [
            "www.facebook.com",
            "m.facebook.com",
            "scontent.xx.fbcdn.net",
        ] {
            assert!(allowed_host(host));
        }
        assert!(!allowed_host("facebook.com.evil.io"));
        assert!(!allowed_host("evilfacebook.com"));
    }

    #[test]
    fn only_https_is_embedded() {
        assert!(!allowed_navigation(
            &url::Url::parse("http://facebook.com").expect("valid URL")
        ));
        assert!(allowed_navigation(
            &url::Url::parse("https://facebook.com").expect("valid URL")
        ));
    }

    #[test]
    fn new_window_unwraps_facebook_redirects() {
        for scheme in ["http", "https"] {
            for host in ["l.facebook.com", "lm.facebook.com"] {
                let redirect = url::Url::parse(&format!(
                    "{scheme}://{host}/l.php?u=https%3A%2F%2Fexample.com%2Fpath%3Fa%3D1"
                ))
                .expect("valid redirect URL");
                assert_eq!(
                    external_new_window_url(&redirect).as_str(),
                    "https://example.com/path?a=1"
                );
            }
        }
    }

    #[test]
    fn new_window_without_target_keeps_redirect() {
        let redirect =
            url::Url::parse("https://l.facebook.com/l.php?other=1").expect("valid redirect URL");
        assert_eq!(external_new_window_url(&redirect), redirect);
    }

    #[test]
    fn in_page_redirects_resolve_only_for_the_link_shim() {
        let redirect =
            url::Url::parse("https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2F&h=x")
                .expect("valid redirect URL");
        assert_eq!(
            facebook_redirect_target(&redirect).map(String::from),
            Some("https://example.com/".to_owned())
        );
        for url in [
            "https://www.facebook.com/l.php?u=https%3A%2F%2Fexample.com",
            "https://l.facebook.com/other?u=https%3A%2F%2Fexample.com",
            "https://l.facebook.com/l.php?u=file%3A%2F%2F%2Fetc%2Fpasswd",
        ] {
            let url = url::Url::parse(url).expect("valid URL");
            assert_eq!(facebook_redirect_target(&url), None);
        }
    }

    #[test]
    fn new_window_rejects_non_http_target() {
        let redirect = url::Url::parse("https://l.facebook.com/l.php?u=javascript%3Aalert(1)")
            .expect("valid redirect URL");
        assert_eq!(external_new_window_url(&redirect), redirect);
    }
}
