// Copies the files this build shares with the WebKit build into electron/shared before running
// or packaging: the injected script and style, the Preferences page and the tray and app icons.

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const out = path.join(__dirname, "shared");
const files = {
  "inject.js": "src-tauri/inject/inject.js",
  "inject.css": "src-tauri/inject/inject.css",
  "preferences.html": "dist/preferences.html",
  "icons/tray.png": "src-tauri/icons/tray.png",
  "icons/trayTemplate.png": "src-tauri/icons/trayTemplate.png",
  "icons/trayTemplate@2x.png": "src-tauri/icons/trayTemplate@2x.png",
  "icons/trayUnreadTemplate.png": "src-tauri/icons/trayUnreadTemplate.png",
  "icons/trayUnreadTemplate@2x.png": "src-tauri/icons/trayUnreadTemplate@2x.png",
  "icons/tray-unread.png": "src-tauri/icons/tray-unread.png",
  "icons/badge.png": "src-tauri/icons/badge.png"
};

fs.rmSync(out, { recursive: true, force: true });
for (const [to, from] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
  fs.copyFileSync(path.join(root, from), path.join(out, to));
}
