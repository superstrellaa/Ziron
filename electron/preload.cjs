const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ziron", {
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),

  log: (level, module, message) =>
    ipcRenderer.send("log", { level, module, message }),
});
