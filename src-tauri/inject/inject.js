(function () {
  "use strict";

  // Structural selectors only; update here when Facebook changes its accessibility markup.
  const SELECTORS = {
    // The site-wide header, not the conversation header.
    banner: 'div[role="banner"]',
    // The site-wide navigation with its own accessible Facebook label.
    globalNav: 'div[role="navigation"][aria-label="Facebook"]',
    // A labelled stories region, never the conversation list.
    storiesEnglish: '[role="region"][aria-label*="Stories" i]',
    storiesVietnamese: '[role="region"][aria-label="Tin" i]',
    // Login form signals that chrome removal must be disabled.
    loginForm: 'form[action*="login"], input[name="pass"]',
    // Messenger's own layout; once it is on screen the login form check can stop.
    chat: '[role="main"]',
    // The conversation list and its rows; a row whose name or preview is bold is unread.
    chatList: '[role="navigation"]:not([aria-label="Facebook"])',
    chatRow: 'a[role="link"][href*="/t/"]'
  };

  // The window is chat-only: other Facebook pages open in the default browser.
  const CHAT_PATH = /^\/(?:messages|messenger_media)(?:\/|$)/i;
  // Sign-in and verification flows must stay in the window, and chrome removal stays off there.
  const AUTH_PATH = /^\/(?:login|checkpoint|recover|two_step_verification|two_factor|cookie\/consent|privacy\/consent|confirmemail|device-based|auth)/i;
  const HOME_PATH = /^\/(?:home\.php)?$/i;

  // Facebook's light/dark switch: its color variables are defined for these classes in inline
  // <style> rules (`:root, .__fb-light-mode` and `.__fb-dark-mode`), and inner containers carry
  // the account-level class.
  const FB_MODE = { dark: "__fb-dark-mode", light: "__fb-light-mode" };
  const LIGHT_RULE = /^:root\s*,.*\.__fb-light-mode$/;
  const DARK_RULE = /^\.__fb-dark-mode$/;
  // "facebook" follows Facebook's own Dark mode setting; the others override it.
  const THEMES = ["facebook", "system", "light", "grey", "dark", "high_contrast"];

  try {
    if (window.top !== window || !/^(?:facebook\.com|.+\.facebook\.com)$/i.test(location.hostname) || window.__PM_INIT__) return;
    // Only the chat window: call popups (which share the webview setup on macOS) keep Facebook's page as is.
    if (window.opener || !(CHAT_PATH.test(location.pathname) || AUTH_PATH.test(location.pathname) || HOME_PATH.test(location.pathname))) return;
    window.__PM_INIT__ = true;

    let titleObserver;
    let titleElement;
    let headObserver;
    let bodyObserver;
    let chatShown = false;
    let unreadTimer;
    let pageModeTimer;
    let lastUnread;
    let theme = THEMES.includes(window.__PM_THEME__) ? window.__PM_THEME__ : "facebook";
    let modeCheckTimer;
    // Facebook's own classes on <html>, put back when its setting is followed again.
    const pageModeClasses = document.documentElement
      ? Object.values(FB_MODE).filter(name => document.documentElement.classList.contains(name))
      : [];
    const systemDark = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const modeSheets = new WeakSet();
    // Facebook inlines the same variable rules more than once; keep each block once.
    const modeDeclarations = { dark: new Set(), light: new Set() };

    function invoke(command, args) {
      try {
        const bridge = window.__TAURI_INTERNALS__;
        if (bridge && typeof bridge.invoke === "function") {
          const result = bridge.invoke(command, args);
          if (result && typeof result.catch === "function") result.catch(() => {});
          return result;
        }
      } catch (_) {
        // An unavailable bridge must not interfere with Facebook.
      }
      return undefined;
    }

    // Facebook's text color tells its current mode: light text means dark mode.
    function facebookIsDark() {
      const element = document.querySelector(SELECTORS.chat) || document.documentElement;
      const color = element ? getComputedStyle(element).getPropertyValue("--primary-text").trim() : "";
      const hex = /^#([0-9a-f]{6})$/i.exec(color);
      const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(color);
      const channels = hex
        ? [0, 2, 4].map(index => parseInt(hex[1].slice(index, index + 2), 16))
        : rgb ? rgb.slice(1, 4).map(Number) : null;
      if (!channels) return !!(systemDark && systemDark.matches);
      return (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000 > 128;
    }

    function wantsDark() {
      if (theme === "grey" || theme === "dark") return true;
      if (theme === "system") return !!(systemDark && systemDark.matches);
      if (theme === "facebook") return facebookIsDark();
      return false;
    }

    function enforceMode() {
      const classes = document.documentElement && document.documentElement.classList;
      if (!classes) return;
      const forced = theme !== "facebook";
      classes.toggle("pm-forced", forced);
      if (forced) {
        const dark = wantsDark();
        classes.toggle(FB_MODE.dark, dark);
        classes.toggle(FB_MODE.light, !dark);
      } else {
        for (const name of Object.values(FB_MODE)) classes.toggle(name, pageModeClasses.includes(name));
      }
      classes.toggle("pm-dark", wantsDark());
    }

    // Following Facebook, its mode can only change after a click (its Dark mode menu) or a new
    // page title; one style read then, nothing while idle.
    function scheduleModeCheck() {
      if (theme !== "facebook" || modeCheckTimer) return;
      modeCheckTimer = setTimeout(() => {
        modeCheckTimer = undefined;
        enforceMode();
      }, 400);
    }

    function addModeSheet(sheet) {
      if (!sheet || modeSheets.has(sheet)) return false;
      modeSheets.add(sheet);
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (_) {
        return false;
      }
      let found = false;
      for (const rule of rules) {
        const selector = rule.selectorText && rule.selectorText.trim();
        if (!selector || !rule.style) continue;
        const mode = DARK_RULE.test(selector) ? "dark" : LIGHT_RULE.test(selector) ? "light" : null;
        if (!mode) continue;
        modeDeclarations[mode].add(rule.style.cssText);
        found = true;
      }
      return found;
    }

    function writeModeStyle() {
      if (!document.documentElement) return;
      let style = document.getElementById("pm-mode");
      if (!style) {
        style = document.createElement("style");
        style.id = "pm-mode";
        document.documentElement.appendChild(style);
      }
      // Containers pinned to the account's mode take the chosen mode's variables from CSS, so
      // nothing has to watch the DOM and new containers never flash the other mode. The root
      // selectors outrank Facebook's `.__fb-light-mode:root`, whatever its Dark mode setting.
      style.textContent =
        `html.pm-forced.pm-dark:root,html.pm-forced.pm-dark .${FB_MODE.light}{${[...modeDeclarations.dark].join("")}}` +
        `html.pm-forced:not(.pm-dark):root,html.pm-forced:not(.pm-dark) .${FB_MODE.dark}{${[...modeDeclarations.light].join("")}}`;
    }

    function isModeStyle(node) {
      return node && node.nodeName === "STYLE" && String(node.textContent).includes(FB_MODE.dark);
    }

    function scanModeSheets() {
      let changed = false;
      for (const sheet of document.styleSheets || []) {
        if (isModeStyle(sheet.ownerNode) && addModeSheet(sheet)) changed = true;
      }
      if (changed) writeModeStyle();
    }

    function applyTheme(value) {
      if (!THEMES.includes(value)) return;
      theme = value;
      const classes = document.documentElement && document.documentElement.classList;
      if (classes) for (const name of THEMES) classes.toggle(`pm-theme-${name}`, name === theme);
      enforceMode();
    }

    function installStyle() {
      if (!document.documentElement || document.getElementById("pm-style")) return;
      const style = document.createElement("style");
      style.id = "pm-style";
      style.textContent = String(window.__PM_CSS__ || "")
        .replaceAll("__PM_BANNER__", SELECTORS.banner)
        .replaceAll("__PM_GLOBAL_NAV__", SELECTORS.globalNav)
        .replaceAll("__PM_STORIES_ENGLISH__", SELECTORS.storiesEnglish)
        .replaceAll("__PM_STORIES_VIETNAMESE__", SELECTORS.storiesVietnamese);
      document.documentElement.appendChild(style);
    }

    function keepInApp(url) {
      if (!/^https?:$/.test(url.protocol)) return true;
      // Other sites and Facebook's link shim are routed to the browser natively.
      if (!/^(?:.+\.)?facebook\.com$/i.test(url.hostname) || /^lm?\.facebook\.com$/i.test(url.hostname)) return true;
      return CHAT_PATH.test(url.pathname) || AUTH_PATH.test(url.pathname);
    }

    function openExternal(href) {
      invoke("open_external", { url: href });
    }

    // Facebook turns calls in encrypted chats off for WebKit, the engine on macOS and Linux. The
    // only disabled buttons in the conversation header are those calls; they get the app's own
    // hint and continue the call in a Chromium-based browser (see browser.rs).
    let callTip;

    // In the language Facebook is shown in, not the system's.
    function callHint() {
      const language = document.documentElement.lang || (window.navigator && window.navigator.language) || "";
      return /^vi\b/i.test(language)
        ? "App không hỗ trợ tính năng này. Bấm để gọi bằng Messenger trên trình duyệt."
        : "This app can't make this call. Click to call with Messenger in your browser.";
    }

    function blockedCallButton(target) {
      if (window.__PM_PLATFORM__ === "windows" || !target || typeof target.closest !== "function") return null;
      const button = target.closest('[role="button"][aria-disabled="true"]');
      const chat = button && button.closest(SELECTORS.chat);
      if (!chat) return null;
      return button.getBoundingClientRect().top - chat.getBoundingClientRect().top < 100 ? button : null;
    }

    function showCallTip(button) {
      if (!callTip) {
        callTip = document.createElement("div");
        callTip.id = "pm-tip";
        callTip.setAttribute("role", "tooltip");
        callTip.textContent = callHint();
        document.documentElement.appendChild(callTip);
      }
      const rect = button.getBoundingClientRect();
      callTip.hidden = false;
      callTip.style.top = `${Math.round(rect.bottom + 8)}px`;
      callTip.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    }

    function hideCallTip() {
      if (callTip) callTip.hidden = true;
    }

    function interceptCallButtons() {
      // Capture phase: Facebook's own "not supported" tooltip never sees these hovers.
      const over = event => {
        const button = blockedCallButton(event.target);
        if (!button) return;
        event.stopPropagation();
        showCallTip(button);
      };
      const out = event => {
        const button = blockedCallButton(event.target);
        if (!button) return;
        event.stopPropagation();
        if (!button.contains(event.relatedTarget)) hideCallTip();
      };
      window.addEventListener("mouseover", over, true);
      window.addEventListener("pointerover", over, true);
      window.addEventListener("mouseout", out, true);
      window.addEventListener("pointerout", out, true);
    }

    function interceptLinks() {
      // Capture phase, so Facebook's router never sees clicks that leave the chat.
      window.addEventListener("click", event => {
        scheduleModeCheck();
        if (event.button !== 0) return;
        const target = event.target;
        if (blockedCallButton(target)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          hideCallTip();
          invoke("call_in_browser", { url: location.href });
          return;
        }
        const anchor = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
        if (!anchor) return;
        let url;
        try {
          url = new URL(anchor.href, location.href);
        } catch (_) {
          return;
        }
        if (keepInApp(url)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openExternal(url.href);
      }, true);
    }

    function pageMode() {
      const blocked = AUTH_PATH.test(location.pathname);
      const loginVisible = !!document.querySelector(SELECTORS.loginForm);
      document.documentElement.classList.toggle("pm-active", !blocked && !loginVisible);
      // Signed in and showing chats: a login form can only return through a navigation, which
      // reruns this script, so stop watching the body.
      if (bodyObserver && !blocked && !loginVisible && document.querySelector(SELECTORS.chat)) {
        chatShown = true;
        bodyObserver.disconnect();
        bodyObserver = undefined;
        scheduleUnread();
        scheduleModeCheck();
      }
    }

    function schedulePageMode() {
      // Throttled rather than debounced: Facebook mutates the DOM continuously while loading.
      if (pageModeTimer) return;
      pageModeTimer = setTimeout(() => {
        pageModeTimer = undefined;
        pageMode();
      }, 300);
    }

    function observeBody() {
      if (bodyObserver || chatShown || !document.body) return;
      bodyObserver = new MutationObserver(schedulePageMode);
      bodyObserver.observe(document.body, { childList: true, subtree: true });
      pageMode();
    }

    function installMacChrome() {
      // macOS: the title bar is overlaid on the page and, if chosen in Preferences, the window is
      // glass (see window.rs).
      if (window.__PM_PLATFORM__ !== "macos" || document.getElementById("pm-drag")) return;
      document.documentElement.classList.add("pm-mac");
      if (window.__PM_GLASS__ === true) document.documentElement.classList.add("pm-glass");
      const strip = document.createElement("div");
      strip.id = "pm-drag";
      strip.setAttribute("data-tauri-drag-region", "");
      document.documentElement.appendChild(strip);
    }

    function isUnread(row) {
      // The name and the preview are the first text spans; checking two keeps style reads cheap.
      let checked = 0;
      for (const span of row.getElementsByTagName("span")) {
        if (span.firstElementChild || !span.textContent) continue;
        if (Number(getComputedStyle(span).fontWeight) >= 600) return true;
        if (++checked === 2) break;
      }
      return false;
    }

    // The page title's "(N)" also counts Facebook notifications such as friend requests, so the
    // badge counts unread conversations in the chat list instead.
    function unreadCount() {
      const list = document.querySelector(SELECTORS.chatList);
      if (!list) return 0;
      let count = 0;
      for (const row of list.querySelectorAll(SELECTORS.chatRow)) {
        if (isUnread(row)) count++;
      }
      return Math.min(count, 9999);
    }

    function sendUnread() {
      unreadTimer = undefined;
      const count = unreadCount();
      if (count !== lastUnread) {
        lastUnread = count;
        invoke("set_unread", { count });
      }
    }

    // Facebook retitles the page whenever a message arrives or is read, so the title is the only
    // trigger; the count runs when the page is idle, never during scrolling or typing.
    function scheduleUnread() {
      if (unreadTimer) return;
      unreadTimer = setTimeout(() => {
        if (typeof requestIdleCallback === "function") requestIdleCallback(sendUnread, { timeout: 2000 });
        else sendUnread();
      }, 500);
    }

    function observeTitle() {
      const title = document.head && document.head.querySelector("title");
      if (title === titleElement) return;
      titleElement = title;
      if (titleObserver) titleObserver.disconnect();
      if (title) {
        titleObserver = titleObserver || new MutationObserver(() => {
          scheduleUnread();
          scheduleModeCheck();
        });
        titleObserver.observe(title, { childList: true, characterData: true, subtree: true });
      }
      scheduleUnread();
    }

    function onHeadMutations(records) {
      let titleChanged = false;
      let modeChanged = false;
      for (const record of records) {
        for (const node of [...record.addedNodes, ...record.removedNodes]) {
          if (node.nodeName === "TITLE") titleChanged = true;
        }
        for (const node of record.addedNodes) {
          if (isModeStyle(node) && addModeSheet(node.sheet)) modeChanged = true;
        }
      }
      if (titleChanged) observeTitle();
      if (modeChanged) writeModeStyle();
    }

    function observeHead() {
      if (headObserver || !document.head) return;
      headObserver = new MutationObserver(onHeadMutations);
      headObserver.observe(document.head, { childList: true });
    }

    function forwardNotification(title, options) {
      if (document.visibilityState === "visible" && document.hasFocus()) return;
      invoke("notify", { title: String(title || ""), body: String((options && options.body) || "") });
    }

    function installNotifications() {
      class PMNotification extends EventTarget {
        static get permission() { return "granted"; }
        static requestPermission(callback) {
          if (typeof callback === "function") callback("granted");
          return Promise.resolve("granted");
        }
        constructor(title, options = {}) {
          super();
          this.onclick = null;
          this.onclose = null;
          this.onerror = null;
          this.onshow = null;
          forwardNotification(title, options);
        }
        close() {}
      }
      window.Notification = PMNotification;
      const registration = window.ServiceWorkerRegistration;
      if (registration && registration.prototype && typeof registration.prototype.showNotification === "function") {
        registration.prototype.showNotification = function (title, options = {}) {
          forwardNotification(title, options);
          return Promise.resolve();
        };
      }
    }

    function installShortcuts() {
      // macOS gets ⌘, from the application menu.
      if (window.__PM_PLATFORM__ === "macos") return;
      window.addEventListener("keydown", event => {
        if (event.key === "," && event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
          event.preventDefault();
          invoke("open_preferences");
        }
      }, true);
    }

    function initializeDOM() {
      installStyle();
      installMacChrome();
      applyTheme(theme);
      scanModeSheets();
      observeHead();
      observeBody();
      observeTitle();
    }

    // Facebook's home feed (for example after signing in) is replaced by the chats.
    if (HOME_PATH.test(location.pathname)) {
      location.replace("/messages/");
      return;
    }

    window.__PM_APPLY_THEME__ = applyTheme;
    interceptLinks();
    interceptCallButtons();
    installNotifications();
    installShortcuts();
    if (systemDark && typeof systemDark.addEventListener === "function") systemDark.addEventListener("change", enforceMode);
    // At document start only <html> may exist; DOMContentLoaded completes the head and body work.
    if (document.documentElement) initializeDOM();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeDOM, { once: true });

    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      history[method] = function (...args) {
        const before = location.href;
        const result = original.apply(this, args);
        let url;
        try {
          url = new URL(location.href);
        } catch (_) {
          url = null;
        }
        // Script-driven navigation away from the chat (no link to intercept): show it in the browser instead.
        if (url && !keepInApp(url)) {
          openExternal(url.href);
          if (method === "pushState") history.back();
          else location.replace(before);
          return result;
        }
        pageMode();
        return result;
      };
    }
    window.addEventListener("popstate", pageMode);
    window.addEventListener("pagehide", () => {
      for (const observer of [titleObserver, headObserver, bodyObserver]) {
        if (observer) observer.disconnect();
      }
      clearTimeout(unreadTimer);
      clearTimeout(pageModeTimer);
      clearTimeout(modeCheckTimer);
    });

    // The initialization script is fixed at window creation; ask for the theme saved since then.
    const saved = invoke("get_theme");
    if (saved && typeof saved.then === "function") saved.then(applyTheme, () => {});
  } catch (_) {
    // Injection must never break a remote page.
  }
})();
