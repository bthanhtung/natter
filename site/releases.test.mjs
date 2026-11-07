import assert from "node:assert/strict";
import { test } from "node:test";
import { KNOWN_RELEASE, detectOS, formatSize, primaryPlatform, sortAssets } from "./releases.js";

// Names the two workflows produce, after GitHub turns spaces into dots.
const files = [
  "Natter-1.0.0-universal.dmg", "Natter.Setup.1.0.0.exe", "Natter-1.0.0.AppImage", "natter_1.0.0_amd64.deb",
  "natter-1.0.0.x86_64.rpm", "natter-1.0.0.pacman", "Natter.Lite_1.0.0_universal.dmg", "Natter.Lite_1.0.0_x64-setup.exe",
  "Natter.Lite_1.0.0_x64_en-US.msi", "Natter.Lite_1.0.0_amd64.AppImage", "Natter.Lite_1.0.0_amd64.deb",
  "Natter.Lite-1.0.0-1.x86_64.rpm", "natter-lite-1.0.0-1-x86_64.pkg.tar.zst",
];
const assets = [...files, ...files.map((f) => `${f}.sha256`)].map((name) => ({ name }));

test("every build lands on its platform and channel", () => {
  const { natter, lite } = sortAssets(assets);
  const names = (group) => Object.fromEntries(Object.entries(group).map(([k, v]) => [k, v.name]));
  assert.deepEqual(names(natter), {
    mac: "Natter-1.0.0-universal.dmg", windows: "Natter.Setup.1.0.0.exe", appimage: "Natter-1.0.0.AppImage",
    deb: "natter_1.0.0_amd64.deb", rpm: "natter-1.0.0.x86_64.rpm", arch: "natter-1.0.0.pacman",
  });
  assert.deepEqual(names(lite), {
    mac: "Natter.Lite_1.0.0_universal.dmg", windows: "Natter.Lite_1.0.0_x64-setup.exe", appimage: "Natter.Lite_1.0.0_amd64.AppImage",
    deb: "Natter.Lite_1.0.0_amd64.deb", rpm: "Natter.Lite-1.0.0-1.x86_64.rpm", arch: "natter-lite-1.0.0-1-x86_64.pkg.tar.zst",
  });
});

test("an empty or unknown release gives no links", () => {
  assert.deepEqual(sortAssets([]), { natter: {}, lite: {} });
  assert.deepEqual(sortAssets([{ name: "notes.txt" }]), { natter: {}, lite: {} });
});

test("the known release has a direct link for every platform", () => {
  const { natter, lite } = sortAssets(KNOWN_RELEASE.assets);
  for (const group of [natter, lite]) {
    assert.deepEqual(Object.keys(group).sort(), ["appimage", "arch", "deb", "mac", "rpm", "windows"]);
    for (const asset of Object.values(group)) {
      assert.ok(asset.browser_download_url.startsWith("https://github.com/bthanhtung/natter/releases/download/v1.0.0/"));
    }
  }
});

test("detects the system, and mobile is not a desktop", () => {
  assert.equal(detectOS("MacIntel"), "mac");
  assert.equal(detectOS("Win32"), "windows");
  assert.equal(detectOS("Linux x86_64"), "linux");
  assert.equal(detectOS("Linux armv8l", "Mozilla/5.0 (Linux; Android 14)"), "mobile");
  assert.equal(detectOS("MacIntel", "Mozilla/5.0 (iPad; CPU OS 17)"), "mobile");
  assert.equal(detectOS("", ""), "other");
});

test("only systems with one obvious file get a first offer", () => {
  assert.equal(primaryPlatform("mac"), "mac");
  assert.equal(primaryPlatform("linux"), null);
  assert.equal(primaryPlatform("mobile"), null);
});

test("sizes read in MB", () => assert.equal(formatSize(93684948), "94 MB"));
