import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../../engine/core/logger.js";
import { Popup } from "../../../../engine/ui/popup/popupTypes.js";
import { Toast } from "../../../../engine/ui/toasts/toastTypes.js";
import { findParent, getNodePath } from "./assetsContext.js";
import { buildAssetFileNode } from "./assetsTreeLoader.js";

export function initFileActions(ctx) {
  ctx.importTexture = async function importTexture() {
    const sourcePaths = await invoke("pick_texture_files");
    if (!sourcePaths || sourcePaths.length === 0) return;

    const targetFolder = getNodePath(ctx, ctx.currentFolderNode);
    const targetNode =
      ctx.currentFolderNode.type === "asset-folder" ||
      ctx.currentFolderNode.type === "root"
        ? ctx.currentFolderNode
        : ctx.treeData[0];

    for (const sourcePath of sourcePaths) {
      try {
        const fileName = await invoke("import_asset_file", {
          projectFolder: ctx.projectData._folder,
          sourcePath,
          targetFolder,
        });
        logger.info(
          "Assets",
          `Imported texture "${fileName}" → "${targetFolder || "assets/"}"`,
        );

        const diskPath = targetFolder
          ? `${targetFolder}/${fileName}`
          : fileName;
        targetNode.children.push(buildAssetFileNode(fileName, diskPath));
      } catch (e) {
        logger.warn("Assets", `Failed to import texture "${sourcePath}": ${e}`);
        Toast.failedToImportTexture();
        Popup.error(
          "Failed to import texture: " +
            (typeof e === "string" ? e : (e?.message ?? String(e))),
        );
      }
    }

    ctx.rebuildTree();
    ctx.renderGrid(targetNode);
  };

  ctx.importModel = async function importModel() {
    const sourcePath = await invoke("pick_model_file");
    if (!sourcePath) return;

    const targetFolder = getNodePath(ctx, ctx.currentFolderNode);

    try {
      const fileName = await invoke("import_asset_file", {
        projectFolder: ctx.projectData._folder,
        sourcePath,
        targetFolder,
      });
      logger.info(
        "Assets",
        `Imported "${fileName}" → "${targetFolder || "assets/"}"`,
      );

      const diskPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
      const node = buildAssetFileNode(fileName, diskPath);

      const targetNode =
        ctx.currentFolderNode.type === "asset-folder" ||
        ctx.currentFolderNode.type === "root"
          ? ctx.currentFolderNode
          : ctx.treeData[0];

      targetNode.children.push(node);
      ctx.rebuildTree();
      ctx.renderGrid(targetNode);
    } catch (e) {
      logger.warn("Assets", `Failed to import model: ${e}`);
      Toast.failedToImportModel();
      Popup.error(
        "Failed to import model: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  };

  ctx.deleteModel = async function deleteModel(node) {
    const result = await Popup.deleteFolderConfirm(node.label);
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
    const newName = stem + " Copy" + ext;

    const parentPath = getNodePath(
      ctx,
      findParent(ctx.treeData, node) ?? ctx.currentFolderNode,
    );
    const destPath = parentPath ? `${parentPath}/${newName}` : newName;

    try {
      await invoke("copy_asset_file", {
        projectFolder: ctx.projectData._folder,
        sourcePath: node._diskPath,
        destPath,
      });
      logger.info("Assets", `Duplicated model "${node.label}" → "${newName}"`);
      const newNode = buildAssetFileNode(newName, destPath);
      const parent = findParent(ctx.treeData, node) ?? ctx.currentFolderNode;
      parent.children.push(newNode);
      ctx.rebuildTree();
      ctx.renderGrid(ctx.currentFolderNode);
    } catch (e) {
      logger.warn("Assets", `Failed to duplicate model "${node.label}": ${e}`);
      Toast.failedToDuplicateModel();
      Popup.error(
        "Failed to duplicate model: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
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
