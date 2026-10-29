use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicU32, Ordering},
        LazyLock, Mutex,
    },
};
use tauri::{
    webview::{
        DownloadEvent, NewWindowFeatures, NewWindowResponse, PermissionKind, PermissionResponse,
    },
    AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
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
        // Meta's account and sign-in pages, used by some sign-in and verification steps.
        "meta.com",
    ]
    .iter()
    .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

/// The challenge frames Facebook embeds during sign-in checks (reCAPTCHA, hCaptcha, Arkose).
/// The navigation handler sees every frame, so without this they would open in the browser,
/// away from the session being checked.
fn captcha(url: &Url) -> bool {
    let Some(host) = url.host_str() else {
        return false;
    };
    let under = |domain: &str| host == domain || host.ends_with(&format!(".{domain}"));
    ((matches!(host, "google.com" | "www.google.com") || under("recaptcha.net"))
        && url.path().starts_with("/recaptcha/"))
        || [
            "gstatic.com",
            "hcaptcha.com",
            "arkoselabs.com",
            "funcaptcha.com",
        ]
        .into_iter()
        .any(under)
}

fn allowed_navigation(url: &Url) -> bool {
    url.as_str() == "about:blank"
        || (url.scheme() == "https" && (url.host_str().is_some_and(allowed_host) || captcha(url)))
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

/// Facebook opens calls with `window.open` on its own call pages (or `about:blank` first); those
/// get an app window. Everything else that asks for a new window, such as an attachment, goes to
/// the browser.
fn opens_in_app(url: &Url) -> bool {
    if url.as_str() == "about:blank" {
        return true;
    }
    url.scheme() == "https"
        && url.path().to_ascii_lowercase().contains("call")
        && url.host_str().is_some_and(|host| {
            !matches!(host, "l.facebook.com" | "lm.facebook.com")
                && ["facebook.com", "messenger.com"]
                    .iter()
                    .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
        })
}

/// Where each running download is saved, to name it when it finishes.
static DOWNLOADS: LazyLock<Mutex<HashMap<String, PathBuf>>> = LazyLock::new(Default::default);

/// Attachments are saved to the Downloads folder (the webview picks a unique name there), with a
/// notification when they finish.
fn on_download<R: tauri::Runtime>(webview: tauri::Webview<R>, event: DownloadEvent<'_>) -> bool {
    match event {
        DownloadEvent::Requested { url, destination } => {
            if let Ok(mut downloads) = DOWNLOADS.lock() {
                downloads.insert(url.to_string(), destination.clone());
            }
        }
        DownloadEvent::Finished { url, success, .. } => {
            let path = DOWNLOADS
                .lock()
                .ok()
                .and_then(|mut downloads| downloads.remove(url.as_str()));
            let name = path
                .as_deref()
                .and_then(|path| path.file_name())
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default();
            crate::commands::notify_download(webview.app_handle(), &name, success);
        }
        _ => {}
    }
    true
}

/// Calls and voice clips need the camera, microphone and screen; nothing else is granted.
fn media_permission<R: tauri::Runtime>(
    _webview: tauri::Webview<R>,
    kind: PermissionKind,
) -> PermissionResponse {
    match kind {
        PermissionKind::Camera | PermissionKind::Microphone | PermissionKind::DisplayCapture => {
            PermissionResponse::Allow
        }
        _ => PermissionResponse::Default,
    }
}

fn open_externally(app: &AppHandle, url: &Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto") {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

static CALL_WINDOWS: AtomicU32 = AtomicU32::new(0);

/// A window for a call Facebook opens; the webview takes over the page's popup request.
fn call_window(app: &AppHandle, features: NewWindowFeatures) -> tauri::Result<WebviewWindow> {
    let label = format!("call-{}", CALL_WINDOWS.fetch_add(1, Ordering::Relaxed));
    let handle = app.clone();
    WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::External(Url::parse("about:blank").expect("static URL is valid")),
    )
    .title("Pure Messenger Lite")
    .inner_size(960.0, 640.0)
    .min_inner_size(400.0, 300.0)
    .theme(app.state::<SettingsStore>().get().theme.native())
    .user_agent(UA)
    .on_permission_request(media_permission)
    .on_navigation(move |url| {
        if allowed_navigation(url) {
            return true;
        }
        open_externally(&handle, &external_new_window_url(url));
        false
    })
    .window_features(features)
    .build()
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
    let settings = app.state::<SettingsStore>().get();
    let theme = settings.theme;
    let glass = cfg!(target_os = "macos") && settings.glass;
    crate::settings::set_glass_window(glass);
    let script = format!(
        "window.__PM_PLATFORM__={};window.__PM_THEME__={};window.__PM_GLASS__={glass};window.__PM_CSS__={};\n{INJECT_JS}",
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
    .title("Pure Messenger Lite")
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
    .on_permission_request(media_permission)
    .on_download(on_download)
    // Files dropped on the window go to Messenger's own drop zone, not to Tauri.
    .disable_drag_drop_handler()
    .on_new_window({
        let app_handle = app.handle().clone();
        move |url, features| {
            if opens_in_app(&url) {
                if let Ok(window) = call_window(&app_handle, features) {
                    return NewWindowResponse::Create { window };
                }
            }
            open_externally(&app_handle, &external_new_window_url(&url));
            NewWindowResponse::Deny
        }
    });

    // macOS: the title bar is overlaid on the page, like system apps (the injected style pads both
    // panes below the traffic lights), and the window is glass only when chosen. Elsewhere the
    // title bar is native.
    #[cfg(target_os = "macos")]
    let builder = {
        let builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true);
        if glass {
            builder.transparent(true).effects(glass_effects())
        } else {
            builder
        }
    };

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
fn glass_effects() -> tauri::utils::config::WindowEffectsConfig {
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
        WebviewUrl::App(
            if app.state::<SettingsStore>().get().glass {
                "preferences.html?glass"
            } else {
                "preferences.html"
            }
            .into(),
        ),
    )
    .title("Preferences")
    .inner_size(480.0, 820.0)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .theme(app.state::<SettingsStore>().get().theme.native());
    #[cfg(target_os = "macos")]
    let builder = {
        let builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true);
        if app.state::<SettingsStore>().get().glass {
            builder.transparent(true).effects(glass_effects())
        } else {
            builder
        }
    };
    builder.build()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        allowed_host, allowed_navigation, external_new_window_url, facebook_redirect_target,
        opens_in_app,
    };

    #[test]
    fn calls_open_in_app_and_other_new_windows_do_not() {
        for url in [
            "about:blank",
            "https://www.facebook.com/groupcall/ROOM:1/?call_id=2",
            "https://www.messenger.com/groupcall/ROOM:1/",
            "https://www.facebook.com/videocall/incall/?peer_id=1",
        ] {
            assert!(
                opens_in_app(&url::Url::parse(url).expect("valid URL")),
                "{url}"
            );
        }
        for url in [
            "https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com",
            "https://scontent.xx.fbcdn.net/v/photo.jpg",
            "https://www.facebook.com/messenger_attachments/?attachment_id=1",
            "https://www.facebook.com/profile.php?id=1",
            "http://www.facebook.com/groupcall/ROOM:1/",
            "https://facebook.com.evil.io/groupcall/",
            "https://example.com/",
        ] {
            assert!(
                !opens_in_app(&url::Url::parse(url).expect("valid URL")),
                "{url}"
            );
        }
    }

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
    fn sign_in_challenges_stay_in_the_app() {
        for url in [
            "https://www.google.com/recaptcha/api2/anchor?k=1",
            "https://www.google.com/recaptcha/enterprise/bframe?k=1",
            "https://www.recaptcha.net/recaptcha/api2/anchor",
            "https://www.gstatic.com/recaptcha/releases/x/recaptcha__en.js",
            "https://newassets.hcaptcha.com/captcha/v1/x/static/hcaptcha.html",
            "https://client-api.arkoselabs.com/fc/gc/?token=1",
            "https://auth.meta.com/",
            "https://accountscenter.meta.com/",
        ] {
            assert!(
                allowed_navigation(&url::Url::parse(url).expect("valid URL")),
                "{url}"
            );
        }
        for url in [
            "https://www.google.com/search?q=recaptcha",
            "https://google.com.evil.io/recaptcha/api2/anchor",
            "http://www.google.com/recaptcha/api2/anchor",
            "https://example.com/recaptcha/",
        ] {
            assert!(
                !allowed_navigation(&url::Url::parse(url).expect("valid URL")),
                "{url}"
            );
        }
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
