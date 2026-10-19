import * as THREE from "three";
import { logger } from "./logger.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createSceneManager } from "../world/sceneManager.js";
import { createSunEntity } from "../world/sunEntity.js";
import { createProceduralSky } from "../world/environment/proceduralSky.js";
import { createInfiniteGrid } from "../world/environment/infiniteGrid.js";
import {
  loadScene,
  backupScene,
} from "../../editor/systems/persistence/scenePersistence.js";
import {
  loadSavedEntities,
  notifyLoadReport,
  needsBackup,
} from "../world/persistence/sceneLoader.js";

export async function createScene(renderer, projectData, onProgress = null) {
  const scene = new THREE.Scene();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const { skyMesh, updateSky } = createProceduralSky();
  scene.add(skyMesh);

  const grid = createInfiniteGrid();
  scene.add(grid);

  const axes = new THREE.AxesHelper(2);
  axes.layers.set(1);
  scene.add(axes);

  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const sceneManager = createSceneManager(scene);
  const sun = await createSunEntity(scene, sceneManager, updateSky);

  let firstSelected = null;
  let sceneName = "main";

  if (projectData) {
    const startupScene =
      typeof projectData.startup_scene === "string" && projectData.startup_scene
        ? projectData.startup_scene
        : "scenes/main.ziron.scene";
    const sceneNameFromFile = startupScene
      .replace("scenes/", "")
      .replace(".ziron.scene", "");

    const saved = await loadScene(projectData, sceneNameFromFile);
    sceneName =
      typeof saved?.name === "string" && saved.name ? saved.name : "main";

    if (saved?.entities != null && !Array.isArray(saved.entities)) {
      throw new Error(
        `Scene "${sceneNameFromFile}" is malformed: "entities" is not a list`,
      );
    }

    const hasEntities = saved?.entities?.some((e) => e?.type !== "sun");

    if (!hasEntities) {
      firstSelected = sceneManager.add("cube", { name: "Cube" });
      logger.info("Scene", "New scene — default cube added");
    } else {
      const { added, report } = await loadSavedEntities(
        saved,
        sceneManager,
        sun,
        projectData,
        onProgress,
      );
      firstSelected = added[0] ?? null;

      const backup = needsBackup(report)
        ? await backupScene(projectData, sceneNameFromFile)
        : null;
      const loadedCount =
        added.length +
        (saved.entities.some((entity) => entity?.type === "sun") ? 1 : 0);

      logger.info(
        "Scene",
        `Loaded ${loadedCount}/${saved.entities.length} entities (skipped: ${report.skipped.length}, repaired: ${report.repaired.length})`,
      );
      notifyLoadReport(report, backup);
    }
  } else {
    firstSelected = sceneManager.add("cube", { name: "Cube" });
  }

  return { scene, sceneManager, firstSelected, sun, sceneName };
}
