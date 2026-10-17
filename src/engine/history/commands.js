import * as THREE from "three";
import { EventType } from "./historyManager.js";
import { applyModelTexture } from "../world/model/modelTexture.js";
import { logger } from "../core/logger.js";
import { Toast } from "../ui/toasts/toastTypes.js";

// ----------------- FUNCTIONES AUXILIARES -----------------
async function applyClonedTexture(entity, projectData) {
  const texture = entity.components?.model?.texture;
  if (!texture) return;

  if (!projectData) {
    logger.error(
      "History",
      `Cannot apply texture "${texture}" to "${entity.name}": projectData was not provided`,
    );
    Toast.failedToLoadTexture();
    return;
  }

  await applyModelTexture(entity, projectData, texture);
}

function captureSnapshot(sceneManager, entity) {
  if (!entity?.mesh) {
    throw new Error("Cannot snapshot an entity without a mesh");
  }
  if (entity.type === "model" && (!entity._absolutePath || !entity.modelPath)) {
    throw new Error(
      `Model "${entity.name}" has no source path, so it could not be restored after deleting`,
    );
  }
  const index = sceneManager.indexOf(entity.id);
  if (index < 0) {
    throw new Error(
      `Entity "${entity.name}" (id:${entity.id}) is not in the scene`,
    );
  }

  return {
    id: entity.id,
    entity,
    type: entity.type,
    name: entity.name,
    active: entity.active ?? true, // default del esquema, igual que al cargar escenas
    hierarchyOrder: entity.hierarchyOrder, // undefined: el registro asigna uno
    position: entity.mesh.position.clone(),
    quaternion: entity.mesh.quaternion.clone(),
    scale: entity.mesh.scale.clone(),
    color: entity.mesh.material?.color?.getHex() ?? null, // null = sin color
    modelPath: entity.modelPath ?? null,
    index,
    _absolutePath: entity._absolutePath ?? null,
    components: entity.components ? structuredClone(entity.components) : null,
  };
}

async function restoreEntity(sceneManager, s, projectData) {
  let entity;

  if (s.type === "model") {
    entity = await sceneManager.addModel(s._absolutePath, s.modelPath, {
      id: s.id,
      name: s.name,
      active: s.active,
      index: s.index,
      hierarchyOrder: s.hierarchyOrder,
    });
  } else {
    entity = sceneManager.addAt(s.index, s.type, {
      id: s.id,
      name: s.name,
      color: s.color,
      position: s.position,
      active: s.active,
      hierarchyOrder: s.hierarchyOrder,
    });
    if (!entity) {
      throw new Error(`Could not recreate "${s.name}" (type: ${s.type})`);
    }
  }

  if (s.components) {
    entity.components = structuredClone(s.components);
    await applyClonedTexture(entity, projectData);
  }

  entity.mesh.position.copy(s.position);
  entity.mesh.quaternion.copy(s.quaternion);
  entity.mesh.scale.copy(s.scale);
  if (!s.active) sceneManager.setActive(entity.id, false);

  return entity;
}
// -------------------------------------------------------

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
export function CreateModelCommand(
  sceneManager,
  absolutePath,
  modelPath,
  options,
  onCreated,
) {
  let entity = null;
  return {
    type: EventType.CreateObject,
    async execute() {
      entity = await sceneManager.addModel(absolutePath, modelPath, options);
      onCreated?.(entity);
    },
    undo() {
      if (entity) sceneManager.remove(entity.id);
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

export function DuplicateCommand(
  sceneManager,
  sourceEntity,
  onCreated,
  projectData,
) {
  let entity = null;
  return {
    type: EventType.CreateObject,
    async execute() {
      if (sourceEntity.type === "model") {
        entity = await sceneManager.addModel(
          sourceEntity._absolutePath,
          sourceEntity.modelPath,
          { name: sourceEntity.name + " (copy)" },
        );
        entity.mesh.position
          .copy(sourceEntity.mesh.position)
          .add(new THREE.Vector3(1, 0, 0));
        entity.components = structuredClone(sourceEntity.components ?? {});
        await applyClonedTexture(entity, projectData);
      } else {
        const hasColor = !!sourceEntity.mesh.material?.color;

        entity = sceneManager.add(sourceEntity.type, {
          name: sourceEntity.name + " (copy)",
          color: hasColor
            ? sourceEntity.mesh.material.color.getHex()
            : undefined,
          position: sourceEntity.mesh.position
            .clone()
            .add(new THREE.Vector3(1, 0, 0)),
        });

        if (sourceEntity.components) {
          entity.components = structuredClone(sourceEntity.components);
        }
      }
      entity.mesh.quaternion.copy(sourceEntity.mesh.quaternion);
      entity.mesh.scale.copy(sourceEntity.mesh.scale);
      onCreated?.(entity);
    },
    undo() {
      if (entity) sceneManager.remove(entity.id);
    },
  };
}

export function DeleteCommand(sceneManager, entity, projectData) {
  if (entity.type === "sun") throw new Error("The sun cannot be deleted");
  const snapshot = captureSnapshot(sceneManager, entity);

  return {
    type: EventType.DeleteObject,
    execute() {
      if (!sceneManager.remove(entity.id)) {
        throw new Error(`Could not delete "${entity.name}" (id:${entity.id})`);
      }
    },
    async undo() {
      await restoreEntity(sceneManager, snapshot, projectData);
    },
  };
}

export function MultiDeleteCommand(sceneManager, entities, projectData) {
  const deletable = entities.filter((e) => e.type !== "sun");
  if (deletable.length !== entities.length) {
    logger.warn("History", "The sun was excluded from a multi-delete");
  }
  if (deletable.length === 0) throw new Error("Nothing to delete");

  const snapshots = deletable.map((e) => captureSnapshot(sceneManager, e));

  return {
    type: EventType.DeleteObject,
    async execute() {
      await sceneManager.removeBatch(snapshots.map((s) => s.id));
    },
    async undo() {
      let failures = 0;

      for (const s of snapshots.filter((s) => s.type === "model")) {
        try {
          await restoreEntity(sceneManager, s, projectData);
        } catch (e) {
          failures++;
          logger.error(
            "History",
            `Could not restore "${s.name}" | Error: ${e}`,
          );
        }
      }

      const primitives = snapshots.filter((s) => s.type !== "model");
      if (primitives.length > 0) {
        const items = primitives.map((s) => ({
          type: s.type,
          options: {
            id: s.id,
            name: s.name,
            color: s.color,
            position: s.position,
            active: s.active,
            hierarchyOrder: s.hierarchyOrder,
          },
          index: s.index,
          _source: s,
        }));

        try {
          await sceneManager.addBatch(items, (entity, item) => {
            const src = item._source;
            entity.mesh.quaternion.copy(src.quaternion);
            entity.mesh.scale.copy(src.scale);
            if (src.components) {
              entity.components = structuredClone(src.components);
            }
            if (!src.active) sceneManager.setActive(entity.id, false);
          });
        } catch (e) {
          failures++;
          logger.error("History", `Could not restore primitives | Error: ${e}`);
        }
      }

      if (failures > 0) Toast.generalError();
    },
  };
}

export function MultiDuplicateCommand(
  sceneManager,
  entities,
  onCreated,
  projectData,
) {
  let created = [];
  return {
    type: EventType.CreateObject,
    async execute() {
      created = [];

      for (const e of entities) {
        let entity;
        if (e.type === "model") {
          entity = await sceneManager.addModel(e._absolutePath, e.modelPath, {
            name: e.name + " (copy)",
          });
          entity.mesh.position
            .copy(e.mesh.position)
            .add(new THREE.Vector3(1, 0, 0));
          entity.components = structuredClone(e.components ?? {});
          await applyClonedTexture(entity, projectData);
        } else {
          const hasColor = !!e.mesh.material?.color;

          entity = sceneManager.add(e.type, {
            name: e.name + " (copy)",
            color: hasColor ? e.mesh.material.color.getHex() : undefined,
            position: e.mesh.position.clone().add(new THREE.Vector3(1, 0, 0)),
          });

          if (e.components) {
            entity.components = structuredClone(e.components);
          }
        }
        entity.mesh.quaternion.copy(e.mesh.quaternion);
        entity.mesh.scale.copy(e.mesh.scale);
        created.push(entity);
      }

      onCreated?.(created);
    },
    async undo() {
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
