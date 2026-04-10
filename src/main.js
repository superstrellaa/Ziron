import "./style.css";
import { createViewport } from "./editor/viewport.js";

document.querySelector("#app").innerHTML = `
  <div id="toolbar">
    <span>ZIRON</span>
  </div>
  <div id="viewport"></div>
`;

createViewport(document.getElementById("viewport"));
