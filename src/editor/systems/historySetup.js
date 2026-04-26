import * as THREE from "three";
import { createHistoryManager } from "../../engine/history/historyManager.js";
import {
  MoveCommand,
  RotateCommand,
  ScaleCommand,
  DuplicateCommand,
  MultiDeleteCommand,
  MultiDuplicateCommand,
  DeleteCommand,
  MultiTransformCommand,
} from "../../engine/history/commands.js";
import { onKeybind } from "./keybinds.js";

export function setupHistory(tc, selection, sceneManager) {
  const history = createHistoryManager();

  let _multiSnapshotBefore = null;

  onKeybind(["DELETE", "UNDO", "REDO", "DUPLICATE"], (e, action) => {
    if (action === "UNDO") {
      e.preventDefault();
      history.undo();
      return;
    }
    if (action === "REDO") {
      e.preventDefault();
      history.redo();
      return;
    }

    if (action === "DELETE") {
      const multiSelected = selection.getMultiSelected();
      if (multiSelected.length > 0) {
        const cmd = MultiDeleteCommand(sceneManager, multiSelected);
        cmd.execute();
        history.push(cmd);
        selection.deselect();
        return;
      }
      const entity = selection.getSelected();
      if (!entity || entity.type === "sun") return;
      const cmd = DeleteCommand(sceneManager, entity);
      cmd.execute();
      history.push(cmd);
      selection.deselect();
      return;
    }

    if (action === "DUPLICATE") {
      e.preventDefault();
      const multiSelected = selection.getMultiSelected();
      if (multiSelected.length > 0) {
        const cmd = MultiDuplicateCommand(
          sceneManager,
          multiSelected,
          (created) => selection.selectMultiple(created),
        );
        cmd.execute();
        history.push(cmd);
        return;
      }
      const entity = selection.getSelected();
      if (!entity || entity.type === "sun") return;
      const cmd = DuplicateCommand(sceneManager, entity);
      cmd.execute();
      history.push(cmd);
    }
  });

  const _posBefore = new THREE.Vector3();
  const _quatBefore = new THREE.Quaternion();
  const _scaleBefore = new THREE.Vector3();

  tc.addEventListener("mouseDown", () => {
    const mesh = tc.object;
    if (!mesh) return;
    _posBefore.copy(mesh.position);
    _quatBefore.copy(mesh.quaternion);
    _scaleBefore.copy(mesh.scale);

    const multiSelected = selection.getMultiSelected();
    if (multiSelected.length > 1) {
      _multiSnapshotBefore = multiSelected.map((e) => ({
        entity: e,
        position: e.mesh.position.clone(),
        quaternion: e.mesh.quaternion.clone(),
        scale: e.mesh.scale.clone(),
      }));
    } else {
      _multiSnapshotBefore = null;
    }
  });

  tc.addEventListener("mouseUp", () => {
    const mesh = tc.object;
    if (!mesh) return;

    const multiSelected = selection.getMultiSelected();
    if (multiSelected.length > 1 && _multiSnapshotBefore) {
      const before = _multiSnapshotBefore;
      const after = multiSelected.map((e) => ({
        entity: e,
        position: e.mesh.position.clone(),
        quaternion: e.mesh.quaternion.clone(),
        scale: e.mesh.scale.clone(),
      }));
      const changed = before.some(
        (b, i) =>
          !b.position.equals(after[i].position) ||
          !b.quaternion.equals(after[i].quaternion) ||
          !b.scale.equals(after[i].scale),
      );
      if (changed)
        history.push(MultiTransformCommand(before, after, selection));
      return;
    }

    const mode = tc.getMode();
    if (mode === "translate") {
      const from = _posBefore.clone(),
        to = mesh.position.clone();
      if (!from.equals(to)) history.push(MoveCommand(mesh, from, to));
    } else if (mode === "rotate") {
      const from = _quatBefore.clone(),
        to = mesh.quaternion.clone();
      if (!from.equals(to)) history.push(RotateCommand(mesh, from, to));
    } else if (mode === "scale") {
      const from = _scaleBefore.clone(),
        to = mesh.scale.clone();
      if (!from.equals(to)) history.push(ScaleCommand(mesh, from, to));
    }
  });

  return history;
}
