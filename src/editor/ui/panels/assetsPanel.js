import { createIcons, Folder } from "lucide";
import { t } from "../../../engine/i18n/i18n.js";

export function createAssetsPanel(container, projectData) {
  const panel = document.createElement("div");
  panel.id = "assets-panel";

  panel.innerHTML = `
    <div id="assets-header">
      <i data-lucide="folder"></i>
      <span id="assets-title">${t("assets.header")}</span>
    </div>
    <div id="assets-content">
      <div id="assets-empty">${t("assets.empty")}</div>
    </div>
  `;

  container.appendChild(panel);

  createIcons({
    icons: { Folder },
    attrs: { width: 14, height: 14, stroke: "#cccccc" },
    root: panel,
  });

  return { panel };
}
