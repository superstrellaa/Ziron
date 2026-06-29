import { invoke } from "@tauri-apps/api/core";
import {
  createIcons,
  File,
  Save,
  FileUp,
  Plus,
  CornerDownLeft,
  Settings,
} from "lucide";
import { t } from "../../../engine/i18n/i18n.js";
import { logger } from "../../../engine/core/logger.js";
import { openSettings } from "../panels/settingsPanel.js";
import { onKeybind } from "../../systems/input/keybinds.js";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";

let _onLoadProject = null;
let _onNewProject = null;
let _onCloseProject = null;
let _onSave = null;
let _hasProject = false;

export function initMenuBar({ onLoadProject, onNewProject, onCloseProject }) {
  _onLoadProject = onLoadProject;
  _onNewProject = onNewProject;
  _onCloseProject = onCloseProject;

  const menusEl = document.getElementById("toolbar-menus");
  menusEl.innerHTML = `
  <div class="toolbar-menu" id="menu-file">
    <button class="toolbar-menu-btn" id="menu-file-btn">
      <i data-lucide="file"></i>
      ${t("toolbar.file")}
    </button>
    <div class="toolbar-dropdown" id="menu-file-dropdown">
      <button class="toolbar-dropdown-item" id="menu-new-project">
        <i data-lucide="plus"></i>
        ${t("toolbar.newProject")}
      </button>
      <button class="toolbar-dropdown-item" id="menu-load">
        <i data-lucide="file-up"></i>
        ${t("toolbar.load")}
      </button>
      <div class="toolbar-dropdown-separator"></div>
      <button class="toolbar-dropdown-item" id="menu-save" disabled>
        <i data-lucide="save"></i>
        ${t("toolbar.save")}
      </button>
      <button class="toolbar-dropdown-item" id="menu-close-project" disabled>
        <i data-lucide="corner-down-left"></i>
        ${t("toolbar.closeProject")}
      </button>
      <div class="toolbar-dropdown-separator"></div>
      <button class="toolbar-dropdown-item" id="menu-settings">
        <i data-lucide="settings"></i>
        ${t("toolbar.settings")}
      </button>
    </div>
  </div>
`;

  createIcons({
    icons: { File, Save, FileUp, Plus, CornerDownLeft, Settings },
    attrs: { width: 14, height: 14, stroke: "#cccccc" },
    root: menusEl,
  });

  const fileBtn = document.getElementById("menu-file-btn");
  const fileDropdown = document.getElementById("menu-file-dropdown");

  function closeMenu() {
    fileDropdown.classList.remove("open");
    fileBtn.classList.remove("active");
  }

  fileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = fileDropdown.classList.toggle("open");
    fileBtn.classList.toggle("active", isOpen);
  });

  document.addEventListener("click", closeMenu);

  document.getElementById("menu-new-project").addEventListener("click", () => {
    closeMenu();
    _onNewProject?.();
  });

  document.getElementById("menu-load").addEventListener("click", async () => {
    closeMenu();
    const projectFile = await invoke("pick_project_file").catch(() => null);
    if (!projectFile) return;
    try {
      const projectData = await invoke("load_project", { projectFile });
      logger.info("Menu", `Opened project "${projectData.name}"`);
      _onLoadProject?.(projectData);
    } catch (e) {
      logger.warn("Menu", `Failed to open project: ${e}`);
      Toast.failedToOpenProject();
      Popup.error(
        "Failed to open project: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  });

  document.getElementById("menu-save").addEventListener("click", () => {
    if (!_hasProject || !_onSave) return;
    closeMenu();
    _onSave();
  });

  document
    .getElementById("menu-close-project")
    .addEventListener("click", () => {
      if (!_hasProject) return;
      closeMenu();
      _onCloseProject?.();
    });

  document.getElementById("menu-settings").addEventListener("click", () => {
    closeMenu();
    openSettings();
  });

  onKeybind("OPEN_SETTINGS", () => {
    openSettings();
  });
}

export function setProjectOpen(open, onSave = null) {
  _hasProject = open;
  _onSave = onSave;

  const saveBtn = document.getElementById("menu-save");
  const closeBtn = document.getElementById("menu-close-project");
  if (saveBtn) saveBtn.disabled = !open;
  if (closeBtn) closeBtn.disabled = !open;
}
