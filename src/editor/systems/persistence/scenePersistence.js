import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../engine/core/logger.js";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";

export async function saveScene(
  projectData,
  sceneManager,
  history = null,
  sceneName = "main",
) {
  const entities = sceneManager.getAll().map((entity) => {
    const { mesh } = entity;
    const base = {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      position: mesh.position.toArray(),
      rotation: mesh.rotation.toArray().slice(0, 3),
      scale: mesh.scale.toArray(),
    };
    if (entity.type !== "sun" && mesh.material?.color) {
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
    Toast.saveSuccess();
    return true;
  } catch (e) {
    logger.warn("ScenePersistence", `Failed to save scene: ${e}`);
    Toast.saveError();
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
    logger.warn("ScenePersistence", `Failed to load scene: ${e}`);
    Toast.loadError();
    return null;
  }
}
