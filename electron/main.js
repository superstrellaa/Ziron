import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { initLogger, closeLogger, log } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

async function createWindow() {
  initLogger();
  log("INFO", "Main", "Creating main window");

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#1a1a2e",
    titleBarStyle: "hidden",
    frame: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.maximize();
  win.show();

  if (isDev) {
    log("INFO", "Main", "Dev mode — loading Vite at http://localhost:5173");
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    log("INFO", "Main", "Production mode — loading dist/index.html");
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.on("closed", () => log("INFO", "Main", "Main window closed"));
}

app.whenReady().then(createWindow);

// IPC handlers
ipcMain.on("log", (_, { level, module, message }) => {
  log(level, module, message);
});

ipcMain.on("window:minimize", () => {
  log("INFO", "Window", "Minimize");
  BrowserWindow.getFocusedWindow()?.minimize();
});
ipcMain.on("window:maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  const action = win?.isMaximized() ? "unmaximize" : "maximize";
  log("INFO", "Window", action);
  win?.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on("window:close", () => {
  log("INFO", "Window", "Close requested");
  BrowserWindow.getFocusedWindow()?.close();
});

app.on("window-all-closed", () => {
  closeLogger();
  if (process.platform !== "darwin") app.quit();
});
