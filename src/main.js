import "./style.css";
import { createIcons } from "lucide";
import { createViewport } from "./editor/viewport.js";

document.querySelector("#app").innerHTML = `
  <div id="toolbar">
    <i data-lucide="box"></i>
    <span>ZIRON</span>
  </div>
  <div id="viewport"></div>
`;

/* createIcons({
  icons: {  },
  attrs: {
    width: 16,
    height: 16,
    stroke: "#a78bfa",
  },
});
 */
createViewport(document.getElementById("viewport"));
