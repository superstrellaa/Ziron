import * as THREE from "three";
import { logger } from "../core/logger.js";
import { Toast } from "../ui/toasts/toastTypes.js";
import { createCameraGizmoMesh } from "./cameraEntity.js";

const GEOMETRIES = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 32, 32),
  cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
  capsule: () => new THREE.CapsuleGeometry(0.3, 0.6, 8, 16),
  plane: () => new THREE.PlaneGeometry(1, 1),
  cone: () => new THREE.ConeGeometry(0.5, 1, 32),
};

export function isKnownType(type) {
  return type in GEOMETRIES || type === "camera";
}

export function buildEntity(type, options = {}, nextId) {
  const id = options.id ?? nextId;

  if (type === "camera") {
    const mesh = createCameraGizmoMesh();
    mesh.position.y = options.y ?? 1;
    if (options.position) mesh.position.copy(options.position);

    const entity = {
      id,
      name: capitalize(options.name ?? `Camera_${id}`),
      type,
      mesh,
      active: options.active ?? true,
    };
    if (!entity.active) mesh.visible = false;
    return entity;
  }

  const geoFactory = GEOMETRIES[type];
  if (!geoFactory && type !== "sun") {
    logger.warn("EntityFactory", `Unknown entity type "${type}"`);
    Toast.unknownEntityType();
    return null;
  }

  const geo = geoFactory();
  const mat = new THREE.MeshStandardMaterial({
    color: options.color ?? 0xa78bfa,
  });
  const mesh = new THREE.Mesh(geo, mat);

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.y = options.y ?? 0.5;
  if (options.position) mesh.position.copy(options.position);

  const entity = {
    id,
    name: capitalize(options.name ?? `${type}_${id}`),
    type,
    mesh,
    active: options.active ?? true,
  };
  if (!entity.active) mesh.visible = false;
  return entity;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
