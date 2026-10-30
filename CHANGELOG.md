# Changelog

## 0.2.0 — unreleased

- **New name: Natter** (was Pure Messenger), "an unofficial desktop app for Facebook Messenger".
  The Chromium build is **Natter**, the system-webview build is **Natter Lite**.
- New app ids (`io.github.bthanhtung.natter`, `io.github.bthanhtung.natter.lite`). Natter moves your
  Pure Messenger session over on first launch; Natter Lite asks you to sign in once.
- **License: GPL-3.0** (was PolyForm Noncommercial).
- Both builds now live on the `main` branch.
- Lite: strict Content Security Policy for the app's own pages.
- Releases: a `.sha256` checksum and a signed build provenance attestation for every file.
- Contributor guide, issue forms, security policy and code of conduct.

## 0.1.0 – 0.1.4 — as Pure Messenger

- Chat-only window for `facebook.com/messages` with a desktop look, macOS glass and six themes.
- Unread badge, notifications with Do not disturb, menu bar / tray, open at login.
- Drag-and-drop and paste attachments; downloads to the Downloads folder.
- Sign-in captchas and Meta account checks stay in the app; other links open in the browser.
- 0.1.4 added the Chromium build, which can call in end-to-end encrypted chats.
