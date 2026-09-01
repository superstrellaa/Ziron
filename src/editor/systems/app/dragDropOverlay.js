import { getCurrentWebview } from "@tauri-apps/api/webview";
import { createIcons, FilePlusCorner } from "lucide";
import { t } from "../../../engine/i18n/i18n.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";
import { getActiveViewport } from "./projectManager.js";
import { isSettingsOpen } from "../../ui/panels/settingsPanel.js";
import { logger } from "../../../engine/core/logger.js";

const MODEL_EXTENSIONS = ["glb", "gltf", "obj", "fbx"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const SUPPORTED_EXTENSIONS = [...MODEL_EXTENSIONS, ...IMAGE_EXTENSIONS];

const DUPLICATE_DROP_WINDOW_MS = 300;

function getExt(path) {
  const idx = path.lastIndexOf(".");
  return idx >= 0 ? path.slice(idx + 1).toLowerCase() : "";
}

function isSupportedFile(path) {
  return SUPPORTED_EXTENSIONS.includes(getExt(path));
}

function fileNameFromPath(path) {
  return path.split(/[/\\]/).pop() ?? path;
}

function canShowOverlay() {
  return getActiveViewport() != null && !isSettingsOpen();
}

let _overlay = null;
let _lastDropAt = 0;

function buildOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "drop-overlay";
  overlay.innerHTML = `
    <div id="drop-overlay-icon"><i data-lucide="file-plus-corner"></i></div>
    <div id="drop-overlay-title">${t("dropOverlay.title")}</div>
    <div id="drop-overlay-subtitle">${t("dropOverlay.subtitle")}</div>
  `;
  document.body.appendChild(overlay);

  createIcons({
    icons: { FilePlusCorner },
    attrs: { width: 96, height: 96, stroke: "#a78bfa" },
    root: overlay,
  });

  return overlay;
}

function showOverlay() {
  _overlay.classList.add("drop-overlay-visible");
}

function hideOverlay() {
  _overlay.classList.remove("drop-overlay-visible");
}

function handleDrop(paths) {
  for (const path of paths) {
    if (!isSupportedFile(path)) {
      Popup.unsupportedFileType(fileNameFromPath(path));
      continue;
    } else {
      //TODO: obtener la carpeta abierta en el explorador de assets e importar el comando al archivo y aaaahgj
    }
  }
}

export async function initDragDropOverlay() {
  _overlay = buildOverlay();

  await getCurrentWebview().onDragDropEvent((event) => {
    const { type } = event.payload;

    if (type === "enter" || type === "over") {
      if (canShowOverlay()) showOverlay();
      return;
    }

    if (type === "drop") {
      logger.debug(
        "DragDropOverlay",
        `Drop event received with paths: ${event.payload.paths?.join(", ")}`,
      );
      hideOverlay();
      if (!canShowOverlay()) return;

      const now = performance.now();
      if (now - _lastDropAt < DUPLICATE_DROP_WINDOW_MS) return;
      _lastDropAt = now;

      handleDrop(event.payload.paths ?? []);
      return;
    }

    hideOverlay();
  });
}
