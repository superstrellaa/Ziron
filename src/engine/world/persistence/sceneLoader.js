import { applyModelTexture } from "../model/modelTexture.js";

export async function loadSavedEntities(
  saved,
  sceneManager,
  sun,
  projectData,
  onProgress,
) {
  const regularEntities = saved.entities.filter(
    (e) => e.type !== "sun" && e.type !== "model",
  );
  const modelEntities = saved.entities.filter((e) => e.type === "model");
  const savedSun = saved.entities.find((e) => e.type === "sun");

  const added = await _loadRegularEntities(
    regularEntities,
    sceneManager,
    onProgress,
  );
  await _loadModelEntities(modelEntities, sceneManager, projectData, added);
  _restoreSun(savedSun, sun);

  return added;
}

async function _loadRegularEntities(regularEntities, sceneManager, onProgress) {
  const items = regularEntities.map((e) => ({
    type: e.type,
    options: {
      name: e.name,
      color: e.color ? parseInt(e.color.replace("#", ""), 16) : undefined,
      active: e.active ?? true,
    },
    _savedTransform: {
      position: e.position,
      rotation: e.rotation,
      scale: e.scale,
      active: e.active ?? true,
    },
  }));

  return sceneManager.addBatch(
    items,
    (entity, item) => {
      const t = item._savedTransform;
      entity.mesh.position.fromArray(t.position);
      entity.mesh.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2]);
      entity.mesh.scale.fromArray(t.scale);
      entity.mesh.visible = t.active;
      if (!t.active) sceneManager.setActive(entity.id, false);
    },
    onProgress,
  );
}

async function _loadModelEntities(
  modelEntities,
  sceneManager,
  projectData,
  added,
) {
  for (const e of modelEntities) {
    const absolutePath = `${projectData._folder}/assets/${e.modelPath}`;
    const entity = await sceneManager.addModel(absolutePath, e.modelPath, {
      id: e.id,
      name: e.name,
      active: e.active ?? true,
    });
    entity.components = e.components ?? {};

    const texturePath = entity.components?.model?.texture;
    if (texturePath) {
      applyModelTexture(entity, projectData, texturePath);
    }

    entity.mesh.position.fromArray(e.position);
    entity.mesh.rotation.set(e.rotation[0], e.rotation[1], e.rotation[2]);
    entity.mesh.scale.fromArray(e.scale);
    entity.mesh.visible = entity.active;
    added.push(entity);
  }
}

function _restoreSun(savedSun, sun) {
  if (!savedSun) return;
  sun.entity.mesh.rotation.set(
    savedSun.rotation[0],
    savedSun.rotation[1],
    savedSun.rotation[2],
  );
  sun.entity.mesh.position.fromArray(savedSun.position);
  sun.update();
}
