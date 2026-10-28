# PureMessenger

## What it is

PureMessenger is a personal-use desktop wrapper around `https://www.facebook.com/messages/`. It is not affiliated with or endorsed by Meta. It does not scrape or automate Messenger.

## Features

- A focused Messenger window with close-to-tray behavior and a Show/Quit tray menu.
- Unread indicator on the tray and supported platform launcher, plus native notifications.
- External links open in the default browser; a second launch focuses the existing window.

## Prerequisites

- **macOS 13+:** Xcode Command Line Tools, Rust, Node.js 20+ and npm.
- **Windows:** MSVC Build Tools with “Desktop development with C++”, the WebView2 runtime (preinstalled on Windows 11), Rust, Node.js 20+ and npm.
- **Debian/Ubuntu:** Rust, Node.js 20+ and npm, plus `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`.
- **Fedora:** Rust, Node.js 20+ and npm, plus `webkit2gtk4.1-devel gcc-c++ curl wget file libxdo-devel openssl-devel libayatana-appindicator-devel librsvg2-devel` (package names may vary by release).

## Run and build

```sh
npm install
npm run dev
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

Update `SELECTORS` in `src-tauri/inject/inject.js` when Facebook changes its markup. Refresh the platform-specific `UA` constants in `src-tauri/src/window.rs` with stable browser versions, keeping WebKit on a Safari fingerprint and WebView2 on Edge.

## Security model

The remote page receives only `core:window:allow-start-dragging` and three application commands (`allow-set-unread`, `allow-notify`, `allow-window-control`). Its capability applies only to HTTPS Facebook origins; navigation to unrelated domains and new-window links are opened externally. The app does not store Messenger data itself; the session resides in the operating system webview data directory. No cookie or session values are logged.

## Manual test checklist

On each target OS, verify login, close-to-tray, tray Show and Quit, unread badge, native notifications, external links opening in the browser, and second launch focusing the existing window. On macOS additionally verify Dock reopen after closing the window. On Linux use the tray menu, not left-click, to show the window.
