// Bridges the shared page scripts to the app: they call window.__TAURI_INTERNALS__.invoke, as in
// the WebKit build, and the chat window gets the injected script before Facebook's own scripts.

"use strict";

const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("__TAURI_INTERNALS__", {
  invoke: (command, args) => ipcRenderer.invoke("pm", String(command), args || {})
});

// Empty for every page but the chat window.
const boot = ipcRenderer.sendSync("pm-boot");
if (boot) webFrame.executeJavaScript(boot);
