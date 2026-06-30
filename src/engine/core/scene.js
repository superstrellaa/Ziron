import * as THREE from "three";
import { logger } from "./logger.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createSceneManager } from "../world/sceneManager.js";
import { createSunEntity } from "../world/sunEntity.js";
import { loadScene } from "../../editor/systems/persistence/scenePersistence.js";
import { createProceduralSky } from "../world/environment/proceduralSky.js";
import { createInfiniteGrid } from "../world/environment/infiniteGrid.js";
import { loadSavedEntities } from "../world/persistence/sceneLoader.js";

export async function createScene(renderer, projectData, onProgress = null) {
  const scene = new THREE.Scene();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const { skyMesh, updateSky } = createProceduralSky();
  scene.add(skyMesh);
  scene.add(createInfiniteGrid());
  scene.add(new THREE.AxesHelper(2));
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const sceneManager = createSceneManager(scene);
  const sun = await createSunEntity(scene, sceneManager, updateSky);

  let firstSelected = null;
  let sceneName = "main";

  if (projectData) {
    const startupScene = projectData.startup_scene ?? "scenes/main.ziron.scene";
    const sceneNameFromFile = startupScene
      .replace("scenes/", "")
      .replace(".ziron.scene", "");

    const saved = await loadScene(projectData, sceneNameFromFile);
    sceneName = saved?.name ?? "main";

    const hasEntities = saved?.entities?.some((e) => e.type !== "sun");

    if (!hasEntities) {
      firstSelected = sceneManager.add("cube", { name: "Cube" });
      logger.info("Scene", "New scene — default cube added");
    } else {
      const added = await loadSavedEntities(
        saved,
        sceneManager,
        sun,
        projectData,
        onProgress,
      );
      firstSelected = added[0] ?? null;
      logger.info(
        "Scene",
        `Loaded ${saved.entities.length} entities from disk`,
      );
    }
  } else {
    firstSelected = sceneManager.add("cube", { name: "Cube" });
  }

  return { scene, sceneManager, firstSelected, sun, sceneName };
}
