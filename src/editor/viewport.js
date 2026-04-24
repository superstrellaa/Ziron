import { createScene } from "../engine/core/scene.js";
import { createFlyCamera } from "../engine/camera/flyCamera.js";
import { createGizmo } from "../engine/gizmos/transformGizmo.js";
import { createSelectionSystem } from "./scene/selection.js";
import { createContextMenu } from "./scene/contextMenu.js";
import { createTransformToolbar } from "./ui/transformToolbar.js";
import { createRenderer } from "./systems/rendererSetup.js";
import { setupHistory } from "./systems/historySetup.js";
import { logger } from "../engine/core/logger.js";

export async function createViewport(container) {
  logger.info("Viewport", "Initializing viewport");

  const { renderer, camera } = createRenderer(container);
  const { scene, sceneManager, defaultCube, sun } = await createScene(renderer);
  const flyControls = createFlyCamera(camera, container);
  const gizmo = createGizmo(camera, renderer.domElement, scene, flyControls);

  createTransformToolbar(container, gizmo, flyControls);

  const selection = createSelectionSystem(
    camera,
    renderer,
    scene,
    sceneManager,
    gizmo,
    flyControls,
  );
  selection.selectEntity(defaultCube);

  sceneManager.on("onAdd", (entity) => {
    if (entity.type !== "sun") selection.selectEntity(entity);
  });

  const history = setupHistory(gizmo.gizmo, selection, sceneManager);
  createContextMenu(
    container,
    sceneManager,
    history,
    selection,
    camera,
    flyControls,
  );

  function animate() {
    requestAnimationFrame(animate);
    flyControls.update();
    sun.update();
    renderer.render(scene, camera);
  }
  animate();

  logger.info("Viewport", "Renderer ready");
}
