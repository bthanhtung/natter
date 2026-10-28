# PureMessenger

A small, chat-only desktop app for Facebook Messenger on macOS, Windows and Linux, in the spirit of the former Messenger desktop app (discontinued by Meta in December 2025).

PureMessenger shows Meta's own Messenger page (`facebook.com/messages`) in a native window and restyles it. It does not use unofficial APIs, scrape or automate anything, and it is not affiliated with or endorsed by Meta.

> Tiếng Việt: xem [Hướng dẫn nhanh](#hướng-dẫn-nhanh-tiếng-việt) ở cuối trang.

## Features

- **Chat only.** The window shows your chats, their media viewer and the sign-in steps, nothing else. Profiles, posts, groups and every other link open in your default browser, and Facebook's home feed is replaced by the chats.
- **Desktop look.** Full-height panes with no page scrollbars or Facebook header. On macOS the title bar blends into the window and the chat list floats as a rounded panel, after Apple's macOS 26 design. An optional glass window (Liquid Glass on macOS 26 and later, the translucent sidebar material earlier) can be turned on in Preferences.
- **Light and fast.** The app adds no work while you scroll, type or hover: themes are plain CSS, and the unread count runs only when Facebook retitles the page, at idle time.
- **Themes.** System, Light, Grey, Dark (true black) and High contrast, applied to the whole page and window without a reload.
- **Unread badge** on the Dock or taskbar and the tray, counting unread conversations (not Facebook notifications).
- **Files, photos and GIFs.** Send them with the attach button, by dragging them onto the window, or by pasting. Attachments you download are saved to your Downloads folder, with a notification when they finish.
- **Native notifications** with Do not disturb, hidden previews and sound options.
- **Voice and video calls** open in their own app window, with access to the camera, microphone and screen sharing, where Facebook allows calls in the browser engine. Where it does not (encrypted chats on macOS and Linux), the call buttons say so and a click continues the call in Chrome, Edge, Brave or another Chromium-based browser (see [Known limitations](#known-limitations)).
- **Tray app.** Closing the window keeps it running in the tray (optional). Open at login (optional). A second launch focuses the running window.

## Download and install

Builds are attached to [GitHub Releases](https://github.com/bthanhtung/pure-messenger/releases), or to each run under [Actions](https://github.com/bthanhtung/pure-messenger/actions) (Artifacts section).

| System | File | Install |
|---|---|---|
| macOS 13+ (Apple silicon and Intel) | `PureMessenger_<version>_universal.dmg` | Open it and drag PureMessenger to Applications. |
| Windows 10/11 (64-bit) | `PureMessenger_<version>_x64-setup.exe` | Run it. (`.msi` is also available.) |
| Ubuntu / Debian (64-bit) | `PureMessenger_<version>_amd64.deb` | `sudo apt install ./PureMessenger_*_amd64.deb` |
| Fedora (64-bit) | `PureMessenger-<version>-1.x86_64.rpm` | `sudo dnf install ./PureMessenger-*.x86_64.rpm` |
| Other Linux (64-bit) | `PureMessenger_<version>_amd64.AppImage` | `chmod +x PureMessenger_*.AppImage`, then run it. |

The builds are not code-signed, so the first launch shows a warning:

- **macOS:** open System Settings → Privacy & Security and click **Open Anyway**. (Alternatively, run `xattr -cr /Applications/PureMessenger.app` once.)
- **Windows:** in the SmartScreen dialog click **More info** → **Run anyway**.
- **Linux:** an AppImage needs FUSE 2 (`libfuse2`, or `libfuse2t64` on Ubuntu 24.04). GNOME needs the AppIndicator extension to show the tray icon.

## Using it

- Sign in with your Facebook account in the window. The session stays in the system webview's data folder on your computer.
- **Preferences:** ⌘, on macOS (PureMessenger menu), Ctrl+, on Windows and Linux, or the tray menu.
- **Theme:** View → Appearance on macOS, or Appearance in the tray menu.
- **Tray menu:** Show, Appearance, Preferences, Quit. On Linux use the tray menu to show the window; left-click does nothing there.

| Preference | Effect |
|---|---|
| Theme | System, Light, Grey, Dark, High contrast |
| Do not disturb | No desktop notifications |
| Show previews | Show message text in notifications, or only "New message" |
| Notification sounds | Play the system notification sound |
| Open at login | Start PureMessenger when you sign in to your computer |
| Keep running when closed | Closing the window hides it to the tray instead of quitting |
| Glass effect (macOS) | Translucent window; uses more graphics power; applies after restarting the app |
| Sign out of Facebook | Removes the Facebook session from this computer (click twice to confirm) |

## Build from source

Requirements: [Rust](https://rustup.rs) (stable), Node.js 20+ and npm, plus:

- **macOS 13+:** Xcode Command Line Tools.
- **Windows:** Visual Studio Build Tools with "Desktop development with C++"; WebView2 (preinstalled on Windows 11).
- **Debian/Ubuntu:** `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`
- **Fedora:** `sudo dnf install webkit2gtk4.1-devel gcc-c++ curl wget file libxdo-devel openssl-devel libayatana-appindicator-devel librsvg2-devel`

```sh
npm install
npm run dev     # run in development
npm test        # injected-script tests (Node) and Rust unit tests
npm run build   # release bundles for the current system
```

Bundles are written to `src-tauri/target/release/bundle/`. For one macOS build that runs on both Apple silicon and Intel:

```sh
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

Tauri cannot reliably cross-compile, so each system's bundles are built on that system. The [Build workflow](.github/workflows/build.yml) does this on GitHub Actions for macOS (universal `.dmg`), Windows (`.exe`, `.msi`), Ubuntu (`.deb`, `.AppImage`) and Fedora (`.rpm`, built in a Fedora container) on every push to `main`; pushing a `v*` tag also attaches the bundles to a draft GitHub Release.

## How it works

| Path | Role |
|---|---|
| `src-tauri/src/window.rs` | Creates the window, glass effect and title bar; routes navigation (chat stays in, the rest goes to the browser). |
| `src-tauri/src/commands.rs` | The few native commands the page may call: unread badge, notifications, theme, Preferences, open in browser. |
| `src-tauri/src/settings.rs` | Preferences stored as `settings.json` in the app config folder; theme and Appearance menus. |
| `src-tauri/src/tray.rs` | Tray icon and menu. |
| `src-tauri/inject/inject.js` | Runs in the Messenger page: themes, layout mode, link routing, unread count, notification bridge. |
| `src-tauri/inject/inject.css` | Layout, glass and theme styles. |
| `dist/preferences.html` | The Preferences window. |

### Maintenance

Facebook changes its markup from time to time. Everything that depends on it is kept in one place:

- `SELECTORS`, `CHAT_PATH`/`AUTH_PATH` and `FB_MODE` in `src-tauri/inject/inject.js`;
- the theme color variables in `src-tauri/inject/inject.css`;
- the browser `UA` strings in `src-tauri/src/window.rs` (keep WebKit on a Safari fingerprint and WebView2 on Edge).

Themes work by reading Facebook's own light and dark color variables from the page and applying the chosen set with CSS, so nothing watches the page's DOM for theme changes.

## Privacy and security

- PureMessenger stores no messages. Its only file is `settings.json`; the Facebook session lives in the system webview's data folder. No cookies or session values are logged or sent anywhere.
- The Messenger page can call only `core:window:allow-start-dragging`, `core:window:allow-internal-toggle-maximize` and six app commands (`set_unread`, `notify`, `get_theme`, `open_preferences`, `open_external`, which opens only http(s) URLs in the browser, and `call_in_browser`, which accepts only Facebook chat URLs). It cannot read or change other preferences; only the bundled Preferences window can.
- These permissions apply only to HTTPS Facebook origins. Other sites and non-chat Facebook pages open in the default browser.
- Camera, microphone and screen sharing are granted to Facebook pages for calls and voice clips; macOS asks once for camera and microphone access. Call windows have no access to the app commands.

## Known limitations

- **Calls in end-to-end encrypted chats are not available on macOS and Linux.** Facebook decides this on its servers for every WebKit-based browser, Safari included: the call buttons show "This browser doesn't support calls" even though the webview has the required WebRTC features. Windows uses the Chromium-based WebView2 and is not affected by this check. On macOS and Linux, hovering a call button shows "This app can't make this call" and clicking it opens the chat in the first Chromium-based browser found (Chrome, Edge, Brave, Arc, Chromium, Vivaldi, Opera), or in the default browser with a hint if there is none.
- Facebook does not accept `.zip` attachments on the web (any browser); other archive formats are not blocked by that check.
- Unread counting reads the chat list (unread rows are shown in bold), so it covers the conversations Messenger has loaded, which are the most recent ones.
- Clicking a notification does not bring the app forward (the notification plugin does not support it).
- Links that open a new window go to the default browser; only Facebook's own pages (calls) open in an app window.
- WebRTC calls on Linux (WebKitGTK) may be unreliable.
- Facebook markup changes can break selectors until they are updated (see [Maintenance](#maintenance)).

## License

[PolyForm Noncommercial 1.0.0](LICENSE). You may use, copy, modify and share PureMessenger for any noncommercial purpose, such as personal use, study, or use by charities and educational institutions. Commercial use is not permitted. Keep the `Required Notice` line from the [LICENSE](LICENSE) file when you share it.

Messenger and Facebook are trademarks of Meta Platforms, Inc.

## Hướng dẫn nhanh (tiếng Việt)

**Tải bản cài** ở mục [Releases](https://github.com/bthanhtung/pure-messenger/releases):

- **macOS:** tải file `.dmg`, mở ra rồi kéo PureMessenger vào Applications. Lần đầu mở bị chặn thì vào System Settings → Privacy & Security, bấm **Open Anyway**.
- **Windows:** tải file `..._x64-setup.exe` rồi chạy. Nếu SmartScreen cảnh báo, bấm **More info** → **Run anyway**.
- **Ubuntu/Debian:** tải file `.deb`, chạy `sudo apt install ./PureMessenger_*_amd64.deb`.
- **Fedora:** tải file `.rpm`, chạy `sudo dnf install ./PureMessenger-*.x86_64.rpm`.
- **Linux khác:** tải file `.AppImage`, chạy `chmod +x PureMessenger_*.AppImage` rồi mở.

**Sử dụng:**

- Đăng nhập Facebook trong cửa sổ app. App không lưu tin nhắn.
- Đổi giao diện sáng/tối: menu View → Appearance (macOS) hoặc menu ở khay hệ thống.
- Cài đặt (thông báo, tự mở khi khởi động máy…): ⌘, trên macOS, Ctrl+, trên Windows/Linux.
- Link profile, bài viết… sẽ mở bằng trình duyệt, app chỉ dùng để chat.

**Giấy phép:** được dùng, sửa và chia sẻ miễn phí cho mục đích phi thương mại. Không được dùng vào mục đích thương mại.
