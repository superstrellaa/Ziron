import * as THREE from "three";
import { logger } from "../../../engine/core/logger.js";
import { createSelectionBox } from "./selectionBox.js";
import { createMultiSelection } from "./multiSelection.js";

export function createSelectionSystem(
  camera,
  renderer,
  scene,
  sceneManager,
  gizmo,
  flyControls,
) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.__scene = scene;

  let selected = null;
  let mouseDownInCanvas = false;
  const changeListeners = [];
  const domElement = renderer.domElement;

  const selBox = createSelectionBox(domElement.parentElement);
  const multi = createMultiSelection(
    camera,
    renderer,
    sceneManager,
    gizmo,
    scene,
  );

  gizmo.gizmo.addEventListener("objectChange", () => {
    multi.syncToMeshes();
  });

  function notifyChange() {
    const single = selected;
    const multi_ = multi.getSelected();
    changeListeners.forEach((cb) => cb(single, multi_));
  }

  function selectEntity(entity) {
    multi.clear();
    selected = entity;
    gizmo.attach(entity.mesh);
    logger.info("Selection", `Selected "${entity.name}" (id: ${entity.id})`);
    notifyChange();
  }

  function deselect() {
    if (!selected && multi.getSelected().length === 0) return;
    if (selected) logger.info("Selection", `Deselected "${selected.name}"`);
    selected = null;
    multi.clear();
    gizmo.detach();
    notifyChange();
  }

  function getSelected() {
    return selected;
  }

  function getMultiSelected() {
    return multi.getSelected();
  }

  let mouseDownX = 0,
    mouseDownY = 0;
  let mouseDownTime = 0;
  let isDragging = false;
  const CLICK_THRESHOLD_MS = 150;
  const CLICK_THRESHOLD_PX = 4;

  let _prevPivotPos = new THREE.Vector3();

  domElement.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    mouseDownTime = performance.now();
    isDragging = false;
    mouseDownInCanvas = true;
  });

  window.addEventListener("mousemove", (e) => {
    if (!(e.buttons & 1)) return;
    if (!mouseDownInCanvas) return;
    if (flyControls?.isFlying()) return;
    if (gizmo.gizmo.dragging) return;

    const elapsed = performance.now() - mouseDownTime;
    const dx = Math.abs(e.clientX - mouseDownX);
    const dy = Math.abs(e.clientY - mouseDownY);

    if (!isDragging) {
      if (
        elapsed < CLICK_THRESHOLD_MS &&
        dx < CLICK_THRESHOLD_PX &&
        dy < CLICK_THRESHOLD_PX
      )
        return;
      isDragging = true;
      selBox.show(mouseDownX, mouseDownY);
    }

    selBox.update(e.clientX, e.clientY);
  });

  domElement.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;
    if (flyControls?.isFlying()) return;
    if (gizmo.gizmo.dragging) return;

    mouseDownInCanvas = false;

    if (isDragging) {
      isDragging = false;
      const rectPx = selBox.getRect();
      selBox.hide();

      const containerRect = domElement.getBoundingClientRect();
      const hits = multi.queryRect(rectPx, containerRect);

      if (hits.length === 0) {
        deselect();
      } else if (hits.length === 1) {
        selectEntity(hits[0]);
      } else {
        selected = null;
        multi.setSelected(hits);
        logger.info("Selection", `Multi-selected ${hits.length} entities`);
        notifyChange();
      }
      return;
    }

    const dx = Math.abs(e.clientX - mouseDownX);
    const dy = Math.abs(e.clientY - mouseDownY);
    if (dx > CLICK_THRESHOLD_PX || dy > CLICK_THRESHOLD_PX) return;

    const rect = domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshes = sceneManager.getAll().map((en) => en.mesh);
    const hits2 = raycaster.intersectObjects(meshes, false);

    if (hits2.length === 0) {
      if (!e.shiftKey) deselect();
      return;
    }

    const hitMesh = hits2[0].object;
    const entity = sceneManager.getAll().find((en) => en.mesh === hitMesh);
    if (!entity) return;

    // multi seleccion de click normal
    if (e.shiftKey) {
      const allEntities = sceneManager
        .getAll()
        .filter((en) => en.type !== "sun");

      let all = new Set();
      if (selected) all.add(selected.id);
      multi.getSelected().forEach((en) => all.add(en.id));

      if (all.has(entity.id)) {
        all.delete(entity.id);
      } else {
        all.add(entity.id);
      }

      const newSelection = allEntities.filter((en) => all.has(en.id));

      if (newSelection.length === 0) {
        deselect();
      } else if (newSelection.length === 1) {
        selectEntity(newSelection[0]);
      } else {
        selected = null;
        multi.setSelected(newSelection);
        logger.info(
          "Selection",
          `Multi-selected ${newSelection.length} entities`,
        );
        notifyChange();
      }
      return;
    }

    // click normal vaya
    if (selected?.id === entity.id && multi.getSelected().length === 0) return;
    selectEntity(entity);
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;
    if (isDragging) {
      isDragging = false;
      selBox.hide();
    }
  });

  function selectMultiple(entities) {
    selected = null;
    multi.setSelected(entities);
    notifyChange();
  }

  function refreshMultiPivot() {
    multi.refreshPivot();
  }

  return {
    selectEntity,
    deselect,
    getSelected,
    getMultiSelected,
    selectMultiple,
    refreshMultiPivot,
    onChange(cb) {
      changeListeners.push(cb);
    },
  };
}
