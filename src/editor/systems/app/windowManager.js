import { getCurrentWindow } from "@tauri-apps/api/window";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";
import { logger } from "../../../engine/core/logger.js";
import { onKeybind } from "../input/keybinds.js";

const LOG = "WindowManager";
const appWindow = getCurrentWindow();

let _getActiveViewport = null;
let _checkInProgress = false;
let _closeGuardInstalled = false;

function runWindowAction(name, action) {
  Promise.resolve()
    .then(action)
    .catch((e) =>
      logger.error(LOG, `Window action "${name}" failed | Error: ${e}`),
    );
}

export async function initWindowManager(getActiveViewport) {
  _getActiveViewport = getActiveViewport;

  document
    .getElementById("btn-minimize")
    .addEventListener("click", () =>
      runWindowAction("minimize", () => appWindow.minimize()),
    );
  document
    .getElementById("btn-maximize")
    .addEventListener("click", () =>
      runWindowAction("toggleMaximize", () => appWindow.toggleMaximize()),
    );

  document.getElementById("btn-close").addEventListener("click", () =>
    runWindowAction("close", () =>
      _closeGuardInstalled
        ? appWindow.close() // dispara onCloseRequested, que hace la comprobación
        : checkDirtyAndThen(() => appWindow.destroy(), { action: "close" }),
    ),
  );

  try {
    await appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await checkDirtyAndThen(() => appWindow.destroy(), { action: "close" });
    });
    _closeGuardInstalled = true;
  } catch (e) {
    logger.error(
      LOG,
      `Could not install the close guard; only the toolbar button will check for unsaved changes | Error: ${e}`,
    );
  }

  onKeybind(
    [
      "_BLOCK_FIND",
      "_BLOCK_PRINT",
      "_BLOCK_GOTO",
      "_BLOCK_DOWNLOADS",
      "_BLOCK_DEVTOOLS_SEARCH",
      "_BLOCK_CARET_BROWSING",
    ],
    (e) => e.preventDefault(),
  );

  onKeybind(["_BLOCK_SELECT_ALL"], (e) => {
    const tag = document.activeElement?.tagName;
    const isEditable =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      document.activeElement?.isContentEditable;
    if (!isEditable) e.preventDefault();
  });

  window.addEventListener("contextmenu", (e) => e.preventDefault());
}

export async function checkDirtyAndThen(fn, { action = "continue" } = {}) {
  if (_checkInProgress) {
    logger.debug(
      LOG,
      `Ignored "${action}": another unsaved-changes check is in progress`,
    );
    return false;
  }
  _checkInProgress = true;

  try {
    const vp = _getActiveViewport?.();
    if (vp?.isDirty()) {
      const result = await Popup.unsavedScene(action);

      if (result === "save") {
        const saved = await vp.triggerSave();
        if (saved === false) {
          logger.warn(LOG, `Aborted "${action}": the scene could not be saved`);
          return false; // el error de guardado ya se mostró al usuario
        }
      } else if (result !== "discard") {
        return false;
      }
    }

    await fn();
    return true;
  } catch (e) {
    logger.error(LOG, `"${action}" failed | Error: ${e}`);
    Toast.generalError();
    return false;
  } finally {
    _checkInProgress = false;
  }
}
