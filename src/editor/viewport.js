import { createScene } from "../engine/core/scene.js";
import { createFlyCamera } from "./camera/flyCamera.js";
import { createGizmo } from "./gizmos/transformGizmo.js";
import { createSelectionSystem } from "./scene/selection/selection.js";
import { createContextMenu } from "./scene/contextMenu.js";
import { createTransformToolbar } from "./ui/toolbar/transformToolbar.js";
import { createRenderer } from "./systems/rendering/rendererSetup.js";
import { setupHistory } from "./systems/rendering/historySetup.js";
import { logger } from "../engine/core/logger.js";
import { createHierarchy } from "./ui/panels/hierarchy.js";
import { onKeybind } from "./systems/input/keybinds.js";
import { saveScene } from "./systems/persistence/scenePersistence.js";
import { setProjectOpen } from "./ui/toolbar/menuBar.js";

export async function createViewport(container, projectData) {
  const viewportEl = container.querySelector("#viewport");

  const { renderer, camera } = createRenderer(viewportEl);
  const { scene, sceneManager, firstSelected, sun } = await createScene(
    renderer,
    projectData,
  );
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
  if (firstSelected) selection.selectEntity(firstSelected);

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

  async function triggerSave() {
    await saveScene(projectData, sceneManager);
  }

  setProjectOpen(true, triggerSave);

  const unsubSave = onKeybind("SAVE", (e) => {
    e.preventDefault();
    triggerSave();
  });

  function destroy() {
    unsubSave();
    setProjectOpen(false);
  }

  viewportEl.addEventListener("viewport:destroy", unsubSave, { once: true });

  function animate() {
    requestAnimationFrame(animate);
    flyControls.update();
    sun.update();
    renderer.render(scene, camera);
  }
  animate();

  return { destroy };

  logger.info("Viewport", "Renderer ready");
}
