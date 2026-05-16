import * as THREE from "three";
import { logger } from "../core/logger";
import { Toast } from "../ui/toasts/toastTypes";

const GEOMETRIES = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 32, 32),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
  capsule: () => new THREE.CapsuleGeometry(0.3, 0.6, 8, 16),
  plane: () => new THREE.PlaneGeometry(1, 1),
  cone: () => new THREE.ConeGeometry(0.5, 1, 32),
};

export function createSceneManager(scene) {
  const listeners = {
    onAdd: [],
    onAddBatch: [],
    onRemove: [],
    onRemoveBatch: [],
    onUpdate: [],
  };
  const entities = new Map();
  let nextId = 1;

  function _buildEntity(type, options = {}) {
    const geoFactory = GEOMETRIES[type];
    if (!geoFactory && type !== "sun") {
      logger.warn("SceneManager", `Unknown entity type "${type}"`);
      Toast.generalError();
      return null;
    }

    const geo = geoFactory();
    const mat = new THREE.MeshStandardMaterial({
      color: options.color ?? 0xa78bfa,
    });
    const mesh = new THREE.Mesh(geo, mat);

    const id = options.id ?? nextId++;
    if (options.id != null && options.id >= nextId) nextId = options.id + 1;

    const name = options.name ?? `${type}_${id}`;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = options.y ?? 0.5;
    if (options.position) mesh.position.copy(options.position);

    const entity = {
      id,
      name,
      type,
      mesh,
      active: options.active ?? true,
    };
    if (!entity.active) mesh.visible = false;
    return entity;
  }

  function add(type, options = {}) {
    const entity = _buildEntity(type, options);
    if (!entity) return null;

    scene.add(entity.mesh);
    entities.set(entity.id, entity);

    listeners.onAdd.forEach((cb) => cb(entity));
    logger.info(
      "SceneManager",
      `Added entity "${entity.name}" (type: ${type}, id: ${entity.id})`,
    );
    return entity;
  }

  // añadir en el indicie especifico
  function addAt(index, type, options = {}) {
    const entity = _buildEntity(type, options);
    if (!entity) return null;

    const arr = [...entities.entries()];
    const clampedIndex = Math.min(Math.max(index, 0), arr.length);
    arr.splice(clampedIndex, 0, [entity.id, entity]);
    entities.clear();
    for (const [k, v] of arr) entities.set(k, v);

    scene.add(entity.mesh);
    listeners.onAdd.forEach((cb) => cb(entity));
    return entity;
  }

  function addRaw(entity) {
    entity.active = entity.active ?? true;
    entities.set(entity.id, entity);
    listeners.onAdd.forEach((cb) => cb(entity));
    logger.info(
      "SceneManager",
      `Added raw entity "${entity.name}" (id: ${entity.id})`,
    );
  }

  function remove(id) {
    const entity = entities.get(id);
    if (!entity) {
      logger.warn("SceneManager", `Entity id ${id} not found, cannot remove`);
      Toast.generalError();
      return false;
    }
    scene.remove(entity.mesh);
    entity.mesh.geometry.dispose();
    entity.mesh.material.dispose();
    entities.delete(id);

    listeners.onRemove.forEach((cb) => cb(entity));
    logger.info("SceneManager", `Removed entity "${entity.name}" (id: ${id})`);
    return true;
  }

  // -------- Eventos BATCH ---------
  async function addBatch(items, onEachBuilt = null, onProgress = null) {
    const CHUNK_SIZE = 50;
    const added = [];
    const total = items.length;

    const sorted = items
      .map((item, i) => ({ item, i }))
      .sort((a, b) => (a.item.index ?? Infinity) - (b.item.index ?? Infinity));

    for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
      const chunk = sorted.slice(i, i + CHUNK_SIZE);

      for (const { item } of chunk) {
        let entity;
        if (item.index != null) {
          entity = _buildEntity(item.type, item.options ?? {});
          if (!entity) continue;
          const arr = [...entities.entries()];
          const clampedIndex = Math.min(Math.max(item.index, 0), arr.length);
          arr.splice(clampedIndex, 0, [entity.id, entity]);
          entities.clear();
          for (const [k, v] of arr) entities.set(k, v);
          scene.add(entity.mesh);
        } else {
          entity = _buildEntity(item.type, item.options ?? {});
          if (!entity) continue;
          scene.add(entity.mesh);
          entities.set(entity.id, entity);
        }
        onEachBuilt?.(entity, item);
        added.push(entity);
      }

      onProgress?.(Math.min(added.length, total), total);

      if (i + CHUNK_SIZE < sorted.length) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    if (added.length === 0) return added;

    listeners.onAddBatch.forEach((cb) => cb(added));
    logger.info("SceneManager", `Added batch of ${added.length} entities`);
    return added;
  }

  async function removeBatch(ids) {
    const CHUNK_SIZE = 50;
    const removed = [];

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      for (const id of chunk) {
        const entity = entities.get(id);
        if (!entity) {
          logger.warn("SceneManager", `Entity id ${id} not found, skipping`);
          continue;
        }
        scene.remove(entity.mesh);
        entity.mesh.geometry.dispose();
        entity.mesh.material.dispose();
        entities.delete(id);
        removed.push(entity);
      }
      if (i + CHUNK_SIZE < ids.length) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    if (removed.length === 0) return;

    listeners.onRemoveBatch.forEach((cb) => cb(removed));
    logger.info("SceneManager", `Removed batch of ${removed.length} entities`);
  }
  // ------------------------------

  function getAll() {
    return Array.from(entities.values());
  }

  function getById(id) {
    return entities.get(id) ?? null;
  }

  function on(event, callback) {
    listeners[event]?.push(callback);
    return () => {
      const arr = listeners[event];
      if (arr) listeners[event] = arr.filter((cb) => cb !== callback);
    };
  }

  function rename(id, newName) {
    const entity = entities.get(id);
    if (!entity) return false;
    const old = entity.name;
    entity.name = newName;
    listeners.onUpdate.forEach((cb) => cb(entity));
    logger.info("SceneManager", `Renamed "${old}" → "${newName}" (id: ${id})`);
    return true;
  }

  function setActive(id, value) {
    const entity = entities.get(id);
    if (!entity) return false;
    entity.active = value;
    entity.mesh.visible = value;
    listeners.onUpdate.forEach((cb) => cb(entity));
    return true;
  }

  function indexOf(id) {
    let i = 0;
    for (const key of entities.keys()) {
      if (key === id) return i;
      i++;
    }
    return -1;
  }

  return {
    add,
    addBatch,
    addAt,
    remove,
    removeBatch,
    getAll,
    getById,
    on,
    addRaw,
    rename,
    setActive,
    indexOf,
  };
}
