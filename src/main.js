import "./styles.css";
import { createIcons, Box, Minimize, Maximize, X } from "lucide";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
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
import { initToastSystem } from "./engine/ui/toasts/toasts.js";
import { initPopupSystem } from "./engine/ui/popup/popup.js";
import { Popup } from "./engine/ui/popup/popupTypes.js";

const appWindow = getCurrentWindow();

await logger.init();
await loadConfig();
applyConfigKeybinds();
setLocale(get("editor.locale") ?? "en");
initTooltipSystem();
initToastSystem();
initPopupSystem();

let _activeViewport = null;

export const ENGINE_VERSION = await getVersion();
logger.info("Main", `ZIRON Editor v${ENGINE_VERSION} starting...`);

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

document.getElementById("btn-close").addEventListener("click", async () => {
  if (_activeViewport?.isDirty()) {
    const result = await Popup.unsavedScene();
    if (result === "cancel") return;
    if (result === "save") await _activeViewport.triggerSave();
  }
  appWindow.close();
});

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

  setToolbarProject(projectData.name);

  workspace.innerHTML = "";
  const viewportEl = document.createElement("div");
  viewportEl.id = "viewport";
  workspace.appendChild(viewportEl);

  createViewport(workspace, projectData).then((vp) => {
    _activeViewport = vp;
  });
}

async function checkVersionAndLoad(projectData, onCancel = null) {
  const projectVersion = projectData.ziron_version;

  if (projectVersion && projectVersion !== ENGINE_VERSION) {
    const result = await Popup.versionMismatch(projectVersion, ENGINE_VERSION);

    if (result === "cancel") {
      if (!_activeViewport) {
        onCancel?.() ?? createWelcomeScreen(workspace, checkVersionAndLoad);
      }
      return;
    }

    if (result === "continue") {
      try {
        await invoke("update_project_version", {
          projectFile: projectData._project_file,
          newVersion: ENGINE_VERSION,
        });
        logger.info("Main", `Project version updated to ${ENGINE_VERSION}`);
      } catch (e) {
        logger.warn("Main", `Could not update project version: ${e}`);
      }
    }
  }

  onProjectReady(projectData);
}

// ── Menú bar ──────────────────────────────────────────────────────────────────
async function closeWithDirtyCheck(then) {
  if (_activeViewport?.isDirty()) {
    const result = await Popup.unsavedScene();
    if (result === "cancel") return;
    if (result === "save") await _activeViewport.triggerSave();
  }
  if (_activeViewport) {
    _activeViewport.destroy();
    _activeViewport = null;
  }
  setToolbarProject(null);
  then();
}

initMenuBar({
  onLoadProject: (projectData) => checkVersionAndLoad(projectData),

  onNewProject: () =>
    closeWithDirtyCheck(() => {
      workspace.innerHTML = "";
      createWelcomeScreen(workspace, checkVersionAndLoad, true);
    }),

  onCloseProject: () =>
    closeWithDirtyCheck(() => {
      workspace.innerHTML = "";
      createWelcomeScreen(workspace, checkVersionAndLoad);
    }),
});

const toolbarTitle = document.querySelector("#toolbar-left span");

function setToolbarProject(projectName = null) {
  if (projectName) {
    toolbarTitle.textContent = `${t("general.title")} — ${projectName.toUpperCase()}`;
  } else {
    toolbarTitle.textContent = t("general.title");
  }
}

// ── Arranque ──────────────────────────────────────────────────────────────────
const launchProject = await invoke("get_launch_project").catch(() => null);

if (launchProject) {
  try {
    const projectData = await invoke("load_project", {
      projectFile: launchProject,
    });
    await checkVersionAndLoad(projectData, () => {
      createWelcomeScreen(workspace, checkVersionAndLoad);
    });
  } catch {
    createWelcomeScreen(workspace, checkVersionAndLoad);
  }
} else {
  createWelcomeScreen(workspace, checkVersionAndLoad);
}
