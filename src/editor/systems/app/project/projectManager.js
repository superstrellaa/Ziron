import { invoke } from "@tauri-apps/api/core";
import { createViewport } from "../../../viewport.js";
import { createWelcomeScreen } from "../../../ui/panels/welcomeScreen.js";
import { initMenuBar, setProjectOpen } from "../../../ui/toolbar/menuBar.js";
import { Popup } from "../../../../engine/ui/popup/popupTypes.js";
import { logger } from "../../../../engine/core/logger.js";
import { getWorkspace, setToolbarProject } from "./workspaceManager.js";
import { EDITOR_VERSION } from "./versionManager.js";
import { Toast } from "../../../../engine/ui/toasts/toastTypes.js";
import { checkDirtyAndThen } from "../windowManager.js";

const LOG = "ProjectManager";

let _activeViewport = null;
let _opening = false;

function errorText(e) {
  return typeof e === "string" ? e : (e?.message ?? String(e));
}

function destroyActiveViewport() {
  if (!_activeViewport) return;
  try {
    _activeViewport.destroy();
  } catch (e) {
    logger.error(LOG, `Error while destroying the viewport | Error: ${e}`);
  }
  _activeViewport = null;
}

export function getActiveViewport() {
  return _activeViewport;
}

export async function openProjectFromFile(projectFile) {
  let proceed = false;
  await checkDirtyAndThen(
    () => {
      proceed = true;
    },
    { action: "continue" },
  );
  if (!proceed) return;

  let projectData;
  try {
    projectData = await invoke("load_project", { projectFile });
  } catch (e) {
    logger.error(
      LOG,
      `Failed to open project file ${projectFile} | Error: ${errorText(e)}`,
    );
    Toast.failedToOpenProject();
    Popup.error("Failed to open project: " + errorText(e));
    return;
  }

  logger.info(LOG, `Opened project "${projectData.name}"`);
  await checkVersionAndLoad(projectData);
}

export async function onProjectReady(projectData) {
  if (_opening) {
    logger.warn(
      LOG,
      `Ignored opening "${projectData?.name}": another project is already opening`,
    );
    return false;
  }
  _opening = true;

  try {
    destroyActiveViewport();
    setToolbarProject(projectData.name);

    const workspace = getWorkspace();
    workspace.innerHTML = "";

    _activeViewport = await createViewport(workspace, projectData);
    return true;
  } catch (e) {
    logger.error(
      LOG,
      `Failed to open project "${projectData?.name}" | Error: ${e?.stack ?? errorText(e)}`,
    );

    try {
      const workspace = getWorkspace();
      workspace.innerHTML = "";
      setToolbarProject(null);
      createWelcomeScreen(workspace, checkVersionAndLoad);
    } catch (uiError) {
      logger.error(
        LOG,
        `Could not restore the welcome screen | Error: ${uiError}`,
      );
    }

    Toast.failedToOpenProject();
    Popup.error("Failed to open project: " + errorText(e));
    return false;
  } finally {
    _opening = false;
  }
}

export async function checkVersionAndLoad(projectData, onCancel = null) {
  const projectVersion = projectData.ziron_version;

  if (projectVersion && projectVersion !== EDITOR_VERSION) {
    logger.warn(
      LOG,
      `Project version (${projectVersion}) does not match editor version (${EDITOR_VERSION})`,
    );
    const result = await Popup.versionMismatch(projectVersion, EDITOR_VERSION);

    if (result === "cancel") {
      if (!_activeViewport) {
        if (onCancel) {
          onCancel();
        } else {
          createWelcomeScreen(getWorkspace(), checkVersionAndLoad);
        }
      }
      return;
    }

    if (result === "continue") {
      try {
        await invoke("update_project_version", {
          projectFile: projectData._project_file,
          newVersion: EDITOR_VERSION,
        });
        logger.info(LOG, `Project version updated to ${EDITOR_VERSION}`);
      } catch (e) {
        logger.error(
          LOG,
          `Could not update project version | Error: ${errorText(e)}`,
        );
        Toast.updateProjectVersionError();
        Popup.error("Could not update project version: " + errorText(e));
      }
    }
  }

  await onProjectReady(projectData);
}

export async function closeWithDirtyCheck(then) {
  await checkDirtyAndThen(() => {
    destroyActiveViewport();
    setToolbarProject(null);
    then();
  });
}

export function initProjectMenuBar() {
  initMenuBar({
    onLoadProject: (projectFile) => openProjectFromFile(projectFile),

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
