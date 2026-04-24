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
