import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../engine/core/logger.js";

export async function saveScene(projectData, sceneManager) {
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

  const sceneData = { name: projectData.name, entities };
  const scenePath = `${projectData._folder}/scenes/main.ziron.scene`;

  try {
    await invoke("save_scene", { scenePath, sceneData });
    logger.info("ScenePersistence", `Scene saved → ${scenePath}`);
    return true;
  } catch (e) {
    logger.warn("ScenePersistence", `Failed to save scene: ${e}`);
    return false;
  }
}

export async function loadScene(projectData) {
  const scenePath = `${projectData._folder}/scenes/main.ziron.scene`;
  try {
    const sceneData = await invoke("load_scene", { scenePath });
    logger.info("ScenePersistence", `Scene loaded ← ${scenePath}`);
    return sceneData;
  } catch (e) {
    logger.warn("ScenePersistence", `Failed to load scene: ${e}`);
    return null;
  }
}
