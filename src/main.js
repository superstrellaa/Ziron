import "./styles.css";
import { createIcons, Box, Minimize, Maximize, X } from "lucide";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadConfig, get } from "./editor/systems/persistence/config.js";
import {
  applyConfigKeybinds,
  onKeybind,
} from "./editor/systems/input/keybinds.js";
import { createWelcomeScreen } from "./editor/ui/panels/welcomeScreen.js";
import { initMenuBar, setProjectOpen } from "./editor/ui/toolbar/menuBar.js";
import { invoke } from "@tauri-apps/api/core";
import { t } from "./engine/i18n/i18n.js";
import { createViewport } from "./editor/viewport.js";
import { setLocale } from "./engine/i18n/i18n.js";
import { initTooltipSystem } from "./engine/ui/tooltip.js";
import { logger } from "./engine/core/logger.js";
import { initToastSystem } from "./engine/ui/toasts.js";

const appWindow = getCurrentWindow();

await logger.init();
await loadConfig();
applyConfigKeybinds();
setLocale(get("editor.locale") ?? "en");
initTooltipSystem();
initToastSystem();

let _activeViewport = null;

// ── DOM base ──────────────────────────────────────────────────────────────────
document.querySelector("#app").innerHTML = `
  <div id="toolbar">
    <div id="toolbar-left">
      <i data-lucide="box"></i>
      <span>${t("general.title")}</span>
    </div>
    <div id="toolbar-menus"></div>
    <div id="toolbar-window-controls">
      <button id="btn-minimize"><i data-lucide="minimize"></i></button>
      <button id="btn-maximize"><i data-lucide="maximize"></i></button>
      <button id="btn-close"><i data-lucide="x"></i></button>
    </div>
  </div>
  <div id="workspace"></div>
`;

createIcons({
  icons: { Box, Minimize, Maximize, X },
  attrs: { width: 14, height: 14, stroke: "#cccccc" },
});

// ── Ventana ───────────────────────────────────────────────────────────────────
document
  .getElementById("btn-minimize")
  .addEventListener("click", () => appWindow.minimize());
document
  .getElementById("btn-maximize")
  .addEventListener("click", () => appWindow.toggleMaximize());
document
  .getElementById("btn-close")
  .addEventListener("click", () => appWindow.close());

// ── Bloquear teclas de navegador ──────────────────────────────────────────────
onKeybind(["_BLOCK_FIND", "_BLOCK_PRINT", "_BLOCK_GOTO"], (e) =>
  e.preventDefault(),
);

// ── Workspace ─────────────────────────────────────────────────────────────────
const workspace = document.getElementById("workspace");

function onProjectReady(projectData) {
  if (_activeViewport) {
    _activeViewport.destroy();
    _activeViewport = null;
  }

  workspace.innerHTML = "";
  const viewportEl = document.createElement("div");
  viewportEl.id = "viewport";
  workspace.appendChild(viewportEl);

  createViewport(workspace, projectData).then((vp) => {
    _activeViewport = vp;
  });
}

// ── Menú bar ──────────────────────────────────────────────────────────────────
initMenuBar({
  onLoadProject: (projectData) => onProjectReady(projectData),

  onNewProject: () => {
    if (_activeViewport) {
      _activeViewport.destroy();
      _activeViewport = null;
    }
    workspace.innerHTML = "";
    createWelcomeScreen(workspace, onProjectReady, true);
  },

  onCloseProject: () => {
    if (_activeViewport) {
      _activeViewport.destroy();
      _activeViewport = null;
    }
    workspace.innerHTML = "";
    createWelcomeScreen(workspace, onProjectReady);
  },
});

// ── Arranque ──────────────────────────────────────────────────────────────────
const launchProject = await invoke("get_launch_project").catch(() => null);

if (launchProject) {
  try {
    const projectData = await invoke("load_project", {
      projectFile: launchProject,
    });
    onProjectReady(projectData);
  } catch {
    createWelcomeScreen(workspace, onProjectReady);
  }
} else {
  createWelcomeScreen(workspace, onProjectReady);
}
