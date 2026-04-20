import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";

export function createFlyCamera(camera, domElement) {
  const state = {
    isFlying: false,
    flyStarted: false,
    mouseDownTime: null,
    mouseDownX: 0,
    mouseDownY: 0,
    enabled: true,
    shift: false,
    yaw: 0,
    pitch: 0,
    keys: { w: false, a: false, s: false, d: false, q: false, e: false },
    centerX: 0,
    centerY: 0,
    deltaX: 0,
    deltaY: 0,
  };

  const LOOK_SPEED = 0.003;
  const FLY_SPEED = 0.08;
  const FLY_SPEED_FAST = 0.28;

  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  state.yaw = euler.y;
  state.pitch = euler.x;

  async function onMouseDown(e) {
    if (e.button !== 2) return;
    if (!state.enabled) return;
    e.preventDefault();
    state.mouseDownTime = performance.now();
    state.mouseDownX = e.clientX;
    state.mouseDownY = e.clientY;
    state.flyStarted = false;
  }

  function onMouseMove(e) {
    if (e.buttons !== 2) return;

    if (!state.flyStarted) {
      const elapsed = performance.now() - (state.mouseDownTime ?? 0);
      const dx = Math.abs(e.clientX - state.mouseDownX);
      const dy = Math.abs(e.clientY - state.mouseDownY);
      const moved = dx > 4 || dy > 4;

      if (elapsed < 150 && !moved) return;

      state.flyStarted = true;
      state.isFlying = true;
      state.deltaX = 0;
      state.deltaY = 0;
      document.body.classList.add("cursor-hidden");
      invoke("grab_cursor");
      invoke("recenter_cursor").then(([cx, cy]) => {
        state.centerX = cx;
        state.centerY = cy;
      });
      return;
    }

    if (!state.isFlying) return;
    state.deltaX += e.screenX - state.centerX;
    state.deltaY += e.screenY - state.centerY;
  }

  async function onMouseUp(e) {
    if (e.button !== 2) return;

    if (!state.flyStarted) {
      state.mouseDownTime = null;
      return;
    }

    state.isFlying = false;
    state.flyStarted = false;
    state.deltaX = 0;
    state.deltaY = 0;
    for (const k in state.keys) state.keys[k] = false;
    document.body.classList.remove("cursor-hidden");
    await invoke("release_cursor");
  }

  function onWheel(e) {
    e.preventDefault();
    if (!state.enabled) return;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    camera.position.addScaledVector(fwd, -e.deltaY * 0.01);
  }

  function onContextMenu(e) {
    e.preventDefault();
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

  async function update() {
    if (state.isFlying) {
      state.yaw -= state.deltaX * LOOK_SPEED;
      state.pitch -= state.deltaY * LOOK_SPEED;
      state.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.pitch));
      state.deltaX = 0;
      state.deltaY = 0;

      const [cx, cy] = await invoke("recenter_cursor");
      state.centerX = cx;
      state.centerY = cy;
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

  return {
    update,
    set enabled(v) {
      state.enabled = v;
    },
    get enabled() {
      return state.enabled;
    },
    isFlying: () => state.isFlying,
  };
}
