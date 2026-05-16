import * as THREE from "three";

export function createRenderLoop(renderer, camera, scene, flyControls, sun) {
  const infiniteGrid = scene.children.find((c) => c.userData.isInfiniteGrid);
  const _lastCamPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  const _GRID_THRESHOLD = 0.001;

  let _sunDirty = true;
  const _origSunUpdate = sun.update.bind(sun);

  sun.update = () => {
    _sunDirty = true;
  };
  sun.markDirty = () => {
    _sunDirty = true;
  };

  let _running = false;
  let _rafId = null;

  function tick() {
    if (!_running) return;
    _rafId = requestAnimationFrame(tick);

    flyControls.update();

    if (_sunDirty) {
      _origSunUpdate();
      _sunDirty = false;
    }

    if (
      infiniteGrid &&
      camera.position.distanceToSquared(_lastCamPos) > _GRID_THRESHOLD
    ) {
      infiniteGrid.position.x = camera.position.x;
      infiniteGrid.position.z = camera.position.z;
      infiniteGrid.material.uniforms.uCameraPos.value.copy(camera.position);
      _lastCamPos.copy(camera.position);
    }

    renderer.render(scene, camera);
  }

  function start() {
    if (_running) return;
    _running = true;
    tick();
  }

  function stop() {
    _running = false;
    if (_rafId != null) cancelAnimationFrame(_rafId);
  }

  return { start, stop };
}
