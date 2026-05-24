import { getCurrentWindow } from "@tauri-apps/api/window";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";
import { onKeybind } from "../input/keybinds.js";

const appWindow = getCurrentWindow();

let _getActiveViewport = null;

export function initWindowManager(getActiveViewport) {
  _getActiveViewport = getActiveViewport;

  document
    .getElementById("btn-minimize")
    .addEventListener("click", () => appWindow.minimize());
  document
    .getElementById("btn-maximize")
    .addEventListener("click", () => appWindow.toggleMaximize());

  document.getElementById("btn-close").addEventListener("click", async () => {
    await checkDirtyAndThen(() => appWindow.close());
  });

  onKeybind(["_BLOCK_FIND", "_BLOCK_PRINT", "_BLOCK_GOTO"], (e) =>
    e.preventDefault(),
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

// Exportada para que settingsPanel y otros puedan usarla
export async function checkDirtyAndThen(fn) {
  const vp = _getActiveViewport?.();
  if (vp?.isDirty()) {
    const result = await Popup.unsavedScene();
    if (result === "cancel") return;
    if (result === "save") await vp.triggerSave();
  }
  await fn();
}
