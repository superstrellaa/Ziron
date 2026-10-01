import { t } from "../../../engine/i18n/i18n.js";
import { createIcons, Video } from "lucide";

export function createCameraPreviewPanel(container) {
  const panel = document.createElement("div");
  panel.id = "camera-preview-panel";
  panel.style.display = "none";

  panel.innerHTML = `
    <div id="cp-header">
      <i data-lucide="video"></i>
      <span id="cp-title">${t("viewport.cameraPreview")}</span>
    </div>
    <div id="cp-canvas-wrap"></div>
  `;
  container.appendChild(panel);

  createIcons({
    icons: { Video },
    attrs: { width: 12, height: 12, stroke: "#6b7280" },
    root: panel,
  });

  const canvasWrap = panel.querySelector("#cp-canvas-wrap");

  return {
    element: panel,
    canvasWrap,
    show: () => {
      panel.style.display = "flex";
    },
    hide: () => {
      panel.style.display = "none";
    },
  };
}
