import * as THREE from "three";
import { createFlyCamera } from "../engine/camera/flyCamera.js";
import { createScene } from "../engine/core/scene.js";
import { createGizmo } from "../engine/gizmos/transformGizmo.js";
import { createSelectionSystem } from "./scene/selection.js";
import { createContextMenu } from "./scene/contextMenu.js";
import { logger } from "../engine/core/logger.js";
import { createTransformToolbar } from "./ui/transformToolbar.js";

export async function createViewport(container) {
  logger.info("Viewport", "Initializing viewport");

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(5, 4, 7);
  camera.lookAt(0, 0, 0);

  const { scene, sceneManager, defaultCube, sun } = await createScene(renderer);

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

  const gizmo = createGizmo(camera, renderer.domElement, scene, flyControls);
  createTransformToolbar(container, gizmo, flyControls);

  const selection = createSelectionSystem(
    camera,
    renderer,
    scene,
    sceneManager,
    gizmo,
  );
  selection.selectEntity(defaultCube);

  sceneManager.on("onAdd", (entity) => {
    if (entity.type !== "sun") selection.selectEntity(entity);
  });

  createContextMenu(container, sceneManager);

  function animate() {
    requestAnimationFrame(animate);
    flyControls.update();
    sun.update();
    renderer.render(scene, camera);
  }
  animate();
  logger.info("Viewport", "Renderer ready");
}
