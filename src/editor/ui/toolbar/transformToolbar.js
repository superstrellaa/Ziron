import {
  createIcons,
  Move,
  RefreshCcwDot,
  Scale3d,
  TextAlignCenter,
} from "lucide";
import { t } from "../../../engine/i18n/i18n.js";
import { logger } from "../../../engine/core/logger.js";
import { onKeybind } from "../../systems/input/keybinds.js";
import { get, set } from "../../systems/persistence/config.js";

const MODES = [
  { key: "translate", icon: "move" },
  { key: "rotate", icon: "refresh-ccw-dot" },
  { key: "scale", icon: "scale-3d" },
];

const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const MARGIN = 12;
const FALLBACK_CORNER = "top-left";

const CONFIG_KEY = "ui.transform_toolbar_corner";
const DEFAULT_CORNER = "top-left";

function loadSavedCorner() {
  const saved = get(CONFIG_KEY);
  return CORNERS.includes(saved) ? saved : DEFAULT_CORNER;
}

function persistCorner(corner) {
  set(CONFIG_KEY, corner);
}

export function createTransformToolbar(container, gizmo, flyControls) {
  let currentMode = "translate";
  let currentCorner = loadSavedCorner();

  let lockedCorner = null;
  let preLockCorner = null;

  let dragging = false;
  let didMove = false;

  let startX = 0;
  let startY = 0;

  let offsetX = 0;
  let offsetY = 0;

  const widget = document.createElement("div");
  widget.id = "transform-toolbar";
  widget.innerHTML = `
    <div id="tt-handle" data-tooltip="${t("transform.handle")}">
      <i data-lucide="text-align-center"></i>
    </div>
    <div id="tt-buttons">
      ${MODES.map(
        (m) => `
        <button class="tt-btn${m.key === "translate" ? " active" : ""}"
            data-mode="${m.key}"
            data-tooltip="${t(`transform.${m.key}`)}">
            <i data-lucide="${m.icon}"></i>
        </button>
      `,
      ).join("")}
    </div>
  `;
  container.appendChild(widget);

  createIcons({
    icons: { Move, RefreshCcwDot, Scale3d, TextAlignCenter },
    attrs: { width: 15, height: 15, stroke: "currentColor" },
    root: widget,
  });

  applyCorner(currentCorner, false);

  const resizeObserver = new ResizeObserver(() => {
    applyCorner(currentCorner, false);
  });
  resizeObserver.observe(container);

  widget.querySelectorAll(".tt-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  onKeybind(["TOOL_TRANSLATE", "TOOL_ROTATE", "TOOL_SCALE"], (e, action) => {
    if (e.repeat) return;
    if (document.activeElement.tagName === "INPUT") return;
    if (gizmo.isDragging()) return;
    if (flyControls.isFlying()) return;

    const modeMap = {
      TOOL_TRANSLATE: "translate",
      TOOL_ROTATE: "rotate",
      TOOL_SCALE: "scale",
    };
    setMode(modeMap[action]);
  });

  const handle = widget.querySelector("#tt-handle");

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();

    dragging = true;
    didMove = false;

    startX = e.clientX;
    startY = e.clientY;

    widget.style.transition = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didMove = true;
    }

    widget.style.transform = `translate(${offsetX + dx}px, ${offsetY + dy}px)`;
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;

    dragging = false;

    widget.style.transition = "transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)";

    if (!didMove) {
      let idx = CORNERS.indexOf(currentCorner);
      let next;
      do {
        idx = (idx + 1) % CORNERS.length;
        next = CORNERS[idx];
      } while (next === lockedCorner);

      currentCorner = next;
      preLockCorner = null;
      applyCorner(currentCorner);
      persistCorner(currentCorner);
      return;
    }

    // Detectar esquina más cercana a la mierda esta
    const rect = widget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const W = container.clientWidth;
    const H = container.clientHeight;

    const onLeft = cx < W / 2;
    const onTop = cy < H / 2;

    let detected = `${onTop ? "top" : "bottom"}-${onLeft ? "left" : "right"}`;
    if (detected === lockedCorner) detected = FALLBACK_CORNER;

    currentCorner = detected;
    preLockCorner = null;
    applyCorner(currentCorner);
    persistCorner(currentCorner);
  });

  function applyCorner(corner, animate = true) {
    const [v, h] = corner.split("-");

    const widgetRect = widget.getBoundingClientRect();

    const x =
      h === "left" ? MARGIN : container.clientWidth - widgetRect.width - MARGIN;

    const y =
      v === "top"
        ? MARGIN
        : container.clientHeight - widgetRect.height - MARGIN;

    offsetX = x;
    offsetY = y;

    if (!animate) {
      widget.style.transition = "none";
    }

    widget.style.transform = `translate(${x}px, ${y}px)`;
  }

  function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    gizmo.gizmo.setMode(currentMode);
    widget.querySelectorAll(".tt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === currentMode);
    });
    logger.info("TransformToolbar", `Mode changed to "${currentMode}"`);
  }

  function lockCorner(corner) {
    lockedCorner = corner;
    if (currentCorner === corner) {
      preLockCorner = currentCorner;
      currentCorner = FALLBACK_CORNER;
      applyCorner(currentCorner); // animado por defecto
    }
  }

  function unlockCorner() {
    lockedCorner = null;
    if (preLockCorner !== null) {
      currentCorner = preLockCorner;
      preLockCorner = null;
      applyCorner(currentCorner);
    }
  }

  return { element: widget, lockCorner, unlockCorner };
}
