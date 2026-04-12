import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

async function createWindow() {
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
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

ipcMain.on("window:minimize", () =>
  BrowserWindow.getFocusedWindow()?.minimize(),
);
ipcMain.on("window:maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on("window:close", () => BrowserWindow.getFocusedWindow()?.close());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
