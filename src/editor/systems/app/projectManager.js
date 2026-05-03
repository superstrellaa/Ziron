import { invoke } from "@tauri-apps/api/core";
import { createViewport } from "../../viewport.js";
import { createWelcomeScreen } from "../../ui/panels/welcomeScreen.js";
import { initMenuBar, setProjectOpen } from "../../ui/toolbar/menuBar.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";
import { logger } from "../../../engine/core/logger.js";
import { getWorkspace, setToolbarProject } from "./workspaceManager.js";
import { ENGINE_VERSION } from "./versionManager.js";

let _activeViewport = null;

export function getActiveViewport() {
  return _activeViewport;
}

export function onProjectReady(projectData) {
  if (_activeViewport) {
    _activeViewport.destroy();
    _activeViewport = null;
  }

  setToolbarProject(projectData.name);

  const workspace = getWorkspace();
  workspace.innerHTML = "";
  const viewportEl = document.createElement("div");
  viewportEl.id = "viewport";
  workspace.appendChild(viewportEl);

  createViewport(workspace, projectData).then((vp) => {
    _activeViewport = vp;
  });
}

export async function checkVersionAndLoad(projectData, onCancel = null) {
  const projectVersion = projectData.ziron_version;

  if (projectVersion && projectVersion !== ENGINE_VERSION) {
    const result = await Popup.versionMismatch(projectVersion, ENGINE_VERSION);

    if (result === "cancel") {
      if (!_activeViewport) {
        onCancel?.() ??
          createWelcomeScreen(getWorkspace(), checkVersionAndLoad);
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

export async function closeWithDirtyCheck(then) {
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

export function initProjectMenuBar() {
  initMenuBar({
    onLoadProject: (projectData) => checkVersionAndLoad(projectData),

    onNewProject: () =>
      closeWithDirtyCheck(() => {
        getWorkspace().innerHTML = "";
        createWelcomeScreen(getWorkspace(), checkVersionAndLoad, true);
      }),

    onCloseProject: () =>
      closeWithDirtyCheck(() => {
        getWorkspace().innerHTML = "";
        createWelcomeScreen(getWorkspace(), checkVersionAndLoad);
      }),
  });
}
