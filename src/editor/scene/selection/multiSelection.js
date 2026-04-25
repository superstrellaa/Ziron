import * as THREE from "three";

export function createMultiSelection(
  camera,
  renderer,
  sceneManager,
  gizmo,
  scene,
) {
  let selected = [];
  const _box3 = new THREE.Box3();
  const _center = new THREE.Vector3();
  const pivot = new THREE.Object3D();
  scene.add(pivot);

  const _prevPos = new THREE.Vector3();
  const _prevQuat = new THREE.Quaternion();
  const _prevScale = new THREE.Vector3(1, 1, 1);

  let _offsets = [];

  function getSelected() {
    return selected;
  }

  function setSelected(entities) {
    selected = entities;
    if (selected.length === 0) {
      gizmo.detach();
      return;
    }
    if (selected.length === 1) {
      gizmo.attach(selected[0].mesh);
      return;
    }

    _box3.makeEmpty();
    for (const e of selected) _box3.expandByObject(e.mesh);
    _box3.getCenter(_center);

    pivot.position.copy(_center);
    pivot.quaternion.set(0, 0, 0, 1);
    pivot.scale.set(1, 1, 1);

    _prevPos.copy(pivot.position);
    _prevQuat.copy(pivot.quaternion);
    _prevScale.copy(pivot.scale);

    _offsets = selected.map((e) => ({
      pos: e.mesh.position.clone().sub(_center),
      quat: e.mesh.quaternion.clone(),
    }));

    gizmo.attach(pivot);
  }

  function syncToMeshes() {
    if (selected.length < 2) return;

    const deltaPos = pivot.position.clone().sub(_prevPos);
    if (deltaPos.lengthSq() > 1e-10) {
      for (const e of selected) e.mesh.position.add(deltaPos);
      _offsets = selected.map((e) => ({
        pos: e.mesh.position.clone().sub(pivot.position),
        quat: e.mesh.quaternion.clone(),
      }));
    }

    const deltaQuat = _prevQuat.clone().invert().multiply(pivot.quaternion);
    if (Math.abs(deltaQuat.w - 1) > 1e-6) {
      for (let i = 0; i < selected.length; i++) {
        const e = selected[i];
        const off = _offsets[i];

        const newOffset = off.pos.clone().applyQuaternion(deltaQuat);
        e.mesh.position.copy(pivot.position).add(newOffset);

        e.mesh.quaternion.copy(off.quat).premultiply(deltaQuat);

        off.pos.copy(newOffset);
        off.quat.copy(e.mesh.quaternion);
      }
    }

    const sx = pivot.scale.x / _prevScale.x;
    const sy = pivot.scale.y / _prevScale.y;
    const sz = pivot.scale.z / _prevScale.z;
    if (
      Math.abs(sx - 1) > 1e-6 ||
      Math.abs(sy - 1) > 1e-6 ||
      Math.abs(sz - 1) > 1e-6
    ) {
      for (const e of selected) {
        e.mesh.scale.x *= sx;
        e.mesh.scale.y *= sy;
        e.mesh.scale.z *= sz;
      }
    }

    _prevPos.copy(pivot.position);
    _prevQuat.copy(pivot.quaternion);
    _prevScale.copy(pivot.scale);
  }

  function clear() {
    selected = [];
    _offsets = [];
    gizmo.detach();
    pivot.position.set(0, 0, 0);
    pivot.quaternion.set(0, 0, 0, 1);
    pivot.scale.set(1, 1, 1);
  }

  function queryRect(rectPx, containerRect) {
    const entities = sceneManager.getAll().filter((e) => e.type !== "sun");
    const result = [];
    const _ndc = new THREE.Vector3();

    for (const entity of entities) {
      _ndc.setFromMatrixPosition(entity.mesh.matrixWorld);
      _ndc.project(camera);

      const screenX =
        (_ndc.x * 0.5 + 0.5) * containerRect.width + containerRect.left;
      const screenY =
        (-_ndc.y * 0.5 + 0.5) * containerRect.height + containerRect.top;

      if (
        screenX >= rectPx.left &&
        screenX <= rectPx.right &&
        screenY >= rectPx.top &&
        screenY <= rectPx.bottom
      ) {
        result.push(entity);
      }
    }
    return result;
  }

  function refreshPivot() {
    if (selected.length < 2) return;
    _box3.makeEmpty();
    for (const e of selected) _box3.expandByObject(e.mesh);
    _box3.getCenter(_center);

    pivot.position.copy(_center);
    pivot.quaternion.set(0, 0, 0, 1);
    pivot.scale.set(1, 1, 1);

    _prevPos.copy(pivot.position);
    _prevQuat.copy(pivot.quaternion);
    _prevScale.copy(pivot.scale);

    _offsets = selected.map((e) => ({
      pos: e.mesh.position.clone().sub(pivot.position),
      quat: e.mesh.quaternion.clone(),
    }));
  }

  return {
    getSelected,
    setSelected,
    clear,
    queryRect,
    syncToMeshes,
    refreshPivot,
    pivot,
  };
}
