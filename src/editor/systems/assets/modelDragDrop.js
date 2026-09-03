import * as THREE from "three";
import { registerDropZone } from "../app/internalDrag.js";

export function connectModelDragDrop({ viewportEl, camera, addModelToScene }) {
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const mouse = new THREE.Vector2();
  const hitPoint = new THREE.Vector3();

  async function onDrop(payload, clientX, clientY) {
    const { absolutePath, diskPath, name } = payload;

    const rect = viewportEl.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, hitPoint);

    const entity = await addModelToScene(absolutePath, diskPath, name);
    if (hit) entity.mesh.position.copy(hit);
  }

  const unregister = registerDropZone(viewportEl, onDrop);

  function destroy() {
    unregister();
  }

  return { destroy };
}
