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
  const { scene, sceneManager, firstSelected, sun, sceneName } =
    await createScene(renderer, projectData);
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
  const hierarchy = createHierarchy(
    container,
    sceneManager,
    selection,
    sceneName,
  );
  container.insertBefore(container.querySelector("#hierarchy"), viewportEl);

  selection.onChange((single, multi) => hierarchy.setSelected(single, multi));
  if (firstSelected) selection.selectEntity(firstSelected);

  sceneManager.on("onAdd", (entity) => {
    if (entity.type !== "sun") selection.selectEntity(entity);
  });

  const history = setupHistory(gizmo.gizmo, selection, sceneManager);

  async function updateDirtyUI(dirty) {
    hierarchy.setDirty(dirty);
  }

  history.onDirtyChange((dirty) => updateDirtyUI(dirty));

  sceneManager.on("onAdd", () => history.isDirty() || updateDirtyUI(true));
  sceneManager.on("onRemove", () => history.isDirty() || updateDirtyUI(true));

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
    await saveScene(projectData, sceneManager, history, sceneName);
    updateDirtyUI(false);
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

  const infiniteGrid = scene.children.find((c) => c.userData.isInfiniteGrid);

  function animate() {
    requestAnimationFrame(animate);
    flyControls.update();
    sun.update();

    if (infiniteGrid) {
      infiniteGrid.position.x = camera.position.x;
      infiniteGrid.position.z = camera.position.z;
      infiniteGrid.material.uniforms.uCameraPos.value.copy(camera.position);
    }

    renderer.render(scene, camera);
  }
  animate();

  logger.info("Viewport", "Renderer ready");

  return { destroy, isDirty: () => history.isDirty(), triggerSave };
}
