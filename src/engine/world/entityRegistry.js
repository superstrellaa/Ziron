import { logger } from "../core/logger.js";

export function createEntityRegistry() {
  const entities = new Map();
  let nextId = 1;

  function consumeId(requestedId = null) {
    if (requestedId != null) {
      if (requestedId >= nextId) nextId = requestedId + 1;
      return requestedId;
    }
    return nextId++;
  }

  function set(entity) {
    entities.set(entity.id, entity);
  }

  function insertAt(index, entity) {
    const arr = [...entities.entries()];
    const clamped = Math.min(Math.max(index, 0), arr.length);
    arr.splice(clamped, 0, [entity.id, entity]);
    entities.clear();
    for (const [k, v] of arr) entities.set(k, v);
  }

  function remove(id) {
    return entities.delete(id);
  }

  function get(id) {
    return entities.get(id) ?? null;
  }

  function getAll() {
    return Array.from(entities.values());
  }

  function indexOf(id) {
    let i = 0;
    for (const key of entities.keys()) {
      if (key === id) return i;
      i++;
    }
    return -1;
  }

  function reindex() {
    let newId = 1;
    const reindexed = new Map();

    for (const entity of entities.values()) {
      if (entity.type === "sun") {
        reindexed.set(entity.id, entity);
        continue;
      }
      entity.id = newId;
      reindexed.set(newId, entity);
      newId++;
    }

    entities.clear();
    for (const [k, v] of reindexed) entities.set(k, v);
    nextId = newId;

    logger.info("EntityRegistry", `Reindexed, nextId → ${nextId}`);
  }

  function getNextId() {
    return nextId;
  }

  return {
    consumeId,
    set,
    insertAt,
    remove,
    get,
    getAll,
    indexOf,
    reindex,
    getNextId,
  };
}
