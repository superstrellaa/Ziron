import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../../engine/core/logger.js";
import { Popup } from "../../../../engine/ui/popup/popupTypes.js";
import { Toast } from "../../../../engine/ui/toasts/toastTypes.js";
import { findParent, getNodePath, isImageFile } from "./assetsContext.js";
import { buildAssetFileNode } from "./assetsTreeLoader.js";

const LOG = "Assets";

function errorText(e) {
  return typeof e === "string" ? e : (e?.message ?? String(e));
}

function baseName(path) {
  return String(path).split(/[\\/]/).pop();
}

function addFileNode(targetNode, fileName, diskPath) {
  if (targetNode.children.some((c) => c._diskPath === diskPath)) return;
  targetNode.children.push(buildAssetFileNode(fileName, diskPath));
}

function uniqueCopyName(siblings, stem, ext) {
  const taken = new Set(siblings.map((c) => c._diskName));
  let name = `${stem} Copy${ext}`;
  for (let n = 2; taken.has(name); n++) {
    name = `${stem} Copy ${n}${ext}`;
  }
  return name;
}

async function pickPaths(command, notifyFailure) {
  try {
    const picked = await invoke(command);
    if (Array.isArray(picked)) return picked;
    return picked ? [picked] : [];
  } catch (e) {
    logger.error(LOG, `${command} failed | Error: ${errorText(e)}`);
    notifyFailure();
    Popup.error("Failed to open the file picker: " + errorText(e));
    return [];
  }
}

export function initFileActions(ctx) {
  let importQueue = Promise.resolve();

  async function importPaths(sourcePaths, via) {
    if (!sourcePaths?.length) return;

    const targetFolder = getNodePath(ctx, ctx.currentFolderNode);
    const targetNode =
      ctx.currentFolderNode.type === "asset-folder" ||
      ctx.currentFolderNode.type === "root"
        ? ctx.currentFolderNode
        : ctx.treeData[0];

    let renamed = 0;
    const failures = [];

    for (const sourcePath of sourcePaths) {
      try {
        const fileName = await invoke("import_asset_file", {
          projectFolder: ctx.projectData._folder,
          sourcePath,
          targetFolder,
        });

        const original = baseName(sourcePath);
        if (fileName !== original) {
          renamed++;
          logger.info(
            LOG,
            `"${original}" was already taken; imported as "${fileName}"`,
          );
        }
        logger.info(
          LOG,
          `Imported "${fileName}" (${via}) → "${targetFolder || "assets/"}"`,
        );

        const diskPath = targetFolder
          ? `${targetFolder}/${fileName}`
          : fileName;
        addFileNode(targetNode, fileName, diskPath);
      } catch (e) {
        logger.error(
          LOG,
          `Failed to import "${sourcePath}" (${via}) | Error: ${errorText(e)}`,
        );
        failures.push({ sourcePath, message: errorText(e) });
      }
    }

    ctx.rebuildTree();
    ctx.renderGrid(targetNode);

    // Un unico aviso por lote, no uno por archivo
    if (renamed > 0) Toast.assetRenamedOnImport();

    if (failures.length > 0) {
      if (failures.every((f) => isImageFile(f.sourcePath))) {
        Toast.failedToImportTexture();
      } else {
        Toast.failedToImportModel();
      }
      Popup.error(
        "Failed to import file: " +
          failures
            .map((f) => `${baseName(f.sourcePath)}: ${f.message}`)
            .join("; "),
      );
    }
  }

  function enqueueImport(sourcePaths, via) {
    importQueue = importQueue
      .then(() => importPaths(sourcePaths, via))
      .catch((e) =>
        logger.error(
          LOG,
          `Import failed unexpectedly | Error: ${errorText(e)}`,
        ),
      );
    return importQueue;
  }

  ctx.importTexture = async function importTexture() {
    const sourcePaths = await pickPaths("pick_texture_files", () =>
      Toast.failedToImportTexture(),
    );
    await enqueueImport(sourcePaths, "dialog");
  };

  ctx.importModel = async function importModel() {
    const sourcePaths = await pickPaths("pick_model_file", () =>
      Toast.failedToImportModel(),
    );
    await enqueueImport(sourcePaths, "dialog");
  };

  ctx.importExternalPaths = function importExternalPaths(sourcePaths) {
    return enqueueImport(sourcePaths ?? [], "drag & drop");
  };

  ctx.deleteModel = async function deleteModel(node) {
    const result = await Popup.deleteFileConfirm(node.label);
    if (result !== "delete") return;
    try {
      await invoke("delete_asset_file", {
        projectFolder: ctx.projectData._folder,
        filePath: node._diskPath,
      });
      logger.info("Assets", `Deleted model "${node.label}"`);
      const parent = findParent(ctx.treeData, node);
      if (parent) parent.children = parent.children.filter((c) => c !== node);
      if (ctx.selectedNode === node) ctx.selectedNode = null;
      ctx.selectedNodes.delete(node);
      ctx.rebuildTree();
      ctx.renderGrid(ctx.currentFolderNode);
    } catch (e) {
      logger.warn("Assets", `Failed to delete model "${node.label}": ${e}`);
      Toast.failedToDeleteModel();
      Popup.error(
        "Failed to delete model: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  };

  ctx.duplicateModel = async function duplicateModel(node) {
    const dotIdx = node._diskName.lastIndexOf(".");
    const stem = dotIdx > 0 ? node._diskName.slice(0, dotIdx) : node._diskName;
    const ext = dotIdx > 0 ? node._diskName.slice(dotIdx) : "";

    const parent = findParent(ctx.treeData, node) ?? ctx.currentFolderNode;
    const parentPath = getNodePath(ctx, parent);
    const newName = uniqueCopyName(parent.children, stem, ext);
    const destPath = parentPath ? `${parentPath}/${newName}` : newName;

    try {
      await invoke("copy_asset_file", {
        projectFolder: ctx.projectData._folder,
        sourcePath: node._diskPath,
        destPath,
      });
      logger.info(LOG, `Duplicated model "${node.label}" → "${newName}"`);
      parent.children.push(buildAssetFileNode(newName, destPath));
      ctx.rebuildTree();
      ctx.renderGrid(ctx.currentFolderNode);
    } catch (e) {
      logger.error(
        LOG,
        `Failed to duplicate model "${node.label}" | Error: ${errorText(e)}`,
      );
      Toast.failedToDuplicateModel();
      Popup.error("Failed to duplicate model: " + errorText(e));
    }
  };

  ctx.startRenameModel = function startRenameModel(node) {
    const cards = ctx.gridEl.querySelectorAll(".assets-grid-card");
    let targetCard = null;
    cards.forEach((card) => {
      if (card._item === node) targetCard = card;
    });
    if (!targetCard) return;

    const labelEl = targetCard.querySelector(".assets-grid-label");
    const oldName = node._diskName;
    const dotIdx = oldName.lastIndexOf(".");
    const stem = dotIdx > 0 ? oldName.slice(0, dotIdx) : oldName;
    const ext = dotIdx > 0 ? oldName.slice(dotIdx) : "";

    const input = document.createElement("input");
    input.className = "assets-folder-prompt-input";
    input.value = stem;
    input.spellcheck = false;
    labelEl.replaceWith(input);
    input.focus();
    input.select();

    async function commit() {
      const newStem = input.value.trim();
      if (!newStem || newStem + ext === oldName) {
        ctx.renderGrid(ctx.currentFolderNode);
        return;
      }
      const newName = newStem + ext;
      const parentPath = getNodePath(
        ctx,
        findParent(ctx.treeData, node) ?? ctx.currentFolderNode,
      );
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;

      try {
        await invoke("rename_asset_file", {
          projectFolder: ctx.projectData._folder,
          oldPath: node._diskPath,
          newPath,
        });
        logger.info("Assets", `Renamed model "${oldName}" → "${newName}"`);
        node.label = newName;
        node._diskName = newName;
        node._diskPath = newPath;
        ctx.renderGrid(ctx.currentFolderNode);
      } catch (e) {
        logger.warn("Assets", `Failed to rename model "${oldName}": ${e}`);
        Toast.failedToRenameModel();
        Popup.error(
          "Failed to rename model: " +
            (typeof e === "string" ? e : (e?.message ?? String(e))),
        );
        ctx.renderGrid(ctx.currentFolderNode);
      }
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        input.value = stem;
        input.blur();
      }
    });
  };
}
