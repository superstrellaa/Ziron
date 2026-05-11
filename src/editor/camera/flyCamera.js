import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";

export function createFlyCamera(camera, domElement) {
  const state = {
    isFlying: false,
    flyStarted: false,
    mouseDownTime: null,
    mouseDownX: 0,
    mouseDownY: 0,
    mouseDownValid: false,
    enabled: true,
    shift: false,
    yaw: 0,
    pitch: 0,
    keys: { w: false, a: false, s: false, d: false, q: false, e: false },
    deltaX: 0,
    deltaY: 0,
    lastX: 0,
    lastY: 0,
    recentering: false,
  };

  const LOOK_SPEED = 0.003;
  const FLY_SPEED = 0.08;
  const FLY_SPEED_FAST = 0.28;
  const RECENTER_MARGIN = 80;

  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  state.yaw = euler.y;
  state.pitch = euler.x;

  function stopFlying() {
    state.isFlying = false;
    state.flyStarted = false;
    state.deltaX = 0;
    state.deltaY = 0;
    state.shift = false;
    state.recentering = false;
    for (const k in state.keys) state.keys[k] = false;
    domElement.classList.remove("cursor-none");
    invoke("stop_fly");
  }

  async function onMouseDown(e) {
    if (e.button !== 2) return;
    if (!state.enabled) return;
    const rect = domElement.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) {
      state.mouseDownValid = false;
      return;
    }

    e.preventDefault();
    state.shift = e.shiftKey;
    state.mouseDownValid = true;
    state.mouseDownTime = performance.now();
    state.mouseDownX = e.clientX;
    state.mouseDownY = e.clientY;
    state.flyStarted = false;
  }

  function onMouseMove(e) {
    if (e.buttons !== 2) return;
    if (!state.mouseDownValid) return;

    if (!state.flyStarted) {
      const elapsed = performance.now() - (state.mouseDownTime ?? 0);
      const dx = Math.abs(e.clientX - state.mouseDownX);
      const dy = Math.abs(e.clientY - state.mouseDownY);
      if (elapsed < 150 && !(dx > 4 || dy > 4)) return;

      state.flyStarted = true;
      state.isFlying = true;
      state.deltaX = 0;
      state.deltaY = 0;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.recentering = true;
      domElement.classList.add("cursor-none");
      invoke("start_fly");
      return;
    }

    if (!state.isFlying) return;

    if (state.recentering) {
      state.recentering = false;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      return;
    }

    state.deltaX += e.clientX - state.lastX;
    state.deltaY += e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    const rect = domElement.getBoundingClientRect();
    const nearEdge =
      e.clientX < rect.left + RECENTER_MARGIN ||
      e.clientX > rect.right - RECENTER_MARGIN ||
      e.clientY < rect.top + RECENTER_MARGIN ||
      e.clientY > rect.bottom - RECENTER_MARGIN;

    if (nearEdge) {
      state.recentering = true;
      invoke("recenter_cursor");
    }
  }

  async function onMouseUp(e) {
    if (e.button !== 2) return;
    state.mouseDownValid = false;
    if (!state.flyStarted) {
      state.mouseDownTime = null;
      return;
    }
    stopFlying();
  }

  function onWheel(e) {
    e.preventDefault();
    if (!state.enabled) return;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    camera.position.addScaledVector(fwd, -e.deltaY * 0.01);
  }

  function onContextMenu(e) {
    if (state.flyStarted) e.preventDefault();
  }

  function onKeyDown(e) {
    if (e.key === "Shift") {
      state.shift = true;
      return;
    }
    if (!state.isFlying) return;
    const k = e.key.toLowerCase();
    if (k in state.keys) {
      e.preventDefault();
      state.keys[k] = true;
    }
  }

  function onKeyUp(e) {
    if (e.key === "Shift") {
      state.shift = false;
      return;
    }
    const k = e.key.toLowerCase();
    if (k in state.keys) state.keys[k] = false;
  }

  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  domElement.addEventListener("wheel", onWheel, { passive: false });
  domElement.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", stopFlying);

  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _move = new THREE.Vector3();

  function update() {
    if (state.isFlying) {
      state.yaw -= state.deltaX * LOOK_SPEED;
      state.pitch -= state.deltaY * LOOK_SPEED;
      state.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.pitch));
      state.deltaX = 0;
      state.deltaY = 0;
    }

    const qYaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      state.yaw,
    );
    const qPitch = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      state.pitch,
    );
    camera.quaternion.multiplyQuaternions(qYaw, qPitch);

    const { w, a, s, d, q: qKey, e } = state.keys;
    if (w || a || s || d || qKey || e) {
      camera.getWorldDirection(_forward);
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      _up.setFromMatrixColumn(camera.matrixWorld, 1);
      _move.set(0, 0, 0);

      const speed = state.shift ? FLY_SPEED_FAST : FLY_SPEED;
      if (w) _move.addScaledVector(_forward, speed);
      if (s) _move.addScaledVector(_forward, -speed);
      if (d) _move.addScaledVector(_right, speed);
      if (a) _move.addScaledVector(_right, -speed);
      if (e) _move.addScaledVector(_up, speed);
      if (qKey) _move.addScaledVector(_up, -speed);

      camera.position.add(_move);
    }
  }

  function dispose() {
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    domElement.removeEventListener("wheel", onWheel);
    domElement.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", stopFlying);
  }

  return {
    update,
    dispose,
    set enabled(v) {
      state.enabled = v;
    },
    get enabled() {
      return state.enabled;
    },
    isFlying: () => state.isFlying,
    didFly: () => state.flyStarted,
  };
}
