import { createCameraFrustumHelper } from "./cameraFrustum.js";

export function createCameraFrustumSystem() {
  const helpers = new Map(); // entityId -> { object, updateFromComponents, entity }

  function sync(entities) {
    const wanted = new Map(
      entities.filter((e) => e.type === "camera").map((e) => [e.id, e]),
    );

    for (const [id, h] of helpers) {
      if (!wanted.has(id)) {
        h.entity.mesh.remove(h.object);
        helpers.delete(id);
      }
    }

    for (const [id, entity] of wanted) {
      if (helpers.has(id)) continue;
      const helper = createCameraFrustumHelper();
      helper.entity = entity;
      entity.mesh.add(helper.object);
      helper.updateFromComponents(entity.components?.camera);
      helpers.set(id, helper);
    }
  }

  function tick() {
    for (const helper of helpers.values()) {
      helper.updateFromComponents(helper.entity.components?.camera);
    }
  }

  function clear() {
    for (const h of helpers.values()) h.entity.mesh.remove(h.object);
    helpers.clear();
  }

  return { sync, tick, clear };
}
