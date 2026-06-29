import {
  createIcons,
  Folder,
  FolderOpen,
  FolderClosed,
  ChevronDown,
  ChevronRight,
  Box,
  Container,
  Package,
  FileImage,
} from "lucide";
import {
  initTexturePreview,
  showTexturePreview,
  hideTexturePreview,
  moveTexturePreview,
} from "../../systems/rendering/texturePreview.js";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../../../engine/i18n/i18n.js";
import {
  activateAssets,
  onClearAssets,
  getContext,
} from "../../systems/app/selectionContext.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";
import { logger } from "../../../engine/core/logger.js";

import {
  setDraggingModel,
  clearDraggingModel,
} from "../../systems/app/dragState.js";
import {
  initModelPreview,
  showModelPreview,
  hideModelPreview,
  moveModelPreview,
} from "../../systems/rendering/modelPreview.js";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";

export async function createAssetsPanel(
  container,
  projectData,
  callbacks = {},
) {
  const panel = document.createElement("div");
  panel.id = "assets-panel";

  panel.innerHTML = `
    <div id="assets-header">
      <i data-lucide="folder"></i>
      <span id="assets-title">${t("assets.header")}</span>
    </div>
    <div id="assets-body">
      <div id="assets-tree"></div>
      <div id="assets-grid"></div>
    </div>
  `;

  container.appendChild(panel);

  createIcons({
    icons: {
      Folder,
      FolderOpen,
      FolderClosed,
      ChevronDown,
      ChevronRight,
      Box,
      Container,
      Package,
      FileImage,
    },
    attrs: { width: 13, height: 13, stroke: "#cccccc" },
    root: panel,
  });

  const treeEl = panel.querySelector("#assets-tree");
  const gridEl = panel.querySelector("#assets-grid");

  initModelPreview();
  initTexturePreview();

  // ── Cargar carpetas de assets desde disco ────────────────────────────────
  const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

  function getExt(name) {
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
  }

  function isImageFile(name) {
    return IMAGE_EXTENSIONS.includes(getExt(name));
  }

  function buildAssetFileNode(name, diskPath) {
    if (isImageFile(name)) {
      return {
        label: name,
        icon: "file-image",
        iconColor: "#34d399",
        type: "asset-texture",
        _diskName: name,
        _diskPath: diskPath,
      };
    }
    return {
      label: name,
      icon: "package",
      iconColor: "#60a5fa",
      type: "asset-model",
      _diskName: name,
      _diskPath: diskPath,
    };
  }

  function buildAssetFolderNodeRecursive(folderNode, parentPath = "") {
    const diskPath = parentPath
      ? `${parentPath}/${folderNode.name}`
      : folderNode.name;
    const node = buildAssetFolderNode(folderNode.name, diskPath);
    node.children = [
      ...folderNode.children.map((child) =>
        buildAssetFolderNodeRecursive(child, diskPath),
      ),
      ...(folderNode.files ?? []).map((f) =>
        buildAssetFileNode(f.name, `${diskPath}/${f.name}`),
      ),
    ];
    return node;
  }

  async function loadAssetFolders() {
    try {
      const tree = await invoke("list_asset_tree", {
        projectFolder: projectData._folder,
      });
      logger.info("Assets", `Loaded asset tree from disk`);
      return tree; // { folders, files }
    } catch (e) {
      logger.warn("Assets", `Failed to load asset tree: ${e}`);
      Toast.generalError();
      Popup.error(
        "Failed to load asset tree: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
      return { folders: [], files: [] };
    }
  }

  function buildAssetFolderNode(name, diskPath = null) {
    return {
      label: name,
      icon: "folder",
      iconColor: "#6b7280",
      expanded: false,
      type: "asset-folder",
      _diskName: name,
      _diskPath: diskPath ?? name,
      children: [],
    };
  }

  // ── Árbol base ────────────────────────────────────────────────────────────
  const scenesNode = {
    label: t("assets.scenes"),
    icon: "folder",
    iconColor: "#6b7280",
    expanded: true,
    type: "folder-scenes",
    children: [
      {
        label:
          projectData?.startup_scene
            ?.replace("scenes/", "")
            .replace(".ziron.scene", "") ?? "main",
        icon: "container",
        iconColor: "#a78bfa",
        type: "scene",
      },
    ],
  };

  const assetTree = await loadAssetFolders();
  const assetFolderNodes = assetTree.folders.map((node) =>
    buildAssetFolderNodeRecursive(node),
  );
  const assetRootFileNodes = (assetTree.files ?? []).map((f) =>
    buildAssetFileNode(f.name, f.name),
  );

  const treeData = [
    {
      label: t("assets.project"),
      icon: "folder",
      iconColor: "#7c5cbf",
      expanded: true,
      type: "root",
      children: [scenesNode, ...assetFolderNodes, ...assetRootFileNodes],
    },
  ];

  let _selectedNode = null;
  let _lastClickedItem = null;
  let _currentFolderNode = treeData[0];
  let _selectedNodes = new Set();
  let _contextMenu = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  onClearAssets(() => {
    _selectedNodes.clear();
    _selectedNode = null;
    _lastClickedItem = null;
    gridEl
      .querySelectorAll(".assets-grid-card.active")
      .forEach((c) => c.classList.remove("active"));
    treeEl
      .querySelectorAll(".assets-tree-row.selected")
      .forEach((r) => r.classList.remove("selected"));
  });

  function getNodePath(node) {
    const parts = [];
    let current = node;
    while (current && current.type !== "root") {
      if (current._diskName) parts.unshift(current._diskName);
      current = findParent(treeData, current);
    }
    return parts.join("/");
  }

  function updateChildPaths(node, basePath) {
    for (const child of node.children ?? []) {
      if (child._diskName) {
        child._diskPath = `${basePath}/${child._diskName}`;
        updateChildPaths(child, child._diskPath);
      }
    }
  }

  function findParent(nodes, target, parent = null) {
    for (const node of nodes) {
      if (node === target) return parent;
      if (node.children) {
        const found = findParent(node.children, target, node);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  function findNodeByLabel(nodes, label) {
    for (const node of nodes) {
      if (node.label === label) return node;
      if (node.children) {
        const found = findNodeByLabel(node.children, label);
        if (found) return found;
      }
    }
    return null;
  }

  // KEYBINDS
  window.addEventListener("keydown", (e) => {
    if (getContext() !== "assets") return;

    if (e.key === "F2") {
      e.preventDefault();
      if (_selectedNode?.type === "asset-folder") {
        startRenameFolder(_selectedNode);
      } else if (
        _selectedNode?.type === "asset-model" ||
        _selectedNode?.type === "asset-texture"
      ) {
        startRenameModel(_selectedNode);
      }
    }

    if (e.key === "Delete") {
      e.preventDefault();
      if (_selectedNodes.size > 0) {
        for (const node of _selectedNodes) {
          if (node.type === "asset-folder") deleteFolder(node);
          else if (node.type === "asset-model" || node.type === "asset-texture")
            deleteModel(node);
        }
        _selectedNodes.clear();
      } else if (_selectedNode?.type === "asset-folder") {
        deleteFolder(_selectedNode);
      } else if (
        _selectedNode?.type === "asset-model" ||
        _selectedNode?.type === "asset-texture"
      ) {
        deleteModel(_selectedNode);
      }
    }
  });

  // ── Context menu ──────────────────────────────────────────────────────────
  function closeContextMenu() {
    if (_contextMenu) {
      _contextMenu.remove();
      _contextMenu = null;
    }
  }

  document.addEventListener("click", closeContextMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeContextMenu();
  });

  function showContextMenu(x, y, targetNode, isBackground = false) {
    closeContextMenu();

    const menu = document.createElement("div");
    menu.className = "ctx-menu-wrapper";
    menu.style.left = x + "px";
    menu.style.top = y + "px";

    const ul = document.createElement("ul");
    ul.className = "ctx-menu";

    const isFileNode =
      targetNode?.type === "asset-model" ||
      targetNode?.type === "asset-texture";

    const showImportAction =
      isBackground ||
      !targetNode ||
      targetNode.type === "root" ||
      targetNode.type === "folder-scenes" ||
      targetNode.type === "asset-folder" ||
      isFileNode;

    if (showImportAction) {
      if (
        isBackground ||
        !targetNode ||
        targetNode.type === "root" ||
        targetNode.type === "asset-folder"
      ) {
        ul.appendChild(
          makeCtxItem(t("assets.addFolder"), async () => {
            closeContextMenu();
            await createFolder();
          }),
        );
      }
      ul.appendChild(buildImportSubmenu());
    }

    if (!isBackground && targetNode?.type === "asset-folder") {
      ul.appendChild(makeCtxSeparator());
      ul.appendChild(
        makeCtxItem(t("contextMenu.rename"), () => {
          closeContextMenu();
          startRenameFolder(targetNode);
        }),
      );
      ul.appendChild(
        makeCtxItem(t("contextMenu.duplicate"), async () => {
          closeContextMenu();
          await duplicateFolder(targetNode);
        }),
      );
      ul.appendChild(makeCtxSeparator());
      ul.appendChild(
        makeCtxItem(
          t("contextMenu.delete"),
          async () => {
            closeContextMenu();
            await deleteFolder(targetNode);
          },
          true,
        ),
      );
    }

    if (!isBackground && isFileNode) {
      ul.appendChild(makeCtxSeparator());
      ul.appendChild(
        makeCtxItem(t("contextMenu.rename"), () => {
          closeContextMenu();
          startRenameModel(targetNode);
        }),
      );
      ul.appendChild(
        makeCtxItem(t("contextMenu.duplicate"), async () => {
          closeContextMenu();
          await duplicateModel(targetNode);
        }),
      );
      ul.appendChild(makeCtxSeparator());
      ul.appendChild(
        makeCtxItem(
          t("contextMenu.delete"),
          async () => {
            closeContextMenu();
            await deleteModel(targetNode);
          },
          true,
        ),
      );
    }

    if (ul.children.length === 0) return;

    menu.appendChild(ul);
    document.body.appendChild(menu);
    _contextMenu = menu;

    createIcons({
      icons: { ChevronRight },
      attrs: { width: 12, height: 12, stroke: "#6b7280" },
      root: menu,
    });

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = x - rect.width + "px";
    if (rect.bottom > window.innerHeight)
      menu.style.top = y - rect.height + "px";
  }

  function makeCtxItem(label, onClick, danger = false) {
    const li = document.createElement("li");
    li.className = "ctx-item" + (danger ? " ctx-item--danger" : "");
    li.innerHTML = `<span class="ctx-label">${label}</span>`;
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return li;
  }

  function makeCtxSeparator() {
    const sep = document.createElement("div");
    sep.className = "ctx-separator";
    return sep;
  }

  function buildImportSubmenu() {
    const li = document.createElement("li");
    li.className = "ctx-item ctx-has-sub";
    li.innerHTML = `<span class="ctx-label">${t("contextMenu.import")}</span><i data-lucide="chevron-right"></i>`;

    const sub = document.createElement("ul");
    sub.className = "ctx-menu ctx-submenu";

    sub.appendChild(
      makeCtxItem(t("assets.importModel"), async () => {
        closeContextMenu();
        await importModel();
      }),
    );
    sub.appendChild(
      makeCtxItem(t("assets.importTexture"), async () => {
        closeContextMenu();
        await importTexture();
      }),
    );

    li.appendChild(sub);

    let closeTimer = null;
    li.addEventListener("mouseenter", () => {
      clearTimeout(closeTimer);
      sub.style.display = "block";
      adjustSubmenuPosition(li, sub);
    });
    li.addEventListener("mouseleave", (e) => {
      if (sub.contains(e.relatedTarget)) return;
      closeTimer = setTimeout(() => (sub.style.display = "none"), 120);
    });
    sub.addEventListener("mouseenter", () => clearTimeout(closeTimer));
    sub.addEventListener("mouseleave", () => {
      closeTimer = setTimeout(() => (sub.style.display = "none"), 120);
    });

    return li;
  }

  function adjustSubmenuPosition(li, sub) {
    sub.style.left = "";
    sub.style.right = "";
    sub.style.top = "";

    const liRect = li.getBoundingClientRect();
    const subRect = sub.getBoundingClientRect();

    if (liRect.right + subRect.width > window.innerWidth) {
      sub.style.left = "auto";
      sub.style.right = "calc(100% - 4px)";
    } else {
      sub.style.left = "calc(100% - 4px)";
      sub.style.right = "auto";
    }

    if (liRect.top + subRect.height > window.innerHeight) {
      sub.style.top = "auto";
      sub.style.bottom = "0";
    } else {
      sub.style.top = "-4px";
      sub.style.bottom = "auto";
    }
  }

  // ── Operaciones de carpeta ────────────────────────────────────────────────
  async function createFolder() {
    const name = await promptFolderName(t("assets.newFolderName"));
    if (!name) return;

    const parentPath = getNodePath(_currentFolderNode);
    const folderPath = parentPath ? `${parentPath}/${name}` : name;

    const targetNode =
      _currentFolderNode.type === "asset-folder" ||
      _currentFolderNode.type === "root"
        ? _currentFolderNode
        : treeData[0];

    try {
      await invoke("create_asset_folder", {
        projectFolder: projectData._folder,
        folderPath,
      });
      logger.info("Assets", `Created folder "${folderPath}"`);

      const node = buildAssetFolderNode(name, folderPath);
      targetNode.children.push(node);
      rebuildTree();
      renderGrid(targetNode);
    } catch (e) {
      logger.warn("Assets", `Failed to create folder "${folderPath}": ${e}`);
      Toast.generalError();
      Popup.error(
        "Failed to create folder: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  }

  async function deleteFolder(node) {
    const result = await Popup.deleteFolderConfirm(node.label);
    if (result !== "delete") return;
    try {
      await invoke("delete_asset_folder", {
        projectFolder: projectData._folder,
        folderName: node._diskPath ?? node._diskName,
      });
      logger.info("Assets", `Deleted folder "${node.label}"`);
      const parent = findParent(treeData, node);
      if (parent) parent.children = parent.children.filter((c) => c !== node);

      if (_selectedNode === node) _selectedNode = null;
      _selectedNodes.delete(node);
      _lastClickedItem = _lastClickedItem === node ? null : _lastClickedItem;

      const nextFolder =
        _currentFolderNode === node
          ? (findParent(treeData, node) ?? treeData[0])
          : _currentFolderNode;

      rebuildTree();
      renderGrid(nextFolder);
    } catch (e) {
      logger.warn("Assets", `Failed to delete folder "${node.label}": ${e}`);
      Toast.generalError();
      Popup.error(
        "Failed to delete folder: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
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

  async function duplicateFolder(node) {
    const parent = findParent(treeData, node) ?? treeData[0];
    const parentPath = getNodePath(parent);
    const sourcePath = node._diskPath ?? node._diskName;
    const newName = node._diskName + " Copy";
    const destPath = parentPath ? `${parentPath}/${newName}` : newName;

    try {
      await invoke("copy_asset_folder", {
        projectFolder: projectData._folder,
        sourcePath,
        destPath,
      });
      logger.info("Assets", `Duplicated folder "${node.label}" → "${newName}"`);

      const newNode = buildCopiedNode(node, parentPath);
      parent.children.push(newNode);
      rebuildTree();
      renderGrid(parent);
    } catch (e) {
      logger.warn("Assets", `Failed to duplicate folder "${node.label}": ${e}`);
      Toast.generalError();
      Popup.error(
        "Failed to duplicate folder: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  }

  function startRenameFolder(node) {
    const rows = treeEl.querySelectorAll(".assets-tree-row");
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
        rebuildTree();
        return;
      }

      const parentPath = getNodePath(findParent(treeData, node) ?? treeData[0]);
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      const oldPath = node._diskPath ?? node._diskName;

      try {
        await invoke("rename_asset_folder", {
          projectFolder: projectData._folder,
          oldName: oldPath,
          newName: newPath,
        });
        logger.info("Assets", `Renamed folder "${oldName}" → "${newName}"`);
        node.label = newName;
        node._diskName = newName;
        node._diskPath = newPath;
        updateChildPaths(node, newPath);
        rebuildTree();
        renderGrid(findParent(treeData, node) ?? treeData[0]);
      } catch (e) {
        logger.warn("Assets", `Failed to rename folder "${oldName}": ${e}`);
        Toast.generalError();
        Popup.error(
          "Failed to rename folder: " +
            (typeof e === "string" ? e : (e?.message ?? String(e))),
        );
        rebuildTree();
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
  }

  function promptFolderName(placeholder) {
    return new Promise((resolve) => {
      const promptEl = document.createElement("div");
      promptEl.className = "assets-folder-prompt";
      promptEl.innerHTML = `
      <i data-lucide="folder" style="color:#6b7280; flex-shrink:0;"></i>
      <input class="assets-folder-prompt-input" type="text"
        placeholder="${placeholder}" spellcheck="false" autocomplete="off" />
    `;
      gridEl.prepend(promptEl);

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

  // Models y texturas
  async function importTexture() {
    const sourcePaths = await invoke("pick_texture_files");
    if (!sourcePaths || sourcePaths.length === 0) return;

    const targetFolder = getNodePath(_currentFolderNode);
    const targetNode =
      _currentFolderNode.type === "asset-folder" ||
      _currentFolderNode.type === "root"
        ? _currentFolderNode
        : treeData[0];

    for (const sourcePath of sourcePaths) {
      try {
        const fileName = await invoke("import_asset_file", {
          projectFolder: projectData._folder,
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
        Toast.generalError();
        Popup.error(
          "Failed to import texture: " +
            (typeof e === "string" ? e : (e?.message ?? String(e))),
        );
      }
    }

    rebuildTree();
    renderGrid(targetNode);
  }

  async function importModel() {
    const sourcePath = await invoke("pick_model_file");
    if (!sourcePath) return;

    const targetFolder = getNodePath(_currentFolderNode);

    try {
      const fileName = await invoke("import_asset_file", {
        projectFolder: projectData._folder,
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
        _currentFolderNode.type === "asset-folder" ||
        _currentFolderNode.type === "root"
          ? _currentFolderNode
          : treeData[0];

      targetNode.children.push(node);
      rebuildTree();
      renderGrid(targetNode);
    } catch (e) {
      logger.warn("Assets", `Failed to import model: ${e}`);
      Toast.generalError();
      Popup.error(
        "Failed to import model: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  }

  async function deleteModel(node) {
    const result = await Popup.deleteFolderConfirm(node.label);
    if (result !== "delete") return;
    try {
      await invoke("delete_asset_file", {
        projectFolder: projectData._folder,
        filePath: node._diskPath,
      });
      logger.info("Assets", `Deleted model "${node.label}"`);
      const parent = findParent(treeData, node);
      if (parent) parent.children = parent.children.filter((c) => c !== node);
      if (_selectedNode === node) _selectedNode = null;
      _selectedNodes.delete(node);
      rebuildTree();
      renderGrid(_currentFolderNode);
    } catch (e) {
      logger.warn("Assets", `Failed to delete model "${node.label}": ${e}`);
      Toast.generalError();
      Popup.error(
        "Failed to delete model: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  }

  async function duplicateModel(node) {
    const dotIdx = node._diskName.lastIndexOf(".");
    const stem = dotIdx > 0 ? node._diskName.slice(0, dotIdx) : node._diskName;
    const ext = dotIdx > 0 ? node._diskName.slice(dotIdx) : "";
    const newName = stem + " Copy" + ext;

    const parentPath = getNodePath(
      findParent(treeData, node) ?? _currentFolderNode,
    );
    const destPath = parentPath ? `${parentPath}/${newName}` : newName;

    try {
      await invoke("copy_asset_file", {
        projectFolder: projectData._folder,
        sourcePath: node._diskPath,
        destPath,
      });
      logger.info("Assets", `Duplicated model "${node.label}" → "${newName}"`);
      const newNode = buildAssetFileNode(newName, destPath);
      const parent = findParent(treeData, node) ?? _currentFolderNode;
      parent.children.push(newNode);
      rebuildTree();
      renderGrid(_currentFolderNode);
    } catch (e) {
      logger.warn("Assets", `Failed to duplicate model "${node.label}": ${e}`);
      Toast.generalError();
      Popup.error(
        "Failed to duplicate model: " +
          (typeof e === "string" ? e : (e?.message ?? String(e))),
      );
    }
  }

  function startRenameModel(node) {
    const cards = gridEl.querySelectorAll(".assets-grid-card");
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
        renderGrid(_currentFolderNode);
        return;
      }
      const newName = newStem + ext;
      const parentPath = getNodePath(
        findParent(treeData, node) ?? _currentFolderNode,
      );
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;

      try {
        await invoke("rename_asset_file", {
          projectFolder: projectData._folder,
          oldPath: node._diskPath,
          newPath,
        });
        logger.info("Assets", `Renamed model "${oldName}" → "${newName}"`);
        node.label = newName;
        node._diskName = newName;
        node._diskPath = newPath;
        renderGrid(_currentFolderNode);
      } catch (e) {
        logger.warn("Assets", `Failed to rename model "${oldName}": ${e}`);
        Toast.generalError();
        Popup.error(
          "Failed to rename model: " +
            (typeof e === "string" ? e : (e?.message ?? String(e))),
        );
        renderGrid(_currentFolderNode);
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
  }

  // ── Árbol ─────────────────────────────────────────────────────────────────
  function renderTree(nodes, parent, depth = 0) {
    for (const node of nodes) {
      const row = document.createElement("div");
      row.className = "assets-tree-row";
      if (_selectedNode === node) row.classList.add("selected");
      row.style.paddingLeft = `${8 + depth * 16}px`;

      const hasSubfolders =
        node.children?.some((c) => c.type !== "asset-model") ?? false;

      const hasAnyChildren = (node.children?.length ?? 0) > 0;

      row.innerHTML = `
      <span class="assets-tree-chevron">
    ${
      hasAnyChildren
        ? `<i data-lucide="${node.expanded ? "chevron-down" : "chevron-right"}"></i>`
        : ""
    }
  </span>
      <i data-lucide="${
        node.children !== undefined
          ? node.expanded
            ? "folder-open"
            : "folder-closed"
          : node.icon
      }" class="assets-tree-icon" style="color:${node.iconColor ?? "#6b7280"}"></i>
      <span class="assets-tree-label">${node.label}</span>
    `;

      row.addEventListener("click", () => {
        activateAssets();
        treeEl
          .querySelectorAll(".assets-tree-row.selected")
          .forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
        _selectedNode = node;

        if (hasAnyChildren) {
          node.expanded = !node.expanded;
        }

        const isFolder =
          node.type === "root" ||
          node.type === "folder-scenes" ||
          node.type === "asset-folder" ||
          node.children !== undefined;

        if (isFolder) {
          navigateTo(node);
        } else {
          const parentNode = findParent(treeData, node);
          if (parentNode) {
            renderGrid(parentNode);
            setTimeout(() => {
              gridEl.querySelectorAll(".assets-grid-card").forEach((card) => {
                if (
                  card.querySelector(".assets-grid-label")?.textContent ===
                  node.label
                ) {
                  card.classList.add("active");
                }
              });
            }, 0);
          }
        }

        logger.info(
          "Assets",
          `Selected node "${node.label}" (type: ${node.type})`,
        );
      });

      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        _selectedNode = node;
        treeEl
          .querySelectorAll(".assets-tree-row.selected")
          .forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
        showContextMenu(e.clientX, e.clientY, node);
      });

      parent.appendChild(row);

      if (hasAnyChildren && node.expanded) {
        renderTree(node.children, parent, depth + 1);
      }
    }

    createIcons({
      icons: {
        Folder,
        FolderOpen,
        FolderClosed,
        ChevronDown,
        ChevronRight,
        Box,
        Container,
        Package,
        FileImage,
      },
      attrs: { width: 13, height: 13 },
      root: parent,
    });
  }

  function rebuildTree() {
    treeEl.innerHTML = "";
    renderTree(treeData, treeEl);
  }

  // ── Grid ──────────────────────────────────────────────────────────────────
  function renderGrid(node) {
    _currentFolderNode = node;
    gridEl.innerHTML = "";

    const items = node.type === "scene" ? [node] : (node.children ?? []);

    if (items.length === 0) {
      gridEl.innerHTML = `<div class="assets-grid-empty">${t("assets.empty")}</div>`;
      return;
    }

    for (const item of items) {
      const card = document.createElement("div");
      card.className = "assets-grid-card";
      card._item = item;

      card.innerHTML = `
        <i data-lucide="${item.icon}" class="assets-grid-icon" style="color:${item.iconColor ?? "#a78bfa"}"></i>
        <span class="assets-grid-label">${item.label}</span>
      `;

      if (item.type === "asset-model") {
        const absolutePath = `${projectData._folder}/assets/${item._diskPath}`;

        card.addEventListener("mouseenter", (e) =>
          showModelPreview(absolutePath, item.label, e.clientX, e.clientY),
        );
        card.addEventListener("mouseleave", () => hideModelPreview());
        card.addEventListener("mousemove", (e) =>
          moveModelPreview(e.clientX, e.clientY),
        );

        card.addEventListener("dblclick", async () => {
          if (!callbacks.onAddModel) return;
          const name = item._diskName.replace(/\.[^.]+$/, "");
          await callbacks.onAddModel(absolutePath, item._diskPath, name);
        });

        card.draggable = true;
        card.addEventListener("dragstart", (e) => {
          hideModelPreview();
          const name = item._diskName.replace(/\.[^.]+$/, "");
          const payload = { absolutePath, diskPath: item._diskPath, name };

          setDraggingModel(payload);

          e.dataTransfer.setData("text/plain", ""); // necesario para que algunos WebViews permitan el drag
          e.dataTransfer.effectAllowed = "copy";
        });

        card.addEventListener("dragend", () => {
          clearDraggingModel();
        });
      }

      if (item.type === "asset-texture") {
        const absolutePath = `${projectData._folder}/assets/${item._diskPath}`;

        card.addEventListener("mouseenter", (e) =>
          showTexturePreview(absolutePath, item.label, e.clientX, e.clientY),
        );
        card.addEventListener("mouseleave", () => hideTexturePreview());
        card.addEventListener("mousemove", (e) =>
          moveTexturePreview(e.clientX, e.clientY),
        );
      }

      if (
        item.children !== undefined &&
        (item.type === "asset-folder" || item.children.length > 0)
      ) {
        card.classList.add("assets-grid-card--folder");
        card.addEventListener("dblclick", () => {
          _selectedNode = item;
          item.expanded = true;
          rebuildTree();
          setTimeout(() => {
            treeEl.querySelectorAll(".assets-tree-row").forEach((row) => {
              if (
                row.querySelector(".assets-tree-label")?.textContent ===
                item.label
              ) {
                treeEl
                  .querySelectorAll(".assets-tree-row.selected")
                  .forEach((r) => r.classList.remove("selected"));
                row.classList.add("selected");
              }
            });
          }, 0);
          navigateTo(item);
        });
      }

      card.addEventListener("click", (e) => {
        activateAssets();

        const allCards = [...gridEl.querySelectorAll(".assets-grid-card")];
        const allItems = allCards.map((c) => c._item);

        if (
          e.shiftKey &&
          _lastClickedItem &&
          allItems.includes(_lastClickedItem)
        ) {
          const lastIdx = allItems.indexOf(_lastClickedItem);
          const currIdx = allItems.indexOf(item);
          const [from, to] =
            lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx];

          if (!e.ctrlKey && !e.metaKey) {
            _selectedNodes.clear();
            gridEl
              .querySelectorAll(".assets-grid-card.active")
              .forEach((c) => c.classList.remove("active"));
          }

          for (let i = from; i <= to; i++) {
            _selectedNodes.add(allItems[i]);
            allCards[i].classList.add("active");
          }
          _selectedNode = item;
        } else if (e.ctrlKey || e.metaKey) {
          if (_selectedNodes.has(item)) {
            _selectedNodes.delete(item);
            card.classList.remove("active");
          } else {
            _selectedNodes.add(item);
            card.classList.add("active");
          }
          _selectedNode = item;
          _lastClickedItem = item;
        } else {
          _selectedNodes.clear();
          _selectedNode = item;
          _selectedNodes.add(item);
          _lastClickedItem = item;
          gridEl
            .querySelectorAll(".assets-grid-card.active")
            .forEach((c) => c.classList.remove("active"));
          card.classList.add("active");
        }
      });

      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        gridEl
          .querySelectorAll(".assets-grid-card.active")
          .forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        showContextMenu(e.clientX, e.clientY, item);
      });

      gridEl.appendChild(card);
    }

    createIcons({
      icons: { Folder, Box, Container, Package, FileImage },
      attrs: { width: 28, height: 28 },
      root: gridEl,
    });
  }

  gridEl.addEventListener("contextmenu", (e) => {
    if (
      e.target === gridEl ||
      e.target.classList.contains("assets-grid-empty")
    ) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, _currentFolderNode, true); // ← isBackground
    }
  });

  // ── Deselect al clickar en vacío ──────────────────────────────────────────
  function clearAssetSelection() {
    _selectedNodes.clear();
    _selectedNode = null;
    _lastClickedItem = null;
    gridEl
      .querySelectorAll(".assets-grid-card.active")
      .forEach((c) => c.classList.remove("active"));
    treeEl
      .querySelectorAll(".assets-tree-row.selected")
      .forEach((r) => r.classList.remove("selected"));
  }

  gridEl.addEventListener("mousedown", (e) => {
    if (
      e.target === gridEl ||
      e.target.classList.contains("assets-grid-empty")
    ) {
      clearAssetSelection();
    }
  });

  treeEl.addEventListener("mousedown", (e) => {
    if (e.target === treeEl) {
      clearAssetSelection();
    }
  });

  // ── Historial de navegación ───────────────────────────────────────────────
  const _navHistory = [treeData[0]];
  let _navIndex = 0;

  function navigateTo(node, pushHistory = true) {
    if (pushHistory) {
      _navHistory.splice(_navIndex + 1);
      _navHistory.push(node);
      _navIndex = _navHistory.length - 1;
    }

    _selectedNode = node;
    rebuildTree();

    treeEl.querySelectorAll(".assets-tree-row").forEach((row) => {
      if (row.querySelector(".assets-tree-label")?.textContent === node.label) {
        treeEl
          .querySelectorAll(".assets-tree-row.selected")
          .forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
      }
    });

    renderGrid(node);
  }

  panel.addEventListener("mousedown", (e) => {
    if (e.button === 3) {
      e.preventDefault();
      if (_navIndex > 0) {
        _navIndex--;
        navigateTo(_navHistory[_navIndex], false);
      }
    } else if (e.button === 4) {
      e.preventDefault();
      if (_navIndex < _navHistory.length - 1) {
        _navIndex++;
        navigateTo(_navHistory[_navIndex], false);
      }
    }
  });

  rebuildTree();
  renderGrid(treeData[0]);

  return { panel };
}
