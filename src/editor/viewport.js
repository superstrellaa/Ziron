import { createScene } from "../engine/core/scene.js";
import { createFlyCamera } from "../engine/camera/flyCamera.js";
import { createGizmo } from "../engine/gizmos/transformGizmo.js";
import { createSelectionSystem } from "./scene/selection/selection.js";
import { createContextMenu } from "./scene/contextMenu.js";
import { createTransformToolbar } from "./ui/transformToolbar.js";
import { createRenderer } from "./systems/rendererSetup.js";
import { setupHistory } from "./systems/historySetup.js";
import { logger } from "../engine/core/logger.js";
import { createHierarchy } from "./ui/hierarchy.js";

export async function createViewport(container) {
  const viewportEl = container.querySelector("#viewport");

  const { renderer, camera } = createRenderer(viewportEl);
  const { scene, sceneManager, defaultCube, sun } = await createScene(renderer);
  const flyControls = createFlyCamera(camera, viewportEl);
  const gizmo = createGizmo(camera, renderer.domElement, scene, flyControls);

  createTransformToolbar(viewportEl, gizmo, flyControls);

  const selection = createSelectionSystem(
    camera,
    renderer,
    scene,
    sceneManager,
    gizmo,
    flyControls,
  );
  const hierarchy = createHierarchy(container, sceneManager, selection);
  container.insertBefore(container.querySelector("#hierarchy"), viewportEl);

  selection.onChange((single, multi) => hierarchy.setSelected(single, multi));
  selection.selectEntity(defaultCube);

  sceneManager.on("onAdd", (entity) => {
    if (entity.type !== "sun") selection.selectEntity(entity);
  });

  const history = setupHistory(gizmo.gizmo, selection, sceneManager);

  const ctxMenu = createContextMenu(
    viewportEl,
    sceneManager,
    history,
    selection,
    camera,
    flyControls,
  );
  hierarchy.setContextMenu(ctxMenu);

  function animate() {
    requestAnimationFrame(animate);
    flyControls.update();
    sun.update();
    renderer.render(scene, camera);
  }
  animate();

  logger.info("Viewport", "Renderer ready");
}
