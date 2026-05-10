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
    const vp = _getActiveViewport?.();
    if (vp?.isDirty()) {
      const result = await Popup.unsavedScene();
      if (result === "cancel") return;
      if (result === "save") await vp.triggerSave();
    }
    appWindow.close();
  });

  onKeybind(["_BLOCK_FIND", "_BLOCK_PRINT", "_BLOCK_GOTO"], (e) =>
    e.preventDefault(),
  );

  window.addEventListener("contextmenu", (e) => e.preventDefault()); // Helper general para quitar el menu nativo horrible
}
