import * as THREE from "three";
import { createHistoryManager } from "../../../engine/history/historyManager.js";
import {
  MoveCommand,
  RotateCommand,
  ScaleCommand,
  DuplicateCommand,
  MultiDeleteCommand,
  MultiDuplicateCommand,
  DeleteCommand,
  MultiTransformCommand,
} from "../../../engine/history/commands.js";
import { onKeybind } from "../input/keybinds.js";
import { getClipboard, setClipboard } from "../../scene/contextMenu.js";
import { getContext } from "../app/selectionContext.js";
import { logger } from "../../../engine/core/logger.js";
import { createCommandRunner } from "../../../engine/history/commandRunner.js";

const LOG = "History";

export function setupHistory(tc, selection, sceneManager, projectData) {
  const history = createHistoryManager();
  const runner = createCommandRunner(history);

  let _multiSnapshotBefore = null;

  const reselect = (entity) => {
    selection.deselect();
    selection.selectEntity(entity);
  };

  const unsubKeybinds = onKeybind(
    ["DELETE", "UNDO", "REDO", "DUPLICATE", "COPY", "PASTE"],
    async (e, action) => {
      if (action === "UNDO") {
        e.preventDefault();
        await runner.step("Undo", () => history.undo());
        return;
      }
      if (action === "REDO") {
        e.preventDefault();
        await runner.step("Redo", () => history.redo());
        return;
      }

      if (action === "DELETE") {
        if (getContext() !== "scene") return;
        const multiSelected = selection.getMultiSelected();
        if (multiSelected.length > 0) {
          if (multiSelected.every((s) => s.type === "sun")) return;
          const cmd = await runner.run("Multi delete", () =>
            MultiDeleteCommand(sceneManager, multiSelected, projectData),
          );
          if (cmd) selection.deselect();
          return;
        }
        const entity = selection.getSelected();
        if (!entity || entity.type === "sun") return;
        const cmd = await runner.run("Delete", () =>
          DeleteCommand(sceneManager, entity, projectData),
        );
        if (cmd) selection.deselect();
        return;
      }

      if (action === "DUPLICATE") {
        e.preventDefault();
        const multiSelected = selection.getMultiSelected();
        if (multiSelected.length > 0) {
          const cmd = await runner.run("Multi duplicate", () =>
            MultiDuplicateCommand(
              sceneManager,
              multiSelected,
              (created) => selection.selectMultiple(created),
              projectData,
            ),
          );
          return;
        }
        const entity = selection.getSelected();
        if (!entity || entity.type === "sun") return;
        await runner.run("Duplicate", () =>
          DuplicateCommand(sceneManager, entity, reselect, projectData),
        );
        return;
      }

      if (action === "COPY") {
        const entity = selection.getSelected();
        if (!entity || entity.type === "sun") return;
        setClipboard(entity);
        return;
      }

      if (action === "PASTE") {
        e.preventDefault();
        const src = getClipboard();
        if (!src) return;
        await runner.run("Paste", () =>
          DuplicateCommand(sceneManager, src, reselect, projectData),
        );
      }
    },
  );

  const _posBefore = new THREE.Vector3();
  const _quatBefore = new THREE.Quaternion();
  const _scaleBefore = new THREE.Vector3();

  const onGizmoMouseDown = () => {
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
  };

  const onGizmoMouseUp = () => {
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
  };

  tc.addEventListener("mouseDown", onGizmoMouseDown);
  tc.addEventListener("mouseUp", onGizmoMouseUp);

  function destroy() {
    if (typeof unsubKeybinds === "function") {
      unsubKeybinds();
    } else {
      logger.warn(
        LOG,
        "onKeybind did not return an unsubscribe function; history shortcuts were not removed",
      );
    }
    tc.removeEventListener("mouseDown", onGizmoMouseDown);
    tc.removeEventListener("mouseUp", onGizmoMouseUp);
  }

  return { history, runner, destroy };
}
