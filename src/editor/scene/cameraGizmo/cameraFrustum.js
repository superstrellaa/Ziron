import * as THREE from "three";

const CIRCLE_SEGMENTS = 32;
const STRUT_COUNT = 8;

function vertexCount() {
  return CIRCLE_SEGMENTS * 2 * 2 + STRUT_COUNT * 2;
}

function computeRadius(fovDeg, dist) {
  const halfRad = THREE.MathUtils.degToRad(fovDeg) / 2;
  return Math.tan(halfRad) * dist;
}

export function createCameraFrustumHelper() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(vertexCount() * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
  });

  const line = new THREE.LineSegments(geometry, material);
  line.renderOrder = 999;
  line.frustumCulled = false;
  line.raycast = () => {}; // que no interfiera con la selección por click

  const _prev = { fov: null, near: null, far: null };

  function rebuild(fov, near, far) {
    const pos = geometry.attributes.position.array;
    let i = 0;

    const nearR = computeRadius(fov, near);
    const farR = computeRadius(fov, far);

    // círculo cercano
    for (let s = 0; s < CIRCLE_SEGMENTS; s++) {
      const a0 = (s / CIRCLE_SEGMENTS) * Math.PI * 2;
      const a1 = ((s + 1) / CIRCLE_SEGMENTS) * Math.PI * 2;
      pos[i++] = Math.cos(a0) * nearR;
      pos[i++] = Math.sin(a0) * nearR;
      pos[i++] = -near;
      pos[i++] = Math.cos(a1) * nearR;
      pos[i++] = Math.sin(a1) * nearR;
      pos[i++] = -near;
    }

    // círculo lejano
    for (let s = 0; s < CIRCLE_SEGMENTS; s++) {
      const a0 = (s / CIRCLE_SEGMENTS) * Math.PI * 2;
      const a1 = ((s + 1) / CIRCLE_SEGMENTS) * Math.PI * 2;
      pos[i++] = Math.cos(a0) * farR;
      pos[i++] = Math.sin(a0) * farR;
      pos[i++] = -far;
      pos[i++] = Math.cos(a1) * farR;
      pos[i++] = Math.sin(a1) * farR;
      pos[i++] = -far;
    }

    for (let s = 0; s < STRUT_COUNT; s++) {
      const a = (s / STRUT_COUNT) * Math.PI * 2;
      pos[i++] = Math.cos(a) * nearR;
      pos[i++] = Math.sin(a) * nearR;
      pos[i++] = -near;
      pos[i++] = Math.cos(a) * farR;
      pos[i++] = Math.sin(a) * farR;
      pos[i++] = -far;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();

    _prev.fov = fov;
    _prev.near = near;
    _prev.far = far;
  }

  function updateFromComponents(cameraComponent) {
    const fov = cameraComponent?.fov ?? 50;
    const near = cameraComponent?.near ?? 0.1;
    const far = cameraComponent?.far ?? 1000;

    if (fov === _prev.fov && near === _prev.near && far === _prev.far) return;
    rebuild(fov, near, far);
  }

  rebuild(50, 0.1, 1000); // para que no salga vacío en el primer frame

  return { object: line, updateFromComponents };
}
