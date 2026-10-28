use tauri::{webview::NewWindowResponse, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
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

fn external_new_window_url(url: &Url) -> Url {
    if matches!(url.scheme(), "http" | "https")
        && matches!(url.host_str(), Some("l.facebook.com" | "lm.facebook.com"))
        && url.path() == "/l.php"
    {
        if let Some((_, target)) = url.query_pairs().find(|(key, _)| key == "u") {
            if let Ok(target_url) = Url::parse(&target) {
                if matches!(target_url.scheme(), "http" | "https") {
                    return target_url;
                }
            }
        }
    }
    url.clone()
}

pub fn create(app: &tauri::App) -> tauri::Result<()> {
    let platform = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    };
    let script = format!(
        "window.__PM_PLATFORM__={};window.__PM_CSS__={};\n{INJECT_JS}",
        serde_json::to_string(platform).expect("static platform is JSON-serializable"),
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
    .user_agent(UA)
    .initialization_script(&script)
    .on_navigation(move |url| {
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

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.decorations(false);

    builder.build()?;
    Ok(())
}

pub fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::{allowed_host, allowed_navigation, external_new_window_url};

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
    fn new_window_rejects_non_http_target() {
        let redirect = url::Url::parse("https://l.facebook.com/l.php?u=javascript%3Aalert(1)")
            .expect("valid redirect URL");
        assert_eq!(external_new_window_url(&redirect), redirect);
    }
}
