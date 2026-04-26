import "./styles.css";
import { createIcons, Box, Minimize, Maximize, X } from "lucide";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onKeybind } from "./editor/systems/keybinds";

// Crear la ventana actual antes de cosas
const appWindow = getCurrentWindow();

import { createViewport } from "./editor/viewport.js";
import { setLocale } from "./engine/i18n/i18n.js";
import { initTooltipSystem } from "./engine/ui/tooltip.js";
import { logger } from "./engine/core/logger.js";

await logger.init();

setLocale("en");
initTooltipSystem();

document.querySelector("#app").innerHTML = `
  <div id="toolbar">
    <div id="toolbar-left">
      <i data-lucide="box"></i>
      <span>ZIRON</span>
    </div>
    <div id="toolbar-window-controls">
      <button id="btn-minimize"><i data-lucide="minimize"></i></button>
      <button id="btn-maximize"><i data-lucide="maximize"></i></button>
      <button id="btn-close"><i data-lucide="x"></i></button>
    </div>
  </div>
  <div id="workspace">
    <div id="viewport"></div>
  </div>
`;

createIcons({
  icons: { Box, Minimize, Maximize, X },
  attrs: { width: 14, height: 14, stroke: "#cccccc" },
});

document
  .getElementById("btn-minimize")
  .addEventListener("click", () => appWindow.minimize());

document
  .getElementById("btn-maximize")
  .addEventListener("click", () => appWindow.toggleMaximize());

document
  .getElementById("btn-close")
  .addEventListener("click", () => appWindow.close());

// ==== Bloquear teclas de navegador tipicas de mierda ====
onKeybind(["_BLOCK_FIND", "_BLOCK_PRINT", "_BLOCK_GOTO"], (e) => {
  e.preventDefault();
});
// =========================================================

createViewport(document.getElementById("workspace"));
