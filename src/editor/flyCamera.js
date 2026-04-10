import * as THREE from "three";

export function createFlyCamera(camera, domElement) {
  const state = {
    isFlying: false,
    enabled: true,
    lastX: 0,
    lastY: 0,
    yaw: 0,
    pitch: 0,
    keys: { w: false, a: false, s: false, d: false, q: false, e: false },
  };

  const LOOK_SPEED = 0.003;
  const FLY_SPEED = 0.08;
  const MAX_PITCH = Math.PI / 2 - 0.01;

  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  state.yaw = euler.y;
  state.pitch = euler.x;

  function onMouseDown(e) {
    if (e.button !== 2) return;
    if (!state.enabled) return;
    e.preventDefault();
    state.isFlying = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    domElement.classList.add("orbiting");
  }

  function onMouseMove(e) {
    if (!state.isFlying) return;
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    state.yaw -= dx * LOOK_SPEED;
    state.pitch -= dy * LOOK_SPEED;
    state.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, state.pitch));
  }

  function onMouseUp(e) {
    if (e.button !== 2) return;
    state.isFlying = false;
    for (const k in state.keys) state.keys[k] = false;
    domElement.classList.remove("orbiting");
  }

  function onWheel(e) {
    e.preventDefault();
    if (!state.enabled) return;
    const _fwd = new THREE.Vector3();
    camera.getWorldDirection(_fwd);
    camera.position.addScaledVector(_fwd, -e.deltaY * 0.01);
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  function onKeyDown(e) {
    if (!state.isFlying) return;
    const k = e.key.toLowerCase();
    if (k in state.keys) {
      e.preventDefault();
      state.keys[k] = true;
    }
  }

  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (k in state.keys) state.keys[k] = false;
  }

  domElement.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  domElement.addEventListener("wheel", onWheel, { passive: false });
  domElement.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _move = new THREE.Vector3();

  function update() {
    const q = new THREE.Quaternion();
    const qYaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      state.yaw,
    );
    const qPitch = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      state.pitch,
    );
    q.multiplyQuaternions(qYaw, qPitch);
    camera.quaternion.copy(q);

    const { w, a, s, d, q: qKey, e } = state.keys;
    if (w || a || s || d || qKey || e) {
      camera.getWorldDirection(_forward);
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      _up.setFromMatrixColumn(camera.matrixWorld, 1);

      _move.set(0, 0, 0);
      if (w) _move.addScaledVector(_forward, FLY_SPEED);
      if (s) _move.addScaledVector(_forward, -FLY_SPEED);
      if (d) _move.addScaledVector(_right, FLY_SPEED);
      if (a) _move.addScaledVector(_right, -FLY_SPEED);
      if (e) _move.addScaledVector(_up, FLY_SPEED);
      if (qKey) _move.addScaledVector(_up, -FLY_SPEED);

      camera.position.add(_move);
    }
  }

  return {
    update,
    set enabled(v) {
      state.enabled = v;
    },
    get enabled() {
      return state.enabled;
    },
  };
}
