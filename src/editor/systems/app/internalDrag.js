import { setDraggingModel, clearDraggingModel } from "./dragState.js";

const DRAG_THRESHOLD_PX = 4;

let _zones = [];
let _pending = null; // { payload, startX, startY }
let _active = null; // { payload, ghost }

function makeGhost(payload) {
  const ghost = document.createElement("div");
  ghost.id = "internal-drag-ghost";
  ghost.textContent = payload.name ?? "";
  document.body.appendChild(ghost);
  return ghost;
}

function moveGhost(ghost, x, y) {
  ghost.style.transform = `translate(${x + 14}px, ${y + 10}px)`;
}

function findZone(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  return _zones.find((z) => z.el.contains(el)) ?? null;
}

function onPointerMove(e) {
  if (_pending && !_active) {
    const dx = e.clientX - _pending.startX;
    const dy = e.clientY - _pending.startY;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    _active = { payload: _pending.payload, ghost: makeGhost(_pending.payload) };
    setDraggingModel(_active.payload);
    document.body.classList.add("internal-dragging");
  }

  if (!_active) return;

  moveGhost(_active.ghost, e.clientX, e.clientY);

  const zone = findZone(e.clientX, e.clientY);
  _zones.forEach((z) => z.el.classList.toggle("drag-zone-active", z === zone));
}

function onPointerUp(e) {
  window.removeEventListener("mousemove", onPointerMove);
  window.removeEventListener("mouseup", onPointerUp);

  if (_active) {
    const zone = findZone(e.clientX, e.clientY);
    _zones.forEach((z) => z.el.classList.remove("drag-zone-active"));
    _active.ghost.remove();

    if (zone) zone.onDrop(_active.payload, e.clientX, e.clientY);

    clearDraggingModel();
    document.body.classList.remove("internal-dragging");
  }

  _pending = null;
  _active = null;
}

export function beginInternalDrag(payload, e) {
  _pending = { payload, startX: e.clientX, startY: e.clientY };
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
}

export function registerDropZone(el, onDrop) {
  const zone = { el, onDrop };
  _zones.push(zone);
  return () => {
    _zones = _zones.filter((z) => z !== zone);
  };
}
