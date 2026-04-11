import "./style.css";
import { createIcons, Box, Minimize, Maximize, X } from "lucide";
import { createViewport } from "./editor/viewport.js";

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
  <div id="viewport"></div>
`;

createIcons({
  icons: { Box, Minimize, Maximize, X },
  attrs: { width: 14, height: 14, stroke: "currentColor" },
});

document
  .getElementById("btn-minimize")
  .addEventListener("click", () => window.ziron.minimize());
document
  .getElementById("btn-maximize")
  .addEventListener("click", () => window.ziron.maximize());
document
  .getElementById("btn-close")
  .addEventListener("click", () => window.ziron.close());

createViewport(document.getElementById("viewport"));
