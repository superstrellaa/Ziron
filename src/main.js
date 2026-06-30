import "./styles.css";
import { createIcons, Box, Minimize, Maximize, X } from "lucide";
import { loadConfig, get } from "./editor/systems/persistence/config.js";
import { applyConfigKeybinds } from "./editor/systems/input/keybinds.js";
import { setLocale } from "./engine/i18n/i18n.js";
import { t } from "./engine/i18n/i18n.js";
import { logger } from "./engine/core/logger.js";
import { initTooltipSystem } from "./engine/ui/tooltip.js";
import { initAssetPickerSystem } from "./engine/ui/assetPicker/assetPicker.js";
import { initToastSystem } from "./engine/ui/toasts/toasts.js";
import { initPopupSystem } from "./engine/ui/popup/popup.js";
import { invoke } from "@tauri-apps/api/core";
import { createWelcomeScreen } from "./editor/ui/panels/welcomeScreen.js";

import {
  initWorkspaceManager,
  getWorkspace,
} from "./editor/systems/app/workspaceManager.js";
import { initWindowManager } from "./editor/systems/app/windowManager.js";
import {
  initProjectMenuBar,
  checkVersionAndLoad,
  getActiveViewport,
} from "./editor/systems/app/projectManager.js";
import { Popup } from "./engine/ui/popup/popupTypes.js";

// ── Inicialización ────────────────────────────────────────────────────────────
await logger.init();
await loadConfig();
applyConfigKeybinds();
setLocale(get("editor.locale") ?? "en");
initTooltipSystem();
initAssetPickerSystem();
initToastSystem();
initPopupSystem();

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

// ── Sistemas ──────────────────────────────────────────────────────────────────
initWorkspaceManager();
initWindowManager(getActiveViewport);
initProjectMenuBar();

// ── Arranque ──────────────────────────────────────────────────────────────────
const launchProject = await invoke("get_launch_project").catch(() => null);

if (launchProject) {
  try {
    const projectData = await invoke("load_project", {
      projectFile: launchProject,
    });
    await checkVersionAndLoad(projectData, () => {
      createWelcomeScreen(getWorkspace(), checkVersionAndLoad);
    });
  } catch (err) {
    createWelcomeScreen(getWorkspace(), checkVersionAndLoad);
    logger.error(
      `Failed to load launch project from argument: ${launchProject} | Error: ${err}`,
    );
    Popup.error(
      "Failed to load project from argument: " +
        (typeof err === "string" ? err : (err?.message ?? String(err))),
    );
  }
} else {
  createWelcomeScreen(getWorkspace(), checkVersionAndLoad);
}
