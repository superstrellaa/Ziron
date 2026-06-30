import * as THREE from "three";
import { getDraggingModel, clearDraggingModel } from "../app/dragState.js";

export function connectModelDragDrop({ viewportEl, camera, addModelToScene }) {
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const mouse = new THREE.Vector2();
  const hitPoint = new THREE.Vector3();

  function onDragOver(e) {
    if (!getDraggingModel()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  async function onDrop(e) {
    const payload = getDraggingModel();
    if (!payload) return;
    e.preventDefault();
    clearDraggingModel();

    const { absolutePath, diskPath, name } = payload;

    const rect = viewportEl.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, hitPoint);

    const entity = await addModelToScene(absolutePath, diskPath, name);
    if (hit) entity.mesh.position.copy(hit);
  }

  viewportEl.addEventListener("dragover", onDragOver);
  viewportEl.addEventListener("drop", onDrop);

  function destroy() {
    viewportEl.removeEventListener("dragover", onDragOver);
    viewportEl.removeEventListener("drop", onDrop);
  }

  return { destroy };
}
