import { applyModelTexture } from "../model/modelTexture.js";
import { isKnownType } from "../entityFactory.js";
import { logger } from "../../core/logger.js";
import { Toast } from "../../ui/toasts/toastTypes.js";
import { Popup } from "../../ui/popup/popupTypes.js";
import { t } from "../../i18n/i18n.js";

const LOG = "SceneLoader";
const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;
const MAX_LISTED = 10;

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function labelOf(e, index) {
  const id = e?.id ?? "?";
  return typeof e?.name === "string" && e.name
    ? `"${e.name}" (id:${id})`
    : `entity #${index} (id:${id})`;
}

function skip(report, label, reason) {
  report.skipped.push(`${label}: ${reason}`);
  logger.warn(LOG, `Skipped ${label}: ${reason}`);
}

function repair(report, label, detail) {
  report.repaired.push(`${label}: ${detail}`);
  logger.warn(LOG, `Repaired ${label}: ${detail}`);
}

function validVec3(v) {
  return Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)
    ? v
    : null;
}

function readTransform(
  e,
  label,
  report,
  keys = ["position", "rotation", "scale"],
) {
  const t = {};
  const invalid = [];
  for (const key of keys) {
    const v = validVec3(e[key]);
    if (v) t[key] = v;
    else invalid.push(key);
  }
  if (invalid.length > 0) {
    repair(
      report,
      label,
      `${invalid.join(", ")} missing or invalid; kept the defaults`,
    );
  }
  return t;
}

function applyTransform(entity, t) {
  if (t.position) entity.mesh.position.fromArray(t.position);
  if (t.rotation) {
    entity.mesh.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2]);
  }
  if (t.scale) entity.mesh.scale.fromArray(t.scale);
}

function readName(e) {
  return typeof e.name === "string" && e.name.trim() ? e.name : undefined;
}

function readActive(e) {
  return typeof e.active === "boolean" ? e.active : true;
}

function readColor(e, label, report) {
  if (e.color == null) return undefined;
  if (typeof e.color === "string" && HEX_COLOR.test(e.color)) {
    return parseInt(e.color.replace("#", ""), 16);
  }
  repair(
    report,
    label,
    `invalid color ${JSON.stringify(e.color)}; kept the default`,
  );
  return undefined;
}

function mergeComponents(entity, saved, label, report) {
  if (saved == null) return;
  if (!isPlainObject(saved)) {
    repair(report, label, "components is not an object; ignored");
    return;
  }

  entity.components ??= {};
  for (const [name, value] of Object.entries(saved)) {
    if (isPlainObject(value)) {
      entity.components[name] = {
        ...(entity.components[name] ?? {}),
        ...value,
      };
    } else if (entity.components[name] === undefined) {
      entity.components[name] = value; // componente desconocido: se conserva
    } else {
      repair(report, label, `component "${name}" is not an object; ignored`);
    }
  }
}

function classify(entities, report) {
  const regular = [];
  const models = [];
  let savedSun = null;

  for (const [index, e] of entities.entries()) {
    const label = labelOf(e, index);

    if (!isPlainObject(e)) {
      skip(report, label, "not an object");
      continue;
    }
    if (e.type === "sun") {
      if (savedSun) repair(report, label, "duplicate sun ignored");
      else savedSun = e;
      continue;
    }
    if (e.type === "model") {
      if (typeof e.modelPath !== "string" || !e.modelPath) {
        skip(report, label, "model without a valid modelPath");
        continue;
      }
      models.push({ e, label });
      continue;
    }
    if (!isKnownType(e.type)) {
      skip(report, label, `unknown type ${JSON.stringify(e.type)}`);
      continue;
    }
    regular.push({ e, label });
  }

  return { regular, models, savedSun };
}

export function needsBackup(report) {
  return report.skipped.length > 0 || report.repaired.length > 0;
}

function fileNameOf(path) {
  return String(path).split(/[\\/]/).pop();
}

export async function loadSavedEntities(
  saved,
  sceneManager,
  sun,
  projectData,
  onProgress,
) {
  const report = { skipped: [], repaired: [] };
  const { regular, models, savedSun } = classify(saved.entities, report);

  const added = await _loadRegularEntities(
    regular,
    sceneManager,
    report,
    onProgress,
  );
  await _loadModelEntities(models, sceneManager, projectData, added, report);
  _restoreSun(savedSun, sun, sceneManager, report);

  return { added, report };
}

async function _loadRegularEntities(entries, sceneManager, report, onProgress) {
  const items = entries.map(({ e, label }) => ({
    type: e.type,
    options: {
      id: e.id,
      name: readName(e),
      color: readColor(e, label, report),
      active: readActive(e),
      hierarchyOrder: e.hierarchyOrder,
    },
    _label: label,
    _transform: readTransform(e, label, report),
    _components: e.components,
  }));

  return sceneManager.addBatch(
    items,
    (entity, item) => {
      applyTransform(entity, item._transform);
      mergeComponents(entity, item._components, item._label, report);
      if (!entity.active) sceneManager.setActive(entity.id, false);
    },
    onProgress,
    (item, err) => skip(report, item._label, `could not be created: ${err}`),
  );
}

async function _loadModelEntities(
  entries,
  sceneManager,
  projectData,
  added,
  report,
) {
  let missingFiles = 0;

  for (const { e, label } of entries) {
    try {
      const absolutePath = `${projectData._folder}/assets/${e.modelPath}`;
      const entity = await sceneManager.addModel(absolutePath, e.modelPath, {
        id: e.id,
        name: readName(e),
        active: readActive(e),
        hierarchyOrder: e.hierarchyOrder,
        silentErrors: true,
      });

      if (entity._loadError) {
        missingFiles++;
        logger.warn(
          LOG,
          `Model file for ${label} could not be loaded; showing a placeholder (its reference is kept)`,
        );
      }

      entity.components ??= {};
      mergeComponents(entity, e.components, label, report);

      const texturePath = entity.components.model?.texture;
      if (typeof texturePath === "string" && texturePath) {
        applyModelTexture(entity, projectData, texturePath).catch((err) =>
          logger.error(
            LOG,
            `Unexpected error applying texture "${texturePath}" to ${label} | Error: ${err}`,
          ),
        );
      }

      applyTransform(entity, readTransform(e, label, report));
      entity.mesh.visible = entity.active;
      added.push(entity);
    } catch (err) {
      skip(report, label, `model could not be added: ${err}`);
    }
  }

  // Un único aviso en vez de un toast por modelo
  if (missingFiles > 0) Toast.failedToLoadModel();
}

function _restoreSun(savedSun, sun, sceneManager, report) {
  if (!savedSun) return;

  const t = readTransform(savedSun, "sun", report, ["position", "rotation"]);
  if (t.rotation) {
    sun.entity.mesh.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2]);
  }
  if (t.position) sun.entity.mesh.position.fromArray(t.position);
  if (Number.isFinite(savedSun.hierarchyOrder)) {
    sceneManager.setHierarchyOrder(sun.entity.id, savedSun.hierarchyOrder);
  }
  sun.update();
}

export function notifyLoadReport(report, backup = null) {
  if (report.skipped.length === 0) return;

  const listed = report.skipped.slice(0, MAX_LISTED);
  const extra = report.skipped.length - listed.length;
  const summary = listed.join("\n") + (extra > 0 ? `\n… +${extra}` : "");

  const backupNote = backup?.path
    ? t("popups.sceneLoadIssues.backupSaved").replace(
        "{file}",
        fileNameOf(backup.path),
      )
    : backup?.error
      ? t("popups.sceneLoadIssues.backupFailed")
      : "";

  Popup.sceneLoadIssues(
    report.skipped.length,
    summary,
    report.skipped.join("\n"),
    backupNote,
  ).catch((err) =>
    logger.error(LOG, `Could not show load report popup | Error: ${err}`),
  );
}
