import * as THREE from "three";

const SKY_RADIUS = 450;
const SKY_MARGIN = 50;

export function createCameraPreviewSystem(scene, hiddenDuringRender = []) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const previewCamera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);

  let activeEntity = null;
  let canvasEl = null;
  let resizeObserver = null;

  function attach(wrapEl) {
    canvasEl = wrapEl;
    wrapEl.appendChild(renderer.domElement);
    resize();

    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(wrapEl);
  }

  function setEntity(entity) {
    activeEntity = entity && entity.type === "camera" ? entity : null;
  }

  function resize() {
    if (!canvasEl) return;
    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    previewCamera.aspect = w / h;
    previewCamera.updateProjectionMatrix();
  }

  function tick() {
    if (!activeEntity || !canvasEl) return;

    const comp = activeEntity.components?.camera;
    const fov = comp?.fov ?? 50;
    const near = comp?.near ?? 0.1;
    const userFar = comp?.far ?? 1000;

    const renderFar = Math.max(userFar, SKY_RADIUS + SKY_MARGIN);

    if (
      previewCamera.fov !== fov ||
      previewCamera.near !== near ||
      previewCamera.far !== renderFar
    ) {
      previewCamera.fov = fov;
      previewCamera.near = near;
      previewCamera.far = renderFar;
      previewCamera.updateProjectionMatrix();
    }

    previewCamera.position.copy(activeEntity.mesh.position);
    previewCamera.quaternion.copy(activeEntity.mesh.quaternion);

    const prevVisibility = hiddenDuringRender.map((obj) => obj.visible);
    hiddenDuringRender.forEach((obj) => {
      obj.visible = false;
    });

    renderer.render(scene, previewCamera);

    hiddenDuringRender.forEach((obj, i) => {
      obj.visible = prevVisibility[i];
    });
  }

  function dispose() {
    resizeObserver?.disconnect();
    renderer.dispose();
    if (canvasEl && renderer.domElement.parentElement === canvasEl) {
      canvasEl.removeChild(renderer.domElement);
    }
  }

  return { attach, setEntity, resize, tick, dispose };
}
