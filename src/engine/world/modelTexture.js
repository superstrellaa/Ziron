import * as THREE from "three";
import { convertFileSrc } from "@tauri-apps/api/core";

THREE.Cache.enabled = true; // evita recargar la misma textura varias veces
const _loader = new THREE.TextureLoader();

export async function applyModelTexture(entity, projectData, relativePath) {
  if (!entity?.mesh) return;

  if (!relativePath) {
    _clearTexture(entity);
    return;
  }

  const absolutePath = `${projectData._folder}/assets/${relativePath}`;
  const url = convertFileSrc(absolutePath);

  let texture;
  try {
    texture = await _loader.loadAsync(url);
  } catch (e) {
    console.warn("[ModelTexture] Failed to load texture:", e);
    return;
  }

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;

  _disposeApplied(entity);
  entity._appliedTexture = texture;

  entity.mesh.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const mat of mats) {
      mat.map = texture;
      mat.needsUpdate = true;
    }
  });
}

function _clearTexture(entity) {
  _disposeApplied(entity);
  entity.mesh?.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const mat of mats) {
      mat.map = null;
      mat.needsUpdate = true;
    }
  });
}

function _disposeApplied(entity) {
  if (entity._appliedTexture) {
    entity._appliedTexture.dispose();
    entity._appliedTexture = null;
  }
}
