# Pure Messenger

A chat-only desktop app for Facebook Messenger on macOS, Windows and Linux, in the spirit of the former Messenger desktop app (discontinued by Meta in December 2025).

Pure Messenger shows Meta's own Messenger page (`facebook.com/messages`) in a native window and restyles it. It does not use unofficial APIs, scrape or automate anything, and it is not affiliated with or endorsed by Meta.

> Tiếng Việt: xem [Hướng dẫn nhanh](#hướng-dẫn-nhanh-tiếng-việt) ở cuối trang.

## Two versions, two branches

| | **Pure Messenger** | **Pure Messenger Lite** |
|---|---|---|
| Branch | [`main`](https://github.com/bthanhtung/pure-messenger/tree/main) | [`main-lite`](https://github.com/bthanhtung/pure-messenger/tree/main-lite) |
| Engine | Chromium, via [Electron](https://www.electronjs.org) (`electron/`) | The system webview, via [Tauri](https://tauri.app) (`src-tauri/`): WebKit on macOS and Linux, WebView2 on Windows |
| Voice and video calls | Everywhere, in the app, including end-to-end encrypted chats | Windows only. On macOS and Linux Facebook turns calls in encrypted chats off for WebKit; the call buttons then open the chat in Chrome, Edge or Brave |
| Encrypted chats you have not opened yet | Up to date, as in Chrome | Can lag behind: Facebook's encryption worker runs at background priority in WebKit |
| App size | about 490 MB (universal macOS), 100–200 MB elsewhere | about 10 MB |
| Memory | like a Chrome tab | about 600 MB with a chat open, most of it Facebook's page |
| App id / data folder | `dev.personal.puremessenger.call` | `dev.personal.puremessenger` |

**Which one?** Take **Pure Messenger** if you make calls or want every chat up to date. Take **Pure Messenger Lite** if you want the smallest app and mostly text.

Both look and behave the same: they share the injected script and style (`src-tauri/inject`), the Preferences page (`dist/preferences.html`) and the icons, and every change to those is kept identical on both branches. They have different app ids and data folders, so they can be installed side by side, each with its own sign-in.

## Features

- **Chat only.** The window shows your chats, their media viewer and the sign-in steps, nothing else. Profiles, posts, groups and every other link open in your default browser, and Facebook's home feed is replaced by the chats.
- **Desktop look.** Full-height panes with no page scrollbars or Facebook header. On macOS the title bar blends into the window and the chat list and the conversation float as rounded panels, after Apple's macOS 26 design; an optional glass window can be turned on in Preferences.
- **Light on the page.** The app adds no work while you scroll, type or hover: themes are plain CSS, and the unread count runs only when Facebook retitles the page, at idle time.
- **Themes.** By default the app follows Facebook's own Dark mode setting (Off, On or Automatic). System, Light, Grey, Dark (true black) and High contrast override it, without a reload.
- **Unread badge** on the Dock or taskbar and in the menu bar or tray, counting unread conversations (not Facebook notifications).
- **Files, photos and GIFs.** Send them with the attach button, by dragging them onto the window or by pasting. Downloads go to your Downloads folder, with a notification when they finish.
- **Notifications** with Do not disturb, hidden previews and sound options.
- **Menu bar / tray app.** Closing the window keeps it running (optional), and chats stay real time while it is hidden. Open at login (optional). A second launch focuses the running window.
- **Sign-in checks stay in the app**, so captchas and Meta account steps verify the session you are signing in to.

## Download and install

Builds are attached to [GitHub Releases](https://github.com/bthanhtung/pure-messenger/releases), or to each run under [Actions](https://github.com/bthanhtung/pure-messenger/actions) (Artifacts section). File names start with `Pure Messenger` or `Pure Messenger Lite`.

| System | File | Install |
|---|---|---|
| macOS 13+ (Apple silicon and Intel) | `…universal.dmg` | Open it and drag the app to Applications. |
| Windows 10/11 (64-bit) | `…Setup….exe` or `…x64-setup.exe` (Lite also has `.msi`) | Run it. |
| Ubuntu / Debian (64-bit) | `….deb` | `sudo apt install ./<file>.deb` |
| Fedora (64-bit) | `….rpm` | `sudo dnf install ./<file>.rpm` |
| Other Linux (64-bit) | `….AppImage` | `chmod +x <file>.AppImage`, then run it. |

The builds are not code-signed, so the first launch shows a warning:

- **macOS:** open System Settings → Privacy & Security and click **Open Anyway** (or run `xattr -cr "/Applications/Pure Messenger.app"` once; use the Lite app's name for Lite).
- **Windows:** in the SmartScreen dialog click **More info** → **Run anyway**.
- **Linux:** an AppImage needs FUSE 2 (`libfuse2`, or `libfuse2t64` on Ubuntu 24.04). GNOME needs the AppIndicator extension to show the tray icon.

**First sign-in:** Facebook sees each install as a new device. Sign in, then enter your Messenger PIN when asked, so your encrypted chat history is restored.

## Using it

- **Preferences:** ⌘, on macOS (app menu), Ctrl+, on Windows and Linux, or the menu bar / tray menu.
- **Theme:** View → Appearance on macOS, or Appearance in the tray menu.
- **Sign out:** app menu → Sign Out… on macOS, Sign Out… in the tray menu, or Preferences → Account. You are asked to confirm.
- **Tray menu:** Show, Appearance, Preferences, Sign Out…, Quit. On Linux use the tray menu to show the window.
- **Calls:** use the call buttons in a chat's header. The first call asks for camera and microphone access.

| Preference | Effect |
|---|---|
| Theme | Match Facebook (default), System, Light, Grey, Dark, High contrast |
| Do not disturb | No desktop notifications |
| Show previews | Show message text in notifications, or only "New message" |
| Notification sounds | Play the system notification sound |
| Open at login | Start the app when you sign in to your computer |
| Keep running when closed | Closing the window hides it to the menu bar / tray instead of quitting |
| Glass effect (macOS) | Translucent window; uses more graphics power; applies after restarting the app |
| Sign out of Facebook | Removes the Facebook session from this computer (click twice to confirm) |

## Build it yourself

### 1. Get the code

```sh
git clone https://github.com/bthanhtung/pure-messenger.git
cd pure-messenger
git checkout main        # Pure Messenger (Chromium)
# or
git checkout main-lite   # Pure Messenger Lite (system webview)
```

Each system builds its own bundles: build on macOS for macOS, on Windows for Windows and on Linux for Linux (or use the GitHub Actions workflows below).

### 2a. Pure Messenger (branch `main`)

Requirements on every system: [Node.js](https://nodejs.org) 20 or later, with npm.

| System | Also needed |
|---|---|
| macOS 13+ | Nothing else. |
| Windows 10/11 | Nothing else (use PowerShell or Command Prompt). |
| Ubuntu / Debian | `sudo apt install rpm` only if you also want the `.rpm` |
| Fedora | `sudo dnf install rpm-build` only if you also want the `.rpm` |

```sh
cd electron
npm install
npm start          # run it from source
npm run build      # make the installers for this system, in electron/dist
```

| System | `npm run build` makes |
|---|---|
| macOS | `electron/dist/Pure Messenger-<version>-universal.dmg` (Apple silicon and Intel, ad-hoc signed). `npm run build -- --mac --arm64` builds for Apple silicon only, faster. |
| Windows | `electron/dist/Pure Messenger Setup <version>.exe` |
| Linux | `electron/dist/` `.AppImage`, `.deb` and `.rpm` |

`npm start` and `npm run build` first copy the shared files (`src-tauri/inject`, `dist/preferences.html`, the icons) into `electron/shared`. `PM_DEBUG=1 npm start` prints the injected script's state and page errors.

### 2b. Pure Messenger Lite (branch `main-lite`)

Requirements on every system: [Rust](https://rustup.rs) (stable, installed with rustup) and [Node.js](https://nodejs.org) 20 or later, with npm.

| System | Also needed |
|---|---|
| macOS 13+ | Xcode Command Line Tools: `xcode-select --install` |
| Windows 10/11 | [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++"; WebView2 (preinstalled on Windows 11) |
| Ubuntu / Debian | `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` |
| Fedora | `sudo dnf install webkit2gtk4.1-devel gcc-c++ curl wget file libxdo-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel rpm-build` |

```sh
npm install
npm run dev        # run it from source
npm test           # injected-script tests and Rust unit tests
npm run build      # make the installers for this system
```

Bundles are written to `src-tauri/target/release/bundle/`: `.app` and `.dmg` on macOS, `.exe` and `.msi` on Windows, `.deb`, `.rpm` and `.AppImage` on Linux. For one macOS build that runs on Apple silicon and Intel:

```sh
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

### 3. Build on GitHub instead

Both workflows run only when started by hand, to save Actions minutes (macOS runners count 10×): **Actions → workflow → Run workflow**, then pick the branch or a tag. Started on a `v*` tag, a run also attaches the installers to a draft GitHub Release.

| Workflow | Branch | Builds |
|---|---|---|
| [Build Chromium](.github/workflows/build-call.yml) | `main` | Pure Messenger for macOS (universal `.dmg`), Windows (`.exe`) and Linux (`.AppImage`, `.deb`, `.rpm`) |
| [Build Lite](.github/workflows/build.yml) | `main-lite` (or `main`) | Pure Messenger Lite for macOS (universal `.dmg`), Windows (`.exe`, `.msi`), Ubuntu (`.deb`, `.AppImage`) and Fedora (`.rpm`) |

Tags: `v<version>` for Pure Messenger on `main`, `v<version>-lite` for Pure Messenger Lite on `main-lite`.

## How it works

| Path | Role |
|---|---|
| `electron/main.js` | Pure Messenger: window, navigation rules (chat stays in, the rest goes to the browser), call windows, permissions, menu bar and tray, menus, notifications, settings. |
| `electron/preload.js` | Pure Messenger: gives the page the same `invoke` bridge as Lite and runs the injected script before Facebook's scripts. |
| `src-tauri/src/window.rs` | Lite: window, glass effect and title bar; navigation rules; call windows. |
| `src-tauri/src/commands.rs` | Lite: the native commands the page may call (unread badge, notifications, theme, Preferences, open in browser). |
| `src-tauri/src/settings.rs`, `tray.rs`, `browser.rs` | Lite: settings and Appearance menus, menu bar / tray, handing calls to a Chromium browser. |
| `src-tauri/inject/inject.js` | Both: runs in the Messenger page — themes, layout mode, link routing, unread count, notification bridge. |
| `src-tauri/inject/inject.css` | Both: layout, glass and theme styles. |
| `dist/preferences.html` | Both: the Preferences window. |
| `src-tauri/icons` | Both: app, menu bar and tray icons; SVG sources in `src-tauri/icons/source`. |

### Maintenance

Facebook changes its markup from time to time. Everything that depends on it is kept in one place:

- `SELECTORS`, `CHAT_PATH`/`AUTH_PATH` and `FB_MODE` in `src-tauri/inject/inject.js`;
- the theme color variables in `src-tauri/inject/inject.css`;
- the user agents: Pure Messenger presents Electron's own Chrome user agent without the Electron token (`electron/main.js`); Lite's `UA` strings are in `src-tauri/src/window.rs` (keep WebKit on a Safari fingerprint and WebView2 on Edge).

Themes read Facebook's own light and dark color variables from the page and apply the chosen set with CSS, so nothing watches the page's DOM for theme changes. Pane heights use viewport units, never percentages, which keeps WebKit's re-layout for each new message cheap.

When you change a shared file (`src-tauri/inject`, `dist/preferences.html`, `src-tauri/icons`, `README.md`), make the same change on both branches.

### Resource use

Lite, measured idle on macOS with a chat open: the app process uses about 26 MB of memory, 7 threads and no CPU. Nearly everything else is Facebook's own page: about 400 MB for Messenger and about 130 MB for Facebook's end-to-end encryption engine (a hidden `fbsbx.com/maw_proxy_page` frame and a SharedWorker), which is required for encrypted chats. The page keeps running while the window is hidden, so messages and notifications arrive in real time.

## Privacy and security

- The app stores no messages. Its only file is `settings.json`; the Facebook session lives in the app's own data folder. No cookies or session values are logged or sent anywhere.
- The Messenger page can call only a handful of app commands, checked against the window that sent them; only the bundled Preferences window can read or change preferences. In Lite these are scoped by Tauri capabilities to HTTPS Facebook origins.
- Other sites and non-chat Facebook pages open in the default browser; captchas and Meta account pages used by sign-in checks stay in the app.
- Camera, microphone and screen sharing are granted to Facebook pages for calls and voice clips; macOS asks once for camera and microphone access. Call windows have no access to the app commands.
- Pure Messenger turns off Chromium's Cast discovery and WebRTC's mDNS names, so macOS does not ask for Local Network access; calls connect through Facebook's servers.

## Known limitations

- **Lite only:** calls in end-to-end encrypted chats are not available on macOS and Linux. Facebook decides this on its servers for every WebKit browser, Safari included. Hovering a call button shows "This app can't make this call"; clicking it opens the chat in the first Chromium-based browser found (Chrome, Edge, Brave, Arc, Chromium, Vivaldi, Opera).
- **Lite only:** encrypted chats you have not opened since the app started can show older messages for a while (see the table above).
- Facebook does not accept `.zip` attachments on the web (any browser); other archive formats are not blocked by that check.
- Unread counting reads the chat list (unread rows are bold), so it covers the conversations Messenger has loaded, which are the most recent ones.
- Pure Messenger cannot use passkeys to sign in (Electron does not support them); use your password.
- Facebook markup changes can break selectors until they are updated (see [Maintenance](#maintenance)).

## License

[PolyForm Noncommercial 1.0.0](LICENSE). You may use, copy, modify and share Pure Messenger for any noncommercial purpose, such as personal use, study, or use by charities and educational institutions. Commercial use is not permitted. Keep the `Required Notice` line from the [LICENSE](LICENSE) file when you share it.

Messenger and Facebook are trademarks of Meta Platforms, Inc.

## Hướng dẫn nhanh (tiếng Việt)

**Hai phiên bản, hai nhánh:**

| | **Pure Messenger** (nhánh `main`) | **Pure Messenger Lite** (nhánh `main-lite`) |
|---|---|---|
| Nhân | Chromium (Electron) | WebView của hệ điều hành (Tauri) |
| Gọi thoại / video | Gọi được ở mọi đoạn chat, kể cả chat mã hóa | Chỉ Windows; trên macOS/Linux bấm gọi sẽ mở Chrome/Edge/Brave |
| Dung lượng | khoảng 490 MB (macOS) | khoảng 10 MB |

Hay gọi điện hoặc muốn mọi đoạn chat luôn mới nhất thì dùng **Pure Messenger**; cần nhẹ nhất, chủ yếu nhắn tin thì dùng **Lite**. Hai bản cài song song được, mỗi bản đăng nhập riêng.

**Cài đặt:** tải ở mục [Releases](https://github.com/bthanhtung/pure-messenger/releases).

- **macOS:** mở file `.dmg`, kéo app vào Applications. Lần đầu mở bị chặn thì vào System Settings → Privacy & Security, bấm **Open Anyway**.
- **Windows:** chạy file `.exe`. Nếu SmartScreen cảnh báo, bấm **More info** → **Run anyway**.
- **Ubuntu/Debian:** `sudo apt install ./<tên file>.deb`. **Fedora:** `sudo dnf install ./<tên file>.rpm`. **Linux khác:** `chmod +x <tên file>.AppImage` rồi mở.

**Sử dụng:**

- Đăng nhập Facebook trong app, rồi nhập mã PIN Messenger khi được hỏi để khôi phục lịch sử chat mã hóa. App không lưu tin nhắn.
- Cài đặt: ⌘, trên macOS hoặc menu ở thanh menu / khay hệ thống. Giao diện sáng/tối mặc định theo cài đặt Chế độ tối của Facebook; muốn ép sáng/tối thì chọn ở View → Appearance.
- Đăng xuất: menu app → Sign Out… hoặc Sign Out… trong menu ở khay hệ thống.
- Link profile, bài viết… mở bằng trình duyệt; app chỉ dùng để chat.

**Tự build từ mã nguồn:**

```sh
git clone https://github.com/bthanhtung/pure-messenger.git
cd pure-messenger

# Pure Messenger (Chromium): chỉ cần Node.js 20+
git checkout main
cd electron && npm install && npm run build      # file cài nằm ở electron/dist

# Pure Messenger Lite: cần Rust (rustup) + Node.js 20+ và thư viện hệ thống (xem mục 2b ở trên)
git checkout main-lite
npm install && npm run build                     # file cài nằm ở src-tauri/target/release/bundle
```

Build trên máy nào thì ra bản cho hệ điều hành đó (macOS, Windows hoặc Linux).

**Giấy phép:** được dùng, sửa và chia sẻ miễn phí cho mục đích phi thương mại. Không được dùng vào mục đích thương mại.
