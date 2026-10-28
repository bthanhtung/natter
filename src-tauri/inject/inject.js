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
    loginForm: 'form[action*="login"], input[name="pass"]'
  };

  try {
    if (window.top !== window || !/^(?:facebook\.com|.+\.facebook\.com)$/i.test(location.hostname) || window.__PM_INIT__) return;
    window.__PM_INIT__ = true;

    const html = document.documentElement;
    let titleObserver;
    let headObserver;
    let unreadTimer;
    let lastUnread;

    function invoke(command, args) {
      try {
        const bridge = window.__TAURI_INTERNALS__;
        if (bridge && typeof bridge.invoke === "function") {
          const result = bridge.invoke(command, args);
          if (result && typeof result.catch === "function") result.catch(() => {});
        }
      } catch (_) {
        // An unavailable bridge must not interfere with Facebook.
      }
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

    function pageMode() {
      const blocked = /^\/(?:login|checkpoint|recover|two_step_verification|cookie\/consent)/i.test(location.pathname);
      const loginVisible = !!document.querySelector(SELECTORS.loginForm);
      document.documentElement.classList.toggle("pm-active", !blocked && !loginVisible);
    }

    function createTitlebar() {
      if (document.getElementById("pm-titlebar")) return;
      const platform = window.__PM_PLATFORM__;
      if (!["macos", "windows", "linux"].includes(platform)) return;
      const macos = platform === "macos";
      document.documentElement.classList.add(macos ? "pm-macos" : "pm-has-titlebar");
      const bar = document.createElement("div");
      bar.id = "pm-titlebar";
      bar.setAttribute("data-tauri-drag-region", "");
      if (!macos) {
        const label = document.createElement("span");
        label.textContent = "PureMessenger";
        label.setAttribute("data-tauri-drag-region", "");
        bar.appendChild(label);
        for (const [action, glyph] of [["minimize", "−"], ["maximize", "□"], ["close", "×"]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `pm-${action}`;
          button.setAttribute("aria-label", action.charAt(0).toUpperCase() + action.slice(1));
          button.textContent = glyph;
          button.addEventListener("click", () => invoke("window_control", { action }));
          bar.appendChild(button);
        }
      }
      document.documentElement.appendChild(bar);
    }

    function unreadCount() {
      const match = /^\((\d+)\+?\)/.exec(document.title);
      return match ? Math.min(Number(match[1]), Number.MAX_SAFE_INTEGER) : 0;
    }

    function sendUnread() {
      const count = unreadCount();
      if (count !== lastUnread) {
        lastUnread = count;
        invoke("set_unread", { count });
      }
    }

    function scheduleUnread() {
      clearTimeout(unreadTimer);
      unreadTimer = setTimeout(sendUnread, 500);
    }

    function observeTitle() {
      if (!document.head) return;
      if (titleObserver) titleObserver.disconnect();
      const title = document.head.querySelector("title");
      if (title) {
        titleObserver = new MutationObserver(scheduleUnread);
        titleObserver.observe(title, { childList: true, characterData: true, subtree: true });
      }
      if (!headObserver) {
        headObserver = new MutationObserver(() => {
          observeTitle();
          scheduleUnread();
        });
        headObserver.observe(document.head, { childList: true });
      }
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

    function initializeDOM() {
      installStyle();
      createTitlebar();
      pageMode();
      observeTitle();
      scheduleUnread();
    }

    installNotifications();
    if (html) {
      initializeDOM();
    } else {
      document.addEventListener("DOMContentLoaded", initializeDOM, { once: true });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeDOM, { once: true });

    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        pageMode();
        return result;
      };
    }
    window.addEventListener("popstate", pageMode);
    window.addEventListener("pagehide", () => {
      if (titleObserver) titleObserver.disconnect();
      if (headObserver) headObserver.disconnect();
      clearTimeout(unreadTimer);
    });
  } catch (_) {
    // Injection must never break a remote page.
  }
})();
