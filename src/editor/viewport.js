import * as THREE from "three";
import { createFlyCamera } from "../engine/camera/flyCamera.js";
import { createScene } from "../engine/core/scene.js";
import { createGizmo } from "../engine/gizmos/transformGizmo.js";
import { logger } from "../engine/core/logger.js";
import { createContextMenu } from "./contextMenu.js";

export function createViewport(container) {
  logger.info("Viewport", "Initializing viewport");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(5, 4, 7);
  camera.lookAt(0, 0, 0);

  const { scene, sceneManager, defaultCube } = createScene();

  createContextMenu(container, sceneManager);

  const flyControls = createFlyCamera(camera, container);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(container);

  const gizmo = createGizmo(
    camera,
    renderer.domElement,
    scene,
    defaultCube.mesh,
    flyControls,
  );

  function animate() {
    requestAnimationFrame(animate);
    flyControls.update();
    renderer.render(scene, camera);
  }
  animate();
  logger.info("Viewport", "Renderer ready");
}
