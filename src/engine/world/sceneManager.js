import * as THREE from "three";
import { logger } from "../core/logger";

// lista chula de geometrías disponibles
const GEOMETRIES = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 32, 32),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
  capsule: () => new THREE.CapsuleGeometry(0.3, 0.6, 8, 16),
  plane: () => new THREE.PlaneGeometry(1, 1),
  cone: () => new THREE.ConeGeometry(0.5, 1, 32),
};

export function createSceneManager(scene) {
  const listeners = { onAdd: [], onRemove: [] };
  const entities = new Map();
  let nextId = 1;

  function add(type, options = {}) {
    const geoFactory = GEOMETRIES[type];
    if (!geoFactory) {
      console.warn(`SceneManager: tipo desconocido "${type}"`);
      return null;
    }

    const geo = geoFactory();
    const mat = new THREE.MeshStandardMaterial({
      color: options.color ?? 0xa78bfa,
    });
    const mesh = new THREE.Mesh(geo, mat);

    const name = options.name ?? `${type}_${nextId}`;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = options.y ?? 0.5;
    if (options.position) mesh.position.copy(options.position);

    scene.add(mesh);

    const entity = { id: nextId++, name, type, mesh };
    entities.set(entity.id, entity);

    listeners.onAdd.forEach((cb) => cb(entity));

    logger.info(
      "SceneManager",
      `Added entity "${name}" (type: ${type}, id: ${entity.id})`,
    );
    return entity;
  }

  // para entidades especiales como el sol, que no siguen las geometries esas raras
  function addRaw(entity) {
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

  function getAll() {
    return Array.from(entities.values());
  }

  function getById(id) {
    return entities.get(id) ?? null;
  }

  function on(event, callback) {
    listeners[event]?.push(callback);
  }

  return { add, remove, getAll, getById, on, addRaw };
}
