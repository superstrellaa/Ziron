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

  // Bloquear cosas comunes de navegador que no busco
  onKeybind(["_BLOCK_FIND", "_BLOCK_PRINT", "_BLOCK_GOTO"], (e) =>
    e.preventDefault(),
  );

  // Bloquear CTRL A para evitar seleccionar cosas que no tocan
  onKeybind(["_BLOCK_SELECT_ALL"], (e) => {
    const tag = document.activeElement?.tagName;
    const isEditable =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      document.activeElement?.isContentEditable;
    if (!isEditable) e.preventDefault();
  });

  window.addEventListener("contextmenu", (e) => e.preventDefault()); // Helper general para quitar el menu nativo horrible
}
