//! Facebook allows calls in end-to-end encrypted chats only in Chromium-based browsers, so on
//! WebKit (macOS, Linux) a call button hands the chat to one of those.

#[cfg(not(target_os = "windows"))]
use std::process::Command;
use url::Url;

#[cfg(target_os = "macos")]
const CHROMIUM_APPS: [&str; 7] = [
    "Google Chrome",
    "Microsoft Edge",
    "Brave Browser",
    "Arc",
    "Chromium",
    "Vivaldi",
    "Opera",
];

#[cfg(target_os = "linux")]
const CHROMIUM_COMMANDS: [&str; 8] = [
    "google-chrome",
    "google-chrome-stable",
    "microsoft-edge",
    "microsoft-edge-stable",
    "brave-browser",
    "chromium",
    "chromium-browser",
    "vivaldi",
];

/// Only Facebook chat pages are handed over.
pub fn chat_url(url: &str) -> Option<Url> {
    let url = Url::parse(url).ok()?;
    let host = url.host_str()?;
    let facebook = host == "facebook.com" || host.ends_with(".facebook.com");
    (url.scheme() == "https" && facebook && url.path().starts_with("/messages")).then_some(url)
}

/// Opens the URL in an installed Chromium-based browser; `false` if none was found.
#[cfg(target_os = "macos")]
pub fn open_in_chromium(url: &Url) -> bool {
    let home = std::env::var_os("HOME").map(std::path::PathBuf::from);
    CHROMIUM_APPS.iter().any(|app| {
        let bundle = format!("{app}.app");
        let installed = std::path::Path::new("/Applications").join(&bundle).exists()
            || home
                .as_ref()
                .is_some_and(|home| home.join("Applications").join(&bundle).exists());
        installed
            && Command::new("open")
                .args(["-a", app, url.as_str()])
                .status()
                .is_ok_and(|status| status.success())
    })
}

#[cfg(target_os = "linux")]
pub fn open_in_chromium(url: &Url) -> bool {
    CHROMIUM_COMMANDS
        .iter()
        .any(|command| Command::new(command).arg(url.as_str()).spawn().is_ok())
}

/// Windows uses the Chromium-based WebView2, where Facebook allows calls in the app itself.
#[cfg(target_os = "windows")]
pub fn open_in_chromium(_url: &Url) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::chat_url;

    #[test]
    fn only_facebook_chat_pages_are_handed_over() {
        assert!(chat_url("https://www.facebook.com/messages/e2ee/t/1").is_some());
        for url in [
            "http://www.facebook.com/messages/t/1",
            "https://www.facebook.com/profile.php?id=1",
            "https://facebook.com.evil.io/messages/t/1",
            "file:///etc/passwd",
            "not a url",
        ] {
            assert!(chat_url(url).is_none(), "{url}");
        }
    }
}
