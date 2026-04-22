import * as THREE from "three";
import { createHistoryManager } from "../../engine/history/historyManager.js";
import {
  MoveCommand,
  RotateCommand,
  ScaleCommand,
} from "../../engine/history/commands.js";

export function setupHistory(tc) {
  const history = createHistoryManager();

  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey) return;
    if (e.key === "z") {
      e.preventDefault();
      history.undo();
    }
    if (e.key === "y") {
      e.preventDefault();
      history.redo();
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
  });

  tc.addEventListener("mouseUp", () => {
    const mesh = tc.object;
    if (!mesh) return;
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
