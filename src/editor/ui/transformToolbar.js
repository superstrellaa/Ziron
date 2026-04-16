import {
  createIcons,
  Move,
  RefreshCcwDot,
  Scale3d,
  TextAlignCenter,
} from "lucide";
import { t } from "../../engine/i18n/i18n.js";
import { logger } from "../../engine/core/logger.js";

const MODES = [
  { key: "translate", icon: "move" },
  { key: "rotate", icon: "refresh-ccw-dot" },
  { key: "scale", icon: "scale-3d" },
];

const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const MARGIN = 12;

export function createTransformToolbar(container, gizmo, flyControls) {
  let currentMode = "translate";
  let currentCorner = "top-left";

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

  widget.querySelectorAll(".tt-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (document.activeElement.tagName === "INPUT") return;
    if (gizmo.isDragging()) return;
    if (flyControls.isFlying()) return;

    const keyMap = { w: "translate", e: "rotate", r: "scale" };
    const newMode = keyMap[e.key.toLowerCase()];
    if (newMode) setMode(newMode);
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
      const idx = CORNERS.indexOf(currentCorner);
      currentCorner = CORNERS[(idx + 1) % CORNERS.length];
      applyCorner(currentCorner);
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

    currentCorner = `${onTop ? "top" : "bottom"}-${onLeft ? "left" : "right"}`;

    applyCorner(currentCorner);
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

  return widget;
}
