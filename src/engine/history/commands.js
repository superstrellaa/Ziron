import * as THREE from "three";
import { EventType } from "./historyManager.js";

// ----------- COMANDO GENERICO PARA PARANOIAS -----------
export function GenericCommand(type, executeFn, undoFn) {
  return {
    type,
    execute() {
      executeFn();
    },
    undo() {
      undoFn();
    },
  };
}
// -------------------------------------------------------

export function MoveCommand(mesh, from, to) {
  return {
    type: EventType.MoveObject,
    execute() {
      mesh.position.copy(to);
    },
    undo() {
      mesh.position.copy(from);
    },
  };
}

export function RotateCommand(mesh, from, to) {
  return {
    type: EventType.RotateObject,
    execute() {
      mesh.quaternion.copy(to);
    },
    undo() {
      mesh.quaternion.copy(from);
    },
  };
}

export function ScaleCommand(mesh, from, to) {
  return {
    type: EventType.ScaleObject,
    execute() {
      mesh.scale.copy(to);
    },
    undo() {
      mesh.scale.copy(from);
    },
  };
}

export function CreateCommand(sceneManager, type, options, onCreated) {
  let entity = null;
  return {
    type: EventType.CreateObject,
    execute() {
      entity = sceneManager.add(type, options);
      onCreated?.(entity);
    },
    undo() {
      if (entity) sceneManager.remove(entity.id);
    },
  };
}

export function DuplicateCommand(sceneManager, sourceEntity, onCreated) {
  let entity = null;
  return {
    type: EventType.CreateObject,
    execute() {
      entity = sceneManager.add(sourceEntity.type, {
        name: sourceEntity.name + " (copy)",
        color: sourceEntity.mesh.material.color.getHex(),
        position: sourceEntity.mesh.position
          .clone()
          .add(new THREE.Vector3(1, 0, 0)),
      });
      entity.mesh.quaternion.copy(sourceEntity.mesh.quaternion);
      entity.mesh.scale.copy(sourceEntity.mesh.scale);
      onCreated?.(entity);
    },
    undo() {
      if (entity) sceneManager.remove(entity.id);
    },
  };
}

export function DeleteCommand(sceneManager, entity) {
  const snapshot = {
    type: entity.type,
    name: entity.name,
    active: entity.active ?? true,
    position: entity.mesh.position.clone(),
    quaternion: entity.mesh.quaternion.clone(),
    scale: entity.mesh.scale.clone(),
    color: entity.mesh.material.color.getHex(),
  };
  let restoredEntity = null;

  return {
    type: EventType.DeleteObject,
    execute() {
      sceneManager.remove(entity.id);
    },
    undo() {
      restoredEntity = sceneManager.add(snapshot.type, {
        name: snapshot.name,
        color: snapshot.color,
        position: snapshot.position,
        active: snapshot.active,
      });
      restoredEntity.mesh.quaternion.copy(snapshot.quaternion);
      restoredEntity.mesh.scale.copy(snapshot.scale);
      if (!snapshot.active) sceneManager.setActive(restoredEntity.id, false);
    },
  };
}

export function MultiDeleteCommand(sceneManager, entities) {
  const snapshots = entities.map((e) => ({
    entity: e,
    type: e.type,
    name: e.name,
    active: e.active ?? true,
    position: e.mesh.position.clone(),
    quaternion: e.mesh.quaternion.clone(),
    scale: e.mesh.scale.clone(),
    color: e.mesh.material.color.getHex(),
  }));

  return {
    type: EventType.DeleteObject,
    execute() {
      for (const s of snapshots) sceneManager.remove(s.entity.id);
    },
    uundo() {
      for (const s of snapshots) {
        const restored = sceneManager.add(s.type, {
          name: s.name,
          color: s.color,
          position: s.position,
          active: s.active,
        });
        restored.mesh.quaternion.copy(s.quaternion);
        restored.mesh.scale.copy(s.scale);
        if (!s.active) sceneManager.setActive(restored.id, false);
      }
    },
  };
}

export function MultiDuplicateCommand(sceneManager, entities, onCreated) {
  let created = [];
  return {
    type: EventType.CreateObject,
    execute() {
      created = entities.map((e) => {
        const dup = sceneManager.add(e.type, {
          name: e.name + " (copy)",
          color: e.mesh.material.color.getHex(),
          position: e.mesh.position.clone().add(new THREE.Vector3(1, 0, 0)),
        });
        dup.mesh.quaternion.copy(e.mesh.quaternion);
        dup.mesh.scale.copy(e.mesh.scale);
        return dup;
      });
      onCreated?.(created);
    },
    undo() {
      for (const e of created) sceneManager.remove(e.id);
      created = [];
    },
  };
}

export function MultiTransformCommand(before, after, selection) {
  return {
    type: EventType.MoveObject,
    execute() {
      for (const s of after) {
        s.entity.mesh.position.copy(s.position);
        s.entity.mesh.quaternion.copy(s.quaternion);
        s.entity.mesh.scale.copy(s.scale);
      }
      selection.refreshMultiPivot();
    },
    undo() {
      for (const s of before) {
        s.entity.mesh.position.copy(s.position);
        s.entity.mesh.quaternion.copy(s.quaternion);
        s.entity.mesh.scale.copy(s.scale);
      }
      selection.refreshMultiPivot();
    },
  };
}

export function MultiSetActiveCommand(sceneManager, entities, value) {
  const oldValues = entities.map((e) => ({ id: e.id, active: e.active }));
  return {
    type: "SetActiveObject",
    execute() {
      entities.forEach((e) => sceneManager.setActive(e.id, value));
    },
    undo() {
      oldValues.forEach(({ id, active }) => sceneManager.setActive(id, active));
    },
  };
}

export function MultiRenameCommand(
  sceneManager,
  entities,
  newName,
  resolved = null,
) {
  const oldNames = entities.map((e) => ({ id: e.id, name: e.name }));
  return {
    type: "RenameObject",
    execute() {
      if (resolved) {
        resolved.forEach(({ entity, name }) =>
          sceneManager.rename(entity.id, name),
        );
      } else {
        entities.forEach((e) => sceneManager.rename(e.id, newName));
      }
    },
    undo() {
      oldNames.forEach(({ id, name }) => sceneManager.rename(id, name));
    },
  };
}

export function RenameCommand(sceneManager, entity, newName) {
  const oldName = entity.name;
  return {
    type: "RenameObject",
    execute() {
      sceneManager.rename(entity.id, newName);
    },
    undo() {
      sceneManager.rename(entity.id, oldName);
    },
  };
}

export function SetActiveCommand(sceneManager, entity, value) {
  const oldValue = entity.active;
  return {
    type: "SetActiveObject",
    execute() {
      sceneManager.setActive(entity.id, value);
    },
    undo() {
      sceneManager.setActive(entity.id, oldValue);
    },
  };
}
