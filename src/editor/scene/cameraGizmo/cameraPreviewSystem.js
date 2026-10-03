import * as THREE from "three";

const SKY_RADIUS = 450;
const SKY_MARGIN = 50;

export function createCameraPreviewSystem(
  renderer,
  scene,
  hiddenDuringRender = [],
) {
  const previewCamera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);

  let activeEntity = null;
  let previewArea = null;
  let resizeObserver = null;

  function attach(wrapEl) {
    previewArea = wrapEl;
    resize();

    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(wrapEl);
  }

  function setEntity(entity) {
    activeEntity = entity && entity.type === "camera" ? entity : null;
  }

  function resize() {
    if (!previewArea) return;
    const w = previewArea.clientWidth;
    const h = previewArea.clientHeight;
    if (w === 0 || h === 0) return;
    const aspect = w / h;
    if (previewCamera.aspect !== aspect) {
      previewCamera.aspect = aspect;
      previewCamera.updateProjectionMatrix();
    }
  }

  function tick() {
    if (!activeEntity || !previewArea) return;

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
  }

  function render() {
    if (!activeEntity || !previewArea) return;
    resize();

    const canvasRect = renderer.domElement.getBoundingClientRect();
    const previewRect = previewArea.getBoundingClientRect();
    if (
      canvasRect.width === 0 ||
      canvasRect.height === 0 ||
      previewRect.width === 0 ||
      previewRect.height === 0
    ) {
      return;
    }

    const x = previewRect.left - canvasRect.left;
    const y = canvasRect.bottom - previewRect.bottom;
    const { width, height } = previewRect;

    const prevVisibility = hiddenDuringRender.map((obj) => obj.visible);
    hiddenDuringRender.forEach((obj) => {
      obj.visible = false;
    });

    const previousAutoClear = renderer.autoClear;
    try {
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      renderer.setViewport(x, y, width, height);
      renderer.setScissor(x, y, width, height);
      renderer.clear(true, true, true);
      renderer.render(scene, previewCamera);
    } finally {
      renderer.autoClear = previousAutoClear;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, canvasRect.width, canvasRect.height);
      hiddenDuringRender.forEach((obj, i) => {
        obj.visible = prevVisibility[i];
      });
    }
  }

  function dispose() {
    resizeObserver?.disconnect();
    previewArea = null;
  }

  return { attach, setEntity, resize, tick, render, dispose };
}
