import * as THREE from "three";

let _cachedTexture = null;

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function buildCameraIconTexture(size = 64) {
  if (_cachedTexture) return _cachedTexture;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const s = size / 24;
  const c = size / 2;

  const grad = ctx.createRadialGradient(c, c, size * 0.1, c, c, size * 0.55);
  grad.addColorStop(0, "rgba(255,255,255,0.22)");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2 * s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  roundRectPath(ctx, 2 * s, 6 * s, 14 * s, 12 * s, 2 * s);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(16 * s, 13 * s);
  ctx.lineTo(21.22 * s, 16.48 * s);
  ctx.lineTo(22 * s, 16.07 * s);
  ctx.lineTo(22 * s, 7.87 * s);
  ctx.lineTo(21.25 * s, 7.44 * s);
  ctx.lineTo(16 * s, 10.5 * s);
  ctx.stroke();

  _cachedTexture = new THREE.CanvasTexture(canvas);
  return _cachedTexture;
}

export function createCameraGizmoMesh() {
  const group = new THREE.Group();

  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  group.add(hitMesh);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: buildCameraIconTexture(64),
      depthTest: true,
      sizeAttenuation: true,
    }),
  );
  sprite.scale.set(0.6, 0.6, 0.6);
  sprite.layers.set(1); // capa 1: gizmo de cámara (excluida de la preview)
  group.add(sprite);

  return group;
}
