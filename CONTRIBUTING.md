# Contributing to Natter

Thanks for helping! Natter is a small side project, so every bug report, fix and test on a system
the maintainer doesn't use (Windows, Linux) makes a real difference.

## Ways to help

- **Report what broke.** Facebook changes its page now and then; a short report with your system
  and Natter version is often enough to fix it. Use the issue forms — they ask the right questions.
- **Fix a selector.** The most common fix, and a great first contribution — see
  [When Facebook changes something](#when-facebook-changes-something).
- **Test on Windows or Linux** and tell us what looks off.
- **Packaging:** Homebrew, winget, Flatpak/Flathub, AUR. These are open
  [good first issues](https://github.com/bthanhtung/natter/labels/good%20first%20issue).
- **Translate** the Preferences window and menus.

## The one rule

Natter is a **window around Meta's own Messenger page**. It must not use unofficial APIs, scrape,
automate actions, read or store messages, or override Facebook's internals. Changes are limited to
layout and theme (CSS), routing links, and small bridges for native features (badge, notifications,
tray). This keeps users' accounts safe and the project maintainable. If you're unsure whether an
idea fits, open an issue first.

## Set up

```sh
git clone https://github.com/bthanhtung/natter.git
cd natter
npm install                 # Lite (Tauri) — needs Rust, see README › Build it yourself
npm run dev                 # run Natter Lite from source
npm test                    # injected-script tests (Node) + Rust unit tests

cd electron && npm install
npm start                   # run Natter (Chromium) from source
NATTER_DEBUG=1 npm start    # also print the injected script's state and page errors
```

In `npm run dev`, right-click → **Inspect Element** opens the WebKit/WebView2 developer tools.

You don't need to build both apps for most changes: the shared files are identical in both.

## Where things live

| You want to change… | Edit |
|---|---|
| Layout, themes, scrollbars, glass | `src-tauri/inject/inject.css` |
| Unread count, link routing, notifications, theme switching | `src-tauri/inject/inject.js` (+ tests in `inject.test.mjs`) |
| The Preferences window | `dist/preferences.html` |
| Lite: windows, navigation rules, native commands, tray | `src-tauri/src/*.rs`; permissions in `src-tauri/capabilities/` |
| Natter (Chromium): the same, plus call windows and permissions | `electron/main.js`, `electron/preload.js` |
| Icons | `src-tauri/icons/` (SVG sources in `source/`) |

`src-tauri/inject/*`, `dist/preferences.html` and the icons are **shared**: `electron/sync-shared.js`
copies them into the Chromium app before it runs or is packaged. Never edit `electron/shared/`.

## When Facebook changes something

Everything that depends on Facebook's markup is kept together so it's quick to fix:

- `SELECTORS`, `CHAT_PATH`, `AUTH_PATH` and `FB_MODE` at the top of `src-tauri/inject/inject.js`;
- the theme colour variables in `src-tauri/inject/inject.css`;
- the user agents: `UA` in `src-tauri/src/window.rs` (keep WebKit on a Safari fingerprint and
  WebView2 on Edge) and the Chrome user agent in `electron/main.js`.

To fix one:

1. Open Messenger at `facebook.com/messages` in a normal browser, inspect the element that changed
   and find a **stable** attribute — prefer `role`, `aria-label` and `href` over generated class
   names, which change every deploy.
2. Update the selector, keeping the comment that says what it matches.
3. Add or adjust a test in `src-tauri/inject/inject.test.mjs` when the logic changes.
4. Run `npm test`, then try it in `npm run dev` or `npm start`.

Facebook shows different labels per language (for example `Stories` / `Tin`), so check that the
change still works with Facebook set to another language.

## Code style

- Match the code around you: plain JavaScript (no build step), idiomatic Rust (`cargo fmt`), short
  comments that explain *why*.
- Keep the page light: no `MutationObserver` on the whole document, no timers that run while the
  user scrolls or types. Themes are CSS only.
- No new dependencies without discussing them in an issue first.
- Anything that touches sign-in, sessions, permissions or IPC commands needs a clear explanation in
  the pull request.

## Accessibility check

Natter shows Meta's page, so report only what Natter changes. If the same
problem appears on facebook.com/messages in a browser, it's Meta's.

- [ ] Keyboard: Tab reaches the chat list, message box and Preferences, in a sensible order
- [ ] Focus: the focused element stays visible, in every theme
- [ ] Keyboard: menus, Preferences and dialogs open, work and close without a mouse
- [ ] Screen reader: chats, messages and Preferences controls are read with names
      (VoiceOver on macOS, Narrator or NVDA on Windows, Orca on Linux)
- [ ] Contrast: text stays readable in Grey, Dark and High contrast
- [ ] New notifications and the unread badge don't move focus
- [ ] Say which app (Natter or Lite), which OS and which screen reader you tested

## Pull requests

1. Fork, create a branch from `main` (`fix/unread-badge`, `feat/translations`…).
2. Keep it focused: one change per pull request.
3. `npm test` passes; you've tried it in at least one of the two apps (say which, and on which OS).
4. Screenshots or a short clip for visual changes — **with no personal conversations in them**.
5. Commit messages follow the existing style: `fix: …`, `feat: …`, `perf: …`, `docs: …`.

By contributing you agree your work is released under the [GPL-3.0](LICENSE).

## Releases (maintainer)

Bump the version in `package.json`, `electron/package.json`, `src-tauri/Cargo.toml` and
`src-tauri/tauri.conf.json`, update `CHANGELOG.md`, tag `v<version>`, then start **Build Lite** and
**Build Chromium** on that tag. They attach installers, `.sha256` files and build attestations to a
draft release.
