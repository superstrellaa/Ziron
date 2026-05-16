import { buildEntity } from "./entityFactory.js";
import { createEntityRegistry } from "./entityRegistry.js";
import { logger } from "../core/logger.js";

export function createSceneManager(scene) {
  const registry = createEntityRegistry();
  const listeners = {
    onAdd: [],
    onAddBatch: [],
    onRemove: [],
    onRemoveBatch: [],
    onUpdate: [],
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _build(type, options) {
    const id = registry.consumeId(options.id ?? null);
    return buildEntity(type, { ...options, id }, id);
  }

  function _emit(event, payload) {
    listeners[event]?.forEach((cb) => cb(payload));
  }

  // ── API individual ────────────────────────────────────────────────────────

  function add(type, options = {}) {
    const entity = _build(type, options);
    if (!entity) return null;

    scene.add(entity.mesh);
    registry.set(entity);
    _emit("onAdd", entity);

    logger.info(
      "SceneManager",
      `Added "${entity.name}" (${type}, id:${entity.id})`,
    );
    return entity;
  }

  function addAt(index, type, options = {}) {
    const entity = _build(type, options);
    if (!entity) return null;

    scene.add(entity.mesh);
    registry.insertAt(index, entity);
    _emit("onAdd", entity);
    return entity;
  }

  function addRaw(entity) {
    entity.active = entity.active ?? true;
    registry.set(entity);
    _emit("onAdd", entity);
    logger.info("SceneManager", `Added raw "${entity.name}" (id:${entity.id})`);
  }

  function remove(id) {
    const entity = registry.get(id);
    if (!entity) {
      logger.warn("SceneManager", `Entity id ${id} not found`);
      return false;
    }
    scene.remove(entity.mesh);
    entity.mesh.geometry.dispose();
    entity.mesh.material.dispose();
    registry.remove(id);
    _emit("onRemove", entity);

    logger.info("SceneManager", `Removed "${entity.name}" (id:${id})`);
    return true;
  }

  // ── API batch ─────────────────────────────────────────────────────────────

  async function addBatch(items, onEachBuilt = null, onProgress = null) {
    const CHUNK_SIZE = 50;
    const added = [];
    const total = items.length;

    const sorted = [...items].sort(
      (a, b) => (a.index ?? Infinity) - (b.index ?? Infinity),
    );

    for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
      const chunk = sorted.slice(i, i + CHUNK_SIZE);

      for (const item of chunk) {
        const entity = _build(item.type, item.options ?? {});
        if (!entity) continue;

        scene.add(entity.mesh);
        item.index != null
          ? registry.insertAt(item.index, entity)
          : registry.set(entity);

        onEachBuilt?.(entity, item);
        added.push(entity);
      }

      onProgress?.(Math.min(added.length, total), total);

      if (i + CHUNK_SIZE < sorted.length) {
        await new Promise((r) => requestAnimationFrame(r));
      }
    }

    if (added.length === 0) return added;
    _emit("onAddBatch", added);
    logger.info("SceneManager", `Batch added ${added.length} entities`);
    return added;
  }

  async function removeBatch(ids) {
    const CHUNK_SIZE = 50;
    const removed = [];

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      for (const id of ids.slice(i, i + CHUNK_SIZE)) {
        const entity = registry.get(id);
        if (!entity) {
          logger.warn("SceneManager", `Entity id ${id} not found, skipping`);
          continue;
        }
        scene.remove(entity.mesh);
        entity.mesh.geometry.dispose();
        entity.mesh.material.dispose();
        registry.remove(id);
        removed.push(entity);
      }

      if (i + CHUNK_SIZE < ids.length) {
        await new Promise((r) => requestAnimationFrame(r));
      }
    }

    if (removed.length === 0) return;
    _emit("onRemoveBatch", removed);
    logger.info("SceneManager", `Batch removed ${removed.length} entities`);
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────

  function rename(id, newName) {
    const entity = registry.get(id);
    if (!entity) return false;
    const old = entity.name;
    entity.name = newName;
    _emit("onUpdate", entity);
    logger.info("SceneManager", `Renamed "${old}" → "${newName}" (id:${id})`);
    return true;
  }

  function setActive(id, value) {
    const entity = registry.get(id);
    if (!entity) return false;
    entity.active = value;
    entity.mesh.visible = value;
    _emit("onUpdate", entity);
    return true;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  function on(event, callback) {
    listeners[event]?.push(callback);
    return () => {
      listeners[event] = listeners[event].filter((cb) => cb !== callback);
    };
  }

  return {
    // individual
    add,
    addAt,
    addRaw,
    remove,
    // batch
    addBatch,
    removeBatch,
    // mutaciones
    rename,
    setActive,
    // queries
    getAll: () => registry.getAll(),
    getById: (id) => registry.get(id),
    indexOf: (id) => registry.indexOf(id),
    reindexIds: () => registry.reindex(),
    on,
  };
}
