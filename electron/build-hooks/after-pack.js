// electron-builder renames the macOS helper apps but leaves "Electron Helper…" as their
// CFBundleName, which is the name macOS shows in privacy prompts such as Local Network. Runs
// before signing, so the signature covers the fixed Info.plists.

"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const frameworks = path.join(app, "Contents", "Frameworks");
  for (const entry of fs.readdirSync(frameworks)) {
    if (!entry.endsWith(".app")) continue;
    const plist = path.join(frameworks, entry, "Contents", "Info.plist");
    execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :CFBundleName ${entry.slice(0, -4)}`, plist]);
  }
};
