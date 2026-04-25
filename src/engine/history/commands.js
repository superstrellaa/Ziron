import * as THREE from "three";
import { EventType } from "./historyManager.js";

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
      });
      restoredEntity.mesh.quaternion.copy(snapshot.quaternion);
      restoredEntity.mesh.scale.copy(snapshot.scale);
    },
  };
}

export function MultiDeleteCommand(sceneManager, entities) {
  const snapshots = entities.map((e) => ({
    entity: e,
    type: e.type,
    name: e.name,
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
    undo() {
      for (const s of snapshots) {
        const restored = sceneManager.add(s.type, {
          name: s.name,
          color: s.color,
          position: s.position,
        });
        restored.mesh.quaternion.copy(s.quaternion);
        restored.mesh.scale.copy(s.scale);
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
