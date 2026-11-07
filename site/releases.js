/* Turns a GitHub release into download links. Pure functions, so `node --test` covers them. */
export const REPO = "bthanhtung/natter";
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

/** The release the page links to before (or without) the API. Update it on each release. */
export const KNOWN_RELEASE = {
  tag: "v1.0.0",
  date: "2026-11-02T17:42:39Z",
  assets: [
    ["Natter-1.0.0-universal.dmg", 213120542],
    ["Natter.Setup.1.0.0.exe", 106346987],
    ["natter_1.0.0_amd64.deb", 93200856],
    ["natter-1.0.0.x86_64.rpm", 82540953],
    ["natter-1.0.0.pacman", 84423076],
    ["Natter-1.0.0.AppImage", 119405831],
    ["Natter.Lite_1.0.0_universal.dmg", 6178190],
    ["Natter.Lite_1.0.0_x64-setup.exe", 1717761],
    ["Natter.Lite_1.0.0_amd64.deb", 2966742],
    ["Natter.Lite-1.0.0-1.x86_64.rpm", 2972849],
    ["natter-lite-1.0.0-1-x86_64.pkg.tar.zst", 2759309],
    ["Natter.Lite_1.0.0_amd64.AppImage", 81611256],
  ].map(([name, size]) => ({ name, size, browser_download_url: `https://github.com/${REPO}/releases/download/v1.0.0/${name}` })),
};

/** Download rows, in page order. `ext` is how a file of that kind ends. */
export const PLATFORMS = [
  { id: "mac", os: "mac", name: "macOS", note: "13+ · Apple silicon & Intel", ext: [".dmg"] },
  { id: "windows", os: "windows", name: "Windows", note: "10 / 11 · 64-bit", ext: [".exe"] },
  { id: "deb", os: "linux", name: "Ubuntu / Debian", note: ".deb", ext: [".deb"] },
  { id: "arch", os: "linux", name: "Arch Linux", note: ".pacman · .pkg.tar.zst", ext: [".pacman", ".pkg.tar.zst"] },
  { id: "rpm", os: "linux", name: "Fedora", note: ".rpm", ext: [".rpm"] },
  { id: "appimage", os: "linux", name: "Linux", note: ".AppImage", ext: [".AppImage"] },
];

/** { natter: { mac: asset, ... }, lite: { ... } }. Checksums and anything unknown are left out. */
export function sortAssets(assets) {
  const out = { natter: {}, lite: {} };
  for (const asset of assets) {
    const name = asset.name;
    if (name.endsWith(".sha256")) continue;
    const platform = PLATFORMS.find((p) => p.ext.some((ext) => name.endsWith(ext)));
    if (platform) out[/lite/i.test(name) ? "lite" : "natter"][platform.id] = asset;
  }
  return out;
}

/** The reader's system, from the browser's own report. */
export function detectOS(platform = "", userAgent = "") {
  const ua = `${platform} ${userAgent}`;
  if (/iphone|ipad|android/i.test(ua)) return "mobile";
  if (/mac/i.test(ua)) return "mac";
  if (/win/i.test(ua)) return "windows";
  if (/linux|x11/i.test(ua)) return "linux";
  return "other";
}

/** The row to offer first on this system; Linux has several, so it gets the list instead. */
export const primaryPlatform = (os) => ({ mac: "mac", windows: "windows" })[os] ?? null;

export const formatSize = (bytes) => `${Math.round(bytes / 1e6)} MB`;
