import * as THREE from "three";
import { logger } from "../../engine/core/logger.js";

export function createSelectionSystem(
  camera,
  renderer,
  scene,
  sceneManager,
  gizmo,
) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selected = null;

  const domElement = renderer.domElement;

  function getSelectableMeshes() {
    return sceneManager.getAll().map((e) => e.mesh);
  }

  function selectEntity(entity) {
    selected = entity;
    gizmo.attach(entity.mesh);
    logger.info("Selection", `Selected "${entity.name}" (id: ${entity.id})`);
  }

  function deselect() {
    if (!selected) return;
    logger.info("Selection", `Deselected "${selected.name}"`);
    selected = null;
    gizmo.detach();
  }

  function getSelected() {
    return selected;
  }

  let mouseDownX = 0;
  let mouseDownY = 0;
  const CLICK_THRESHOLD_PX = 4;

  domElement.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
  });

  domElement.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;

    if (gizmo.gizmo.dragging) return;

    const dx = Math.abs(e.clientX - mouseDownX);
    const dy = Math.abs(e.clientY - mouseDownY);
    if (dx > CLICK_THRESHOLD_PX || dy > CLICK_THRESHOLD_PX) return;

    const rect = domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getSelectableMeshes(), false);

    if (hits.length === 0) {
      deselect();
      return;
    }

    const hitMesh = hits[0].object;
    const entity = sceneManager.getAll().find((e) => e.mesh === hitMesh);
    if (!entity) return;

    if (selected?.id === entity.id) return;

    selectEntity(entity);
  });

  return { selectEntity, deselect, getSelected };
}
