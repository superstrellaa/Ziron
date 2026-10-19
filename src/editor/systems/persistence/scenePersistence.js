import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../engine/core/logger.js";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";

export async function saveScene(
  projectData,
  sceneManager,
  history = null,
  sceneName = "main",
  toast = true,
) {
  sceneManager.reindexIds(); // ids internos: orden organizado por lectura
  sceneManager.compactHierarchyOrders(); // orden visual de jerarquía: sin huecos

  const entities = sceneManager.getAll().map((entity) => {
    const { mesh } = entity;
    const base = {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      hierarchyOrder: entity.hierarchyOrder ?? 0,
      position: mesh.position.toArray(),
      rotation: mesh.rotation.toArray().slice(0, 3),
      scale: mesh.scale.toArray(),
      active: entity.active ?? true,
    };
    if (entity.type === "model" || entity.type === "camera") {
      base.components = entity.components ?? {};
    }
    if (entity.type === "model") {
      base.modelPath = entity.modelPath;
    }
    if (
      entity.type !== "sun" &&
      entity.type !== "model" &&
      entity.type !== "camera" &&
      mesh.material?.color
    ) {
      base.color = "#" + mesh.material.color.getHexString();
    }
    return base;
  });

  const sceneData = { name: sceneName, entities };
  const scenePath = `${projectData._folder}/scenes/${sceneName}.ziron.scene`;

  try {
    await invoke("save_scene", { scenePath, sceneData });
    logger.info("ScenePersistence", `Scene saved → ${scenePath}`);
    history?.markClean(); // al guardar, limpiamos la marca para que indique eso
    if (toast) Toast.saveSuccess();
    return true;
  } catch (e) {
    const message = typeof e === "string" ? e : (e?.message ?? String(e));
    logger.error(
      "ScenePersistence",
      `Failed to save scene | Error: ${message}`,
    );
    Toast.saveError();
    Popup.error("Failed to save scene: " + message);
    return false;
  }
}

export async function loadScene(projectData, sceneName = "main") {
  const scenePath = `${projectData._folder}/scenes/${sceneName}.ziron.scene`;
  try {
    const sceneData = await invoke("load_scene", { scenePath });
    logger.info("ScenePersistence", `Scene loaded ← ${scenePath}`);
    return sceneData;
  } catch (e) {
    const message = typeof e === "string" ? e : (e?.message ?? String(e));

    if (message.startsWith("scene_not_found:")) {
      logger.warn(
        "ScenePersistence",
        `Scene file not found, a new one will be created: ${scenePath}`,
      );
      return null;
    }

    logger.error(
      "ScenePersistence",
      `Failed to load scene | Error: ${message}`,
    );
    throw e;
  }
}

export async function backupScene(projectData, sceneName = "main") {
  const scenePath = `${projectData._folder}/scenes/${sceneName}.ziron.scene`;
  try {
    const backupPath = await invoke("backup_scene", { scenePath });
    logger.info("ScenePersistence", `Scene backup ready → ${backupPath}`);
    return { path: backupPath };
  } catch (e) {
    const message = typeof e === "string" ? e : (e?.message ?? String(e));
    logger.error(
      "ScenePersistence",
      `Could not back up the scene before loading it with problems | Error: ${message}`,
    );
    return { error: message };
  }
}
