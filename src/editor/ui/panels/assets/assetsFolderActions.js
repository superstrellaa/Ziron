import { invoke } from "@tauri-apps/api/core";
import { createIcons, Folder } from "lucide";
import { t } from "../../../../engine/i18n/i18n.js";
import { logger } from "../../../../engine/core/logger.js";
import { Popup } from "../../../../engine/ui/popup/popupTypes.js";
import { Toast } from "../../../../engine/ui/toasts/toastTypes.js";
import { findParent, getNodePath, updateChildPaths } from "./assetsContext.js";
import { buildAssetFolderNode } from "./assetsTreeLoader.js";

export function initFolderActions(ctx) {
  function promptFolderName(placeholder) {
    return new Promise((resolve) => {
      const promptEl = document.createElement("div");
      promptEl.className = "assets-folder-prompt";
      promptEl.innerHTML = `
      <i data-lucide="folder" style="color:#6b7280; flex-shrink:0;"></i>
      <input class="assets-folder-prompt-input" type="text"
        placeholder="${placeholder}" spellcheck="false" autocomplete="off" />
    `;
      ctx.gridEl.prepend(promptEl);

      createIcons({
        icons: { Folder },
        attrs: { width: 28, height: 28 },
        root: promptEl,
      });

      const input = promptEl.querySelector("input");
      input.focus();

      let _done = false;

      function finish() {
        if (_done) return;
        _done = true;
        const val = input.value.trim();
        promptEl.remove();
        resolve(val || null);
      }

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish();
        }
        if (e.key === "Escape") {
          if (_done) return;
          _done = true;
          promptEl.remove();
          resolve(null);
        }
      });
      input.addEventListener("blur", finish);
    });
  }

  function buildCopiedNode(node, parentPath) {
    const newName = node._diskName + " Copy";
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;
    const newNode = buildAssetFolderNode(newName, newPath);

    for (const child of node.children ?? []) {
      if (child.type === "asset-folder") {
        newNode.children.push(buildCopiedNode(child, newPath));
      }
    }
    return newNode;
  }

  ctx.createFolder = async function createFolder() {
    const name = await promptFolderName(t("assets.newFolderName"));
    if (!name) return;

    const parentPath = getNodePath(ctx, ctx.currentFolderNode);
    const folderPath = parentPath ? `${parentPath}/${name}` : name;

    const targetNode =
      ctx.currentFolderNode.type === "asset-folder" ||
      ctx.currentFolderNode.type === "root"
        ? ctx.currentFolderNode
        : ctx.treeData[0];

    try {
      await invoke("create_asset_folder", {
        projectFolder: ctx.projectData._folder,
        folderPath,
      });
      logger.info("Assets", `Created folder "${folderPath}"`);

      const node = buildAssetFolderNode(name, folderPath);
      targetNode.children.push(node);
      ctx.rebuildTree();
      ctx.renderGrid(targetNode);
    } catch (e) {
      logger.warn("Assets", `Failed to create folder "${folderPath}": ${e}`);
      Toast.failedToCreateFolder();
      Popup.error(
        "Failed to create folder: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  };

  ctx.deleteFolder = async function deleteFolder(node) {
    const result = await Popup.deleteFolderConfirm(node.label);
    if (result !== "delete") return;
    try {
      await invoke("delete_asset_folder", {
        projectFolder: ctx.projectData._folder,
        folderName: node._diskPath ?? node._diskName,
      });
      logger.info("Assets", `Deleted folder "${node.label}"`);
      const parent = findParent(ctx.treeData, node);
      if (parent) parent.children = parent.children.filter((c) => c !== node);

      if (ctx.selectedNode === node) ctx.selectedNode = null;
      ctx.selectedNodes.delete(node);
      ctx.lastClickedItem =
        ctx.lastClickedItem === node ? null : ctx.lastClickedItem;

      const nextFolder =
        ctx.currentFolderNode === node
          ? (findParent(ctx.treeData, node) ?? ctx.treeData[0])
          : ctx.currentFolderNode;

      ctx.rebuildTree();
      ctx.renderGrid(nextFolder);
    } catch (e) {
      logger.warn("Assets", `Failed to delete folder "${node.label}": ${e}`);
      Toast.failedToDeleteFolder();
      Popup.error(
        "Failed to delete folder: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  };

  ctx.duplicateFolder = async function duplicateFolder(node) {
    const parent = findParent(ctx.treeData, node) ?? ctx.treeData[0];
    const parentPath = getNodePath(ctx, parent);
    const sourcePath = node._diskPath ?? node._diskName;
    const newName = node._diskName + " Copy";
    const destPath = parentPath ? `${parentPath}/${newName}` : newName;

    try {
      await invoke("copy_asset_folder", {
        projectFolder: ctx.projectData._folder,
        sourcePath,
        destPath,
      });
      logger.info("Assets", `Duplicated folder "${node.label}" → "${newName}"`);

      const newNode = buildCopiedNode(node, parentPath);
      parent.children.push(newNode);
      ctx.rebuildTree();
      ctx.renderGrid(parent);
    } catch (e) {
      logger.warn("Assets", `Failed to duplicate folder "${node.label}": ${e}`);
      Toast.failedToDuplicateFolder();
      Popup.error(
        "Failed to duplicate folder: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  };

  ctx.startRenameFolder = function startRenameFolder(node) {
    const rows = ctx.treeEl.querySelectorAll(".assets-tree-row");
    let targetRow = null;
    rows.forEach((row) => {
      if (row.querySelector(".assets-tree-label")?.textContent === node.label) {
        targetRow = row;
      }
    });
    if (!targetRow) return;

    const labelEl = targetRow.querySelector(".assets-tree-label");
    const oldName = node.label;

    const input = document.createElement("input");
    input.className = "assets-tree-rename-input";
    input.value = oldName;
    input.spellcheck = false;

    labelEl.replaceWith(input);
    input.focus();
    input.select();

    async function commit() {
      const newName = input.value.trim();
      if (!newName || newName === oldName) {
        ctx.rebuildTree();
        return;
      }

      const parentPath = getNodePath(
        ctx,
        findParent(ctx.treeData, node) ?? ctx.treeData[0],
      );
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      const oldPath = node._diskPath ?? node._diskName;

      try {
        await invoke("rename_asset_folder", {
          projectFolder: ctx.projectData._folder,
          oldName: oldPath,
          newName: newPath,
        });
        logger.info("Assets", `Renamed folder "${oldName}" → "${newName}"`);
        node.label = newName;
        node._diskName = newName;
        node._diskPath = newPath;
        updateChildPaths(node, newPath);
        ctx.rebuildTree();
        ctx.renderGrid(findParent(ctx.treeData, node) ?? ctx.treeData[0]);
      } catch (e) {
        logger.warn("Assets", `Failed to rename folder "${oldName}": ${e}`);
        Toast.failedToRenameFolder();
        Popup.error(
          "Failed to rename folder: " +
            (typeof e === "string" ? e : (e?.message ?? String(e))),
        );
        ctx.rebuildTree();
      }
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        input.value = oldName;
        input.blur();
      }
    });
  };
}
