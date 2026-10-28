# PureMessenger

## What it is

PureMessenger is a personal-use desktop wrapper around `https://www.facebook.com/messages/`. It is not affiliated with or endorsed by Meta. It does not scrape or automate Messenger.

## Features

- A focused Messenger window with close-to-tray behavior and a Show/Preferences/Quit tray menu. The title bar is native (transparent and theme-colored on macOS), so Messenger fills the window without page scrollbars.
- Unread indicator on the tray and supported platform launcher, plus native notifications.
- Chat only: the window shows Messenger (`/messages`, its media viewer) and sign-in steps. Profiles, posts, groups and every other link open in the default browser, and Facebook's home feed is replaced by the chats. A second launch focuses the existing window.
- On macOS the window is glass: Liquid Glass on macOS 26 and later, the translucent sidebar material on earlier releases, with the chat list showing through and the title bar overlaid on the page.
- Appearance (System, Light, Grey, Dark, High contrast) can be switched from View → Appearance on macOS or the tray menu.
- Preferences (⌘, on macOS from the app menu, Ctrl+, elsewhere, or the tray menu), modelled on the former Messenger desktop app: System, Light, Grey, Dark and High contrast themes; Do not disturb, notification previews and sounds; open at login; keep running in the tray when closed.

## Prerequisites

- **macOS 13+:** Xcode Command Line Tools, Rust, Node.js 20+ and npm.
- **Windows:** MSVC Build Tools with “Desktop development with C++”, the WebView2 runtime (preinstalled on Windows 11), Rust, Node.js 20+ and npm.
- **Debian/Ubuntu:** Rust, Node.js 20+ and npm, plus `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`.
- **Fedora:** Rust, Node.js 20+ and npm, plus `webkit2gtk4.1-devel gcc-c++ curl wget file libxdo-devel openssl-devel libayatana-appindicator-devel librsvg2-devel` (package names may vary by release).

## Run and build

```sh
npm install
npm run dev
npm test
npm run build
```

Release bundles are under `src-tauri/target/release/bundle`: macOS `.app`/`.dmg`, Windows `.msi`/NSIS `.exe`, and Linux `.deb`/`.AppImage`/`.rpm` as supported by the build host. For an unsigned macOS app, after reviewing and trusting the build, run `xattr -cr /Applications/PureMessenger.app`. On Windows, SmartScreen may offer “More info → Run anyway” for an unsigned app. GNOME users may need an AppIndicator extension for the tray.

## Known limitations

- Linux WebRTC calls may be unreliable in WebKitGTK.
- Clicking a desktop notification does not focus the app: the desktop notification plugin does not expose that behavior.
- Facebook markup changes may break the injected UI selectors.
- HTTP Messenger/Facebook links are not embedded; they open in the system browser instead.
- Links opening in a new tab go to the default browser instead of a new app window.

## Maintenance

Update `SELECTORS`, `CHAT_PATH`/`AUTH_PATH` and `FB_MODE` in `src-tauri/inject/inject.js`, and the theme color variables in `src-tauri/inject/inject.css`, when Facebook changes its markup. Refresh the platform-specific `UA` constants in `src-tauri/src/window.rs` with stable browser versions, keeping WebKit on a Safari fingerprint and WebView2 on Edge.

## Security model

The remote page receives only `core:window:allow-start-dragging` and five application commands (`allow-set-unread`, `allow-notify`, `allow-get-theme`, `allow-open-preferences`, `allow-open-external`, which opens only http(s) URLs in the default browser); it cannot read or change other preferences. Only the bundled Preferences window may call `get_preferences` and `set_preferences`. Settings are stored as `settings.json` in the application config directory. Its capability applies only to HTTPS Facebook origins; navigation to unrelated domains and new-window links are opened externally. The app does not store Messenger data itself; the session resides in the operating system webview data directory. No cookie or session values are logged.

## Manual test checklist

On each target OS, verify login, close-to-tray, tray Show and Quit, unread badge, native notifications, external links opening in the browser, second launch focusing the existing window, each theme, Preferences changes taking effect without a restart, and closing the window with "Keep running when closed" turned off. On macOS additionally verify Dock reopen after closing the window. On Linux use the tray menu, not left-click, to show the window.
