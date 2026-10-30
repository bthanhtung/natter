# Security

Natter holds a signed-in Facebook session, so security reports are taken seriously.

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's private reporting instead:
[**Report a vulnerability**](https://github.com/bthanhtung/natter/security/advisories/new)
(repository → Security → Report a vulnerability).

Include the app (Natter or Natter Lite), version, operating system, and steps to reproduce.
You'll get a reply as soon as possible; this is a side project, so please allow a few days.

## In scope

- Anything that could expose or misuse the Facebook session or cookies.
- A web page reaching app commands it shouldn't (IPC / Tauri capabilities / the Electron preload).
- Navigation rules that let a non-Facebook page load inside the app window.
- Issues in how release files are built, checksummed or attested.

## Out of scope

- Bugs in Facebook or Messenger themselves — report those to [Meta](https://www.facebook.com/whitehat).
- Warnings shown because the builds are not code-signed (see the README).

## Supported versions

Only the latest release receives fixes.
