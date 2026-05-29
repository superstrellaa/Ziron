import { createScene } from "../engine/core/scene.js";
import { createFlyCamera } from "./camera/flyCamera.js";
import { createGizmo } from "./gizmos/transformGizmo.js";
import { createSelectionSystem } from "./scene/selection/selection.js";
import { createContextMenu } from "./scene/contextMenu.js";
import { createTransformToolbar } from "./ui/toolbar/transformToolbar.js";
import { createRenderer } from "./systems/rendering/rendererSetup.js";
import { setupHistory } from "./systems/rendering/historySetup.js";
import { createRenderLoop } from "./systems/rendering/renderLoop.js";
import { connectViewportEvents } from "./systems/rendering/viewportEvents.js";
import { logger } from "../engine/core/logger.js";
import { createHierarchy } from "./ui/panels/hierarchy.js";
import { onKeybind } from "./systems/input/keybinds.js";
import { saveScene } from "./systems/persistence/scenePersistence.js";
import { setProjectOpen } from "./ui/toolbar/menuBar.js";
import { createProperties } from "./ui/panels/properties.js";
import { createAssetsPanel } from "./ui/panels/assetsPanel.js";
import { createAutoSave } from "./systems/persistence/autoSave.js";

export async function createViewport(container, projectData) {
  // Creación de DOM
  const topArea = document.createElement("div");
  topArea.id = "workspace-top";
  container.appendChild(topArea);

  const viewportEl = document.createElement("div");
  viewportEl.id = "viewport";
  topArea.appendChild(viewportEl);

  // ── Sistemas core ─────────────────────────────────────────────────────────
  const { renderer, camera } = createRenderer(viewportEl);
  const { scene, sceneManager, firstSelected, sun, sceneName } =
    await createScene(renderer, projectData, (loaded, total) => {
      logger.info("Viewport", `Loading scene... ${loaded}/${total}`);
    });
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

  // ── UI ────────────────────────────────────────────────────────────────────
  const hierarchy = createHierarchy(
    container,
    sceneManager,
    selection,
    sceneName,
    () => history,
  );
  topArea.insertBefore(container.querySelector("#hierarchy"), viewportEl);

  const history = setupHistory(gizmo.gizmo, selection, sceneManager);

  const properties = createProperties(
    container,
    selection,
    sceneManager,
    () => history,
  );
  topArea.appendChild(container.querySelector("#properties"));

  const assets = createAssetsPanel(container, projectData);

  if (firstSelected) selection.selectEntity(firstSelected);

  // ── Context menu y save ───────────────────────────────────────────────────
  const ctxMenu = createContextMenu(
    viewportEl,
    sceneManager,
    history,
    selection,
    camera,
    flyControls,
  );
  hierarchy.setContextMenu(ctxMenu);

  async function triggerSave(toast = true) {
    await saveScene(projectData, sceneManager, history, sceneName, toast);
    hierarchy.setDirty(false);
  }

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const autoSave = createAutoSave(triggerSave);
  autoSave.start();

  // ── Eventos y render loop ─────────────────────────────────────────────────
  const { destroy: destroyEvents } = connectViewportEvents({
    sceneManager,
    selection,
    hierarchy,
    history,
    viewportEl,
    triggerSave,
    onKeybind,
    setProjectOpen,
  });

  const renderLoop = createRenderLoop(
    renderer,
    camera,
    scene,
    flyControls,
    sun,
  );
  renderLoop.start();

  logger.info("Viewport", "Renderer ready");

  return {
    destroy() {
      autoSave.stop();
      renderLoop.stop();
      destroyEvents();
    },
    isDirty: () => history.isDirty(),
    triggerSave,
    restartAutoSave: () => autoSave.restart(), // exponer el restart de auto save para que al cambiar config
  };
}
