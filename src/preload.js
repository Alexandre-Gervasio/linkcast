const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("lc", {
  info: () => ipcRenderer.invoke("info"),
  sources: () => ipcRenderer.invoke("sources"),
  recStart: () => ipcRenderer.invoke("rec-start"),
  recChunk: (b) => ipcRenderer.invoke("rec-chunk", b),
  recStop: () => ipcRenderer.invoke("rec-stop"),
  copyLink: (value) => ipcRenderer.invoke("copy-link", value),
  onShortcut: (cb) => ipcRenderer.on("shortcut", (_, a) => cb(a)),
});
