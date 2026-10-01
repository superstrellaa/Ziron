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
import { connectModelDragDrop } from "./systems/assets/modelDragDrop.js";
import { logger } from "../engine/core/logger.js";
import { createHierarchy } from "./ui/panels/hierarchy.js";
import { onKeybind } from "./systems/input/keybinds.js";
import { saveScene } from "./systems/persistence/scenePersistence.js";
import { setProjectOpen } from "./ui/toolbar/menuBar.js";
import { createProperties } from "./ui/panels/properties.js";
import { createAssetsPanel } from "./ui/panels/assets/assetsPanel.js";
import { createAutoSave } from "./systems/persistence/autoSave.js";
import { activateScene } from "./systems/app/selectionContext.js";
import { CreateModelCommand } from "../engine/history/commands.js";
import { createCameraFrustumSystem } from "./scene/cameraGizmo/cameraFrustumSystem.js";
import { createCameraScaleLock } from "./scene/cameraGizmo/cameraScaleLock.js";
import { createCameraPreviewSystem } from "./scene/cameraGizmo/cameraPreviewSystem.js";
import { createCameraPreviewPanel } from "./scene/cameraGizmo/cameraPreviewPanel.js";

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

  const transformToolbar = createTransformToolbar(
    viewportEl,
    gizmo,
    flyControls,
  );

  const selection = createSelectionSystem(
    camera,
    renderer,
    scene,
    sceneManager,
    gizmo,
    flyControls,
  );

  const cameraFrustumSystem = createCameraFrustumSystem();
  const cameraScaleLock = createCameraScaleLock(sceneManager);
  const cameraPreview = createCameraPreviewSystem(scene, [
    gizmo.gizmo.getHelper(),
  ]);
  const previewPanel = createCameraPreviewPanel(viewportEl);
  cameraPreview.attach(previewPanel.canvasWrap);

  selection.onChange((single, multi) => {
    const active = multi?.length > 0 ? multi : single ? [single] : [];
    cameraFrustumSystem.sync(active);

    const isSingleCamera =
      single && (!multi || multi.length === 0) && single.type === "camera";

    cameraPreview.setEntity(isSingleCamera ? single : null);

    if (isSingleCamera) {
      previewPanel.show();
      cameraPreview.resize();
      transformToolbar.lockCorner("bottom-right");
    } else {
      previewPanel.hide();
      transformToolbar.unlockCorner();
    }
  });

  // ── Callback compartido de añadir modelo ────────────────────────────────
  async function addModelToScene(absolutePath, modelPath, name) {
    let entity = null;
    const cmd = CreateModelCommand(
      sceneManager,
      absolutePath,
      modelPath,
      { name },
      (created) => {
        entity = created;
      },
    );
    await cmd.execute();
    history.push(cmd);
    if (!history.isDirty()) hierarchy.setDirty(true);
    return entity;
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const hierarchy = createHierarchy(
    container,
    sceneManager,
    selection,
    sceneName,
    () => history,
    addModelToScene,
  );
  topArea.insertBefore(container.querySelector("#hierarchy"), viewportEl);

  const history = setupHistory(gizmo.gizmo, selection, sceneManager);

  const properties = createProperties(
    container,
    selection,
    sceneManager,
    () => history,
    projectData,
    camera,
  );
  topArea.appendChild(container.querySelector("#properties"));

  const assets = await createAssetsPanel(container, projectData, {
    onAddModel: addModelToScene,
  });

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

  const { destroy: destroyDragDrop } = connectModelDragDrop({
    viewportEl,
    camera,
    addModelToScene,
  });

  // esto esta aquí para que todas las demas paranoias tengan su evento, lo de arriba básicamente
  if (firstSelected) {
    activateScene();
    selection.selectEntity(firstSelected);
  }

  const renderLoop = createRenderLoop(
    renderer,
    camera,
    scene,
    flyControls,
    sun,
    () => {
      cameraFrustumSystem.tick();
      cameraScaleLock.tick();
      cameraPreview.tick();
    },
  );
  renderLoop.start();

  logger.info("Viewport", "Renderer ready");

  return {
    // Función usada para eliminar y limpiar el viewport activo
    destroy() {
      autoSave.stop();
      renderLoop.stop();
      destroyEvents();
      destroyDragDrop();
      cameraFrustumSystem.clear();
      cameraPreview.dispose();
    },
    // esto es para obtener si hay cambios
    isDirty: () => history.isDirty(),
    // su nombre lo dice
    triggerSave,
    // reinicia el auto-save, útil para cuando se abre un proyecto nuevo
    restartAutoSave: () => autoSave.restart(),
    // Usado por dragDropOverlay.js para importar archivos arrastrados desde
    // el SO a la carpeta actualmente abierta en el panel de assets.
    importPaths: (paths) => assets.importExternalPaths(paths),
  };
}
