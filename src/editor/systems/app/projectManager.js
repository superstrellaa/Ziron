import { invoke } from "@tauri-apps/api/core";
import { createViewport } from "../../viewport.js";
import { createWelcomeScreen } from "../../ui/panels/welcomeScreen.js";
import { initMenuBar, setProjectOpen } from "../../ui/toolbar/menuBar.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";
import { logger } from "../../../engine/core/logger.js";
import { getWorkspace, setToolbarProject } from "./workspaceManager.js";
import { EDITOR_VERSION } from "./versionManager.js";

let _activeViewport = null;

export function getActiveViewport() {
  return _activeViewport;
}

export async function onProjectReady(projectData) {
  if (_activeViewport) {
    _activeViewport.destroy();
    _activeViewport = null;
  }

  setToolbarProject(projectData.name);

  const workspace = getWorkspace();
  workspace.innerHTML = "";

  _activeViewport = await createViewport(workspace, projectData);
}

export async function checkVersionAndLoad(projectData, onCancel = null) {
  const projectVersion = projectData.ziron_version;

  if (projectVersion && projectVersion !== EDITOR_VERSION) {
    logger.warn(
      "ProjectManager",
      `Project version (${projectVersion}) does not match editor version (${EDITOR_VERSION})`,
    );
    const result = await Popup.versionMismatch(projectVersion, EDITOR_VERSION);

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
          newVersion: EDITOR_VERSION,
        });
        logger.info(
          "ProjectManager",
          `Project version updated to ${EDITOR_VERSION}`,
        );
      } catch (e) {
        logger.warn("ProjectManager", `Could not update project version: ${e}`);
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
