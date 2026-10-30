// The Chromium (Electron) build of Natter. Facebook allows calls in
// end-to-end encrypted chats only in Chromium-based browsers, so this build can call where the
// WebKit build (src-tauri) cannot. It reuses that build's injected script and style
// (src-tauri/inject) and its Preferences page (dist/preferences.html).

"use strict";

const {
  app, BrowserWindow, Menu, Tray, Notification, nativeImage, nativeTheme, shell, session,
  ipcMain, dialog, systemPreferences, desktopCapturer
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const CHAT_URL = "https://www.facebook.com/messages/";
const PLATFORM = process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux";
const SHARED = path.join(__dirname, "shared");
const read = name => fs.readFileSync(path.join(SHARED, name), "utf8");

// --- Settings (same file format as the WebKit build) ----------------------------------------

const THEMES = [
  ["facebook", "Match Facebook"], ["system", "System"], ["light", "Light"],
  ["grey", "Grey"], ["dark", "Dark"], ["high_contrast", "High Contrast"]
];
const DEFAULTS = {
  theme: "facebook", doNotDisturb: false, showPreviews: true, sounds: true,
  closeToTray: true, glass: false, version: 1
};
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    const settings = { ...DEFAULTS, ...saved };
    if (!THEMES.some(([name]) => name === settings.theme)) settings.theme = DEFAULTS.theme;
    return settings;
  } catch (_) {
    return { ...DEFAULTS };
  }
}

let settings;

function saveSettings(next) {
  settings = { ...DEFAULTS, ...next, version: 1 };
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(settings, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}

// --- Navigation rules (as in src-tauri/src/window.rs) ---------------------------------------

const ALLOWED_HOSTS = ["facebook.com", "messenger.com", "fbcdn.net", "fbsbx.com", "facebook.net", "meta.com"];
const under = (host, domain) => host === domain || host.endsWith(`.${domain}`);

function parse(url) {
  try {
    return new URL(url);
  } catch (_) {
    return null;
  }
}

// The destination of a Facebook link-shim redirect, when it is a web URL.
function redirectTarget(url) {
  if (!/^https?:$/.test(url.protocol) || !["l.facebook.com", "lm.facebook.com"].includes(url.hostname) || url.pathname !== "/l.php") return null;
  const target = parse(url.searchParams.get("u") || "");
  return target && /^https?:$/.test(target.protocol) ? target : null;
}

// Only top-level navigations reach this; frames (captchas, the encryption frame) load freely.
const allowedNavigation = url =>
  url.href === "about:blank" || (url.protocol === "https:" && ALLOWED_HOSTS.some(domain => under(url.hostname, domain)));

// Calls are Facebook pages opened with window.open (or about:blank first); they get an app window.
const opensInApp = url =>
  url.href === "about:blank" ||
  (url.protocol === "https:" && /call/i.test(url.pathname) &&
    !["l.facebook.com", "lm.facebook.com"].includes(url.hostname) &&
    ["facebook.com", "messenger.com"].some(domain => under(url.hostname, domain)));

function openExternally(href) {
  const url = parse(href);
  if (!url || !/^(https?|mailto):$/.test(url.protocol)) return;
  shell.openExternal((redirectTarget(url) || url).href);
}

function guardNavigation(contents) {
  contents.on("will-navigate", (event, href) => {
    const url = parse(href);
    if (!url) return event.preventDefault();
    const target = redirectTarget(url);
    if (target) {
      event.preventDefault();
      shell.openExternal(target.href);
    } else if (!allowedNavigation(url)) {
      event.preventDefault();
      openExternally(href);
    }
  });
  contents.setWindowOpenHandler(({ url: href }) => {
    const url = parse(href);
    if (url && opensInApp(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 960, height: 640, minWidth: 400, minHeight: 300, title: app.getName(),
          autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true }
        }
      };
    }
    openExternally(href);
    return { action: "deny" };
  });
  contents.on("did-create-window", child => guardNavigation(child.webContents));
}

// --- Main window ------------------------------------------------------------------------------

let mainWindow;
let preferencesWindow;
let tray;
let quitting = false;
const statePath = () => path.join(app.getPath("userData"), "window-state.json");

function chromeColor() {
  const dark = settings.theme === "grey" || settings.theme === "dark" ||
    ((settings.theme === "system" || settings.theme === "facebook") && nativeTheme.shouldUseDarkColors);
  return settings.theme === "dark" ? "#000000" : dark ? "#242526" : "#ffffff";
}

function bootScript() {
  // Chromium handles the drag strip with -webkit-app-region instead of data-tauri-drag-region.
  const css = read("inject.css") + "\n#pm-drag { -webkit-app-region: drag; }\n";
  const globals = {
    __PM_PLATFORM__: PLATFORM, __PM_THEME__: settings.theme,
    __PM_GLASS__: PLATFORM === "macos" && settings.glass, __PM_CALLS__: true, __PM_CSS__: css
  };
  return Object.entries(globals).map(([key, value]) => `window.${key}=${JSON.stringify(value)};`).join("") + "\n" + read("inject.js");
}

function createMainWindow() {
  let bounds = {};
  try {
    bounds = JSON.parse(fs.readFileSync(statePath(), "utf8"));
  } catch (_) {}
  const glass = PLATFORM === "macos" && settings.glass;
  mainWindow = new BrowserWindow({
    width: bounds.width || 1100, height: bounds.height || 760, x: bounds.x, y: bounds.y,
    minWidth: 480, minHeight: 400, title: app.getName(), show: false,
    backgroundColor: glass ? "#00000000" : chromeColor(),
    ...(PLATFORM === "macos" ? { titleBarStyle: "hidden", ...(glass ? { vibrancy: "sidebar", visualEffectState: "followWindow" } : {}) } : {}),
    autoHideMenuBar: PLATFORM !== "macos",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, spellcheck: true,
      // Keep the page running at full speed while hidden in the tray, so chats stay real time.
      backgroundThrottling: false
    }
  });
  if (bounds.maximized) mainWindow.maximize();
  guardNavigation(mainWindow.webContents);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", event => {
    saveWindowState();
    if (quitting) return;
    event.preventDefault();
    if (settings.closeToTray) mainWindow.hide();
    else quit();
  });
  if (process.env.NATTER_DEBUG) {
    mainWindow.webContents.on("console-message", event => {
      if (event.level === "error") console.log(`[page error] ${String(event.message).slice(0, 160)}`);
    });
    mainWindow.webContents.on("did-finish-load", async () => {
      const state = await mainWindow.webContents.executeJavaScript(
        "JSON.stringify({ url: location.href, init: window.__PM_INIT__, classes: document.documentElement.className, style: !!document.getElementById('pm-style'), drag: !!document.getElementById('pm-drag'), ua: navigator.userAgent, notification: String(window.Notification).slice(0, 30) })"
      ).catch(error => String(error));
      console.log(`[debug] ${state}`);
    });
  }
  mainWindow.loadURL(CHAT_URL);
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const state = { ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() };
  try {
    fs.writeFileSync(statePath(), JSON.stringify(state));
  } catch (_) {}
}

function showMain() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function quit() {
  quitting = true;
  app.quit();
}

// --- Theme ------------------------------------------------------------------------------------

function applyTheme(theme) {
  nativeTheme.themeSource = theme === "light" || theme === "high_contrast" ? "light"
    : theme === "grey" || theme === "dark" ? "dark" : "system";
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!(PLATFORM === "macos" && settings.glass)) mainWindow.setBackgroundColor(chromeColor());
    mainWindow.webContents.executeJavaScript(`window.__PM_APPLY_THEME__&&window.__PM_APPLY_THEME__(${JSON.stringify(theme)})`).catch(() => {});
  }
  buildMenus();
}

function setTheme(theme) {
  saveSettings({ ...settings, theme });
  applyTheme(theme);
}

// --- Unread badge, notifications --------------------------------------------------------------

const icon = name => nativeImage.createFromPath(path.join(SHARED, "icons", name));

// The macOS menu bar takes monochrome template images (with @2x siblings) that the system tints
// for light and dark menu bars; other trays get the colour icon.
function trayIcon(unread) {
  if (PLATFORM !== "macos") return icon(unread ? "tray-unread.png" : "tray.png");
  const image = icon(unread ? "trayUnreadTemplate.png" : "trayTemplate.png");
  image.setTemplateImage(true);
  return image;
}
let unread = 0;

function setUnread(count) {
  count = Math.min(Math.max(0, Math.floor(Number(count) || 0)), 9999);
  if (count === unread) return;
  unread = count;
  if (PLATFORM === "windows") mainWindow.setOverlayIcon(count ? icon("badge.png") : null, count ? `${count} unread` : "");
  else app.setBadgeCount(count);
  if (tray) {
    tray.setImage(trayIcon(count > 0));
    tray.setToolTip(count ? `${app.getName()} — ${count} unread` : app.getName());
  }
}

const clean = (text, limit) => Array.from(String(text || "")).filter(c => !/[\u0000-\u001f\u007f-\u009f]/.test(c)).slice(0, limit).join("").trim();
const recentTitles = new Map();
let recentNotifications = [];

function notify(title, body) {
  title = clean(title, 64);
  if (settings.doNotDisturb || !title || !Notification.isSupported()) return;
  const now = Date.now();
  for (const [key, time] of recentTitles) if (now - time >= 3000) recentTitles.delete(key);
  recentNotifications = recentNotifications.filter(time => now - time < 10000);
  if (recentTitles.has(title) || recentNotifications.length >= 10) return;
  recentTitles.set(title, now);
  recentNotifications.push(now);
  const notification = new Notification({
    title, body: settings.showPreviews ? clean(body, 256) : "New message", silent: !settings.sounds
  });
  notification.on("click", showMain);
  notification.show();
}

// --- Preferences --------------------------------------------------------------------------------

function preferences() {
  return { ...settings, launchAtLogin: app.getLoginItemSettings().openAtLogin };
}

function showPreferences() {
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.show();
    preferencesWindow.focus();
    return;
  }
  const glass = PLATFORM === "macos" && settings.glass;
  preferencesWindow = new BrowserWindow({
    width: 480, height: 820, resizable: false, minimizable: false, maximizable: false,
    title: "Preferences", autoHideMenuBar: true,
    ...(PLATFORM === "macos" ? { titleBarStyle: "hidden", ...(glass ? { vibrancy: "sidebar", backgroundColor: "#00000000" } : {}) } : {}),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true }
  });
  preferencesWindow.loadFile(path.join(SHARED, "preferences.html"), glass ? { search: "glass" } : {});
}

async function signOut() {
  await session.defaultSession.clearStorageData();
  await session.defaultSession.clearCache();
  setUnread(0);
  mainWindow.loadURL(CHAT_URL);
  showMain();
}

async function confirmSignOut() {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning", buttons: ["Sign Out", "Cancel"], defaultId: 1, cancelId: 1,
    message: "Sign out of Facebook?", detail: `You will need to sign in to Facebook again to use ${app.getName()}.`
  });
  if (response === 0) await signOut();
}

// --- Commands from the pages (names as in the WebKit build) -------------------------------------

const fromMain = event => mainWindow && event.sender === mainWindow.webContents;
const fromPreferences = event => preferencesWindow && !preferencesWindow.isDestroyed() && event.sender === preferencesWindow.webContents;

ipcMain.on("pm-boot", event => {
  event.returnValue = fromMain(event) ? bootScript() : "";
});

ipcMain.handle("pm", async (event, command, args = {}) => {
  if (fromMain(event)) {
    switch (command) {
      case "set_unread": return setUnread(args.count);
      case "notify": return notify(args.title, args.body);
      case "get_theme": return settings.theme;
      case "open_preferences": return showPreferences();
      case "open_external": return openExternally(String(args.url || ""));
      case "call_in_browser": return openExternally(String(args.url || ""));
    }
  }
  if (fromPreferences(event)) {
    switch (command) {
      case "get_preferences": return preferences();
      case "set_preferences": {
        const previous = settings.theme;
        const next = args.settings || {};
        saveSettings({ ...settings, ...next });
        if (Boolean(args.launchAtLogin) !== app.getLoginItemSettings().openAtLogin) {
          app.setLoginItemSettings({ openAtLogin: Boolean(args.launchAtLogin) });
        }
        if (settings.theme !== previous) applyTheme(settings.theme);
        return preferences();
      }
      case "sign_out": return signOut();
    }
  }
  throw new Error("command not allowed");
});

// --- Menus ----------------------------------------------------------------------------------------

function appearanceMenu() {
  return {
    label: "Appearance",
    submenu: THEMES.map(([name, label]) => ({ label, type: "radio", checked: settings.theme === name, click: () => setTheme(name) }))
  };
}

function buildMenus() {
  if (PLATFORM === "macos") {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: app.getName(),
        submenu: [
          { role: "about" }, { type: "separator" },
          { label: "Preferences…", accelerator: "CmdOrCtrl+,", click: showPreferences },
          { label: "Sign Out…", click: confirmSignOut },
          { type: "separator" }, { role: "services" }, { type: "separator" },
          { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" },
          { label: `Quit ${app.getName()}`, accelerator: "Cmd+Q", click: quit }
        ]
      },
      { role: "editMenu" },
      { label: "View", submenu: [appearanceMenu(), { type: "separator" }, { role: "reload" }, { role: "togglefullscreen" }] },
      { role: "windowMenu" }
    ]));
  } else {
    Menu.setApplicationMenu(null);
  }
  if (tray) {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: `Show ${app.getName()}`, click: showMain },
      appearanceMenu(),
      { label: "Preferences…", click: showPreferences },
      { type: "separator" },
      { label: "Sign Out…", click: confirmSignOut },
      { label: "Quit", click: quit }
    ]));
  }
}

function createTray() {
  tray = new Tray(trayIcon(false));
  tray.setToolTip(app.getName());
  if (PLATFORM !== "linux") {
    tray.on("click", () => {
      if (mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide();
      else showMain();
    });
  }
}

// --- Permissions, downloads -----------------------------------------------------------------------

function facebookOrigin(href) {
  const url = parse(href || "");
  return Boolean(url && url.protocol === "https:" && ["facebook.com", "messenger.com", "fbsbx.com"].some(domain => under(url.hostname, domain)));
}

function setUpSession() {
  const ses = session.defaultSession;
  // Calls and voice clips: camera, microphone and screen sharing, for Facebook pages only.
  const allowed = new Set(["media", "display-capture", "notifications", "fullscreen", "clipboard-sanitized-write", "speaker-selection"]);
  ses.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    const ok = allowed.has(permission) && facebookOrigin(details.requestingUrl || contents.getURL());
    if (ok && permission === "media" && PLATFORM === "macos") {
      for (const type of details.mediaTypes || []) {
        const kind = type === "video" ? "camera" : "microphone";
        if (systemPreferences.getMediaAccessStatus(kind) !== "granted") await systemPreferences.askForMediaAccess(kind);
      }
    }
    callback(ok);
  });
  ses.setPermissionCheckHandler((contents, permission, origin) => allowed.has(permission) && facebookOrigin(origin));
  ses.setDisplayMediaRequestHandler(async (_request, callback) => {
    const [screen] = await desktopCapturer.getSources({ types: ["screen"] });
    callback(screen ? { video: screen } : {});
  }, { useSystemPicker: true });
  ses.on("will-download", (_event, item) => {
    item.once("done", (_e, state) => {
      if (settings.doNotDisturb) return;
      const name = clean(path.basename(item.getSavePath() || item.getFilename()), 128) || "The file";
      new Notification(state === "completed"
        ? { title: "Downloaded", body: `${name} is in your Downloads folder.` }
        : { title: "Download failed", body: name }).show();
    });
  });
}

// --- Start ----------------------------------------------------------------------------------------

// Facebook treats an "Electron" user agent as an unknown browser; present plain Chrome.
// Data lives in a folder named after the app id, not the display name, so a rename keeps the
// session; the folder of an earlier name (Pure Messenger, Pure Messenger Call) moves there once.
{
  const appData = app.getPath("appData");
  const dir = path.join(appData, "io.github.bthanhtung.natter");
  const earlier = ["dev.personal.puremessenger.call", "Pure Messenger Call"]
    .map(name => path.join(appData, name))
    .find(folder => fs.existsSync(folder));
  if (!fs.existsSync(dir) && earlier) {
    try {
      fs.renameSync(earlier, dir);
    } catch (_) {}
  }
  app.setPath("userData", dir);
}

// Without these Chromium sends multicast on the local network (Cast device discovery, and mDNS
// names that hide local IPs in WebRTC), which makes macOS ask for Local Network access at launch.
// Calls still connect through Facebook's servers.
app.commandLine.appendSwitch("disable-features", "MediaRouter,WebRtcHideLocalIpsWithMdns");

// Electron adds the app's and its own product tokens before "Chrome/"; drop everything there.
app.userAgentFallback = app.userAgentFallback
  .replace(/\(KHTML, like Gecko\) .*?Chrome\//, "(KHTML, like Gecko) Chrome/")
  .replace(/ Electron\/\S+/, "");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showMain);
  app.whenReady().then(() => {
    settings = loadSettings();
    nativeTheme.themeSource = "system";
    setUpSession();
    createMainWindow();
    createTray();
    applyTheme(settings.theme);
    nativeTheme.on("updated", () => {
      if (mainWindow && !(PLATFORM === "macos" && settings.glass)) mainWindow.setBackgroundColor(chromeColor());
    });
  });
  app.on("activate", showMain);
  app.on("before-quit", () => {
    quitting = true;
    saveWindowState();
  });
  app.on("window-all-closed", () => {});
}
