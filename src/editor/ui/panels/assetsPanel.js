import {
  createIcons,
  Folder,
  ChevronDown,
  ChevronRight,
  Box,
  Container,
} from "lucide";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../../../engine/i18n/i18n.js";
import {
  activateAssets,
  onClearAssets,
  getContext,
} from "../../systems/app/selectionContext.js";

export async function createAssetsPanel(container, projectData) {
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
    icons: { Folder, ChevronDown, ChevronRight, Box, Container },
    attrs: { width: 13, height: 13, stroke: "#cccccc" },
    root: panel,
  });

  const treeEl = panel.querySelector("#assets-tree");
  const gridEl = panel.querySelector("#assets-grid");

  // ── Cargar carpetas de assets desde disco ────────────────────────────────
  async function loadAssetFolders() {
    try {
      const folders = await invoke("list_asset_folders", {
        projectFolder: projectData._folder,
      });
      return folders;
    } catch {
      return [];
    }
  }

  function buildAssetFolderNode(name) {
    return {
      label: name,
      icon: "folder",
      iconColor: "#6b7280",
      expanded: false,
      type: "asset-folder",
      _diskName: name,
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

  const assetFolderNames = await loadAssetFolders();
  const assetFolderNodes = assetFolderNames.map(buildAssetFolderNode);

  const treeData = [
    {
      label: t("assets.project"),
      icon: "folder",
      iconColor: "#7c5cbf",
      expanded: true,
      type: "root",
      children: [scenesNode, ...assetFolderNodes],
    },
  ];

  let _selectedNode = null;
  let _selectedNodes = new Set();
  let _contextMenu = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  onClearAssets(() => {
    _selectedNodes.clear();
    _selectedNode = null;
    gridEl
      .querySelectorAll(".assets-grid-card.active")
      .forEach((c) => c.classList.remove("active"));
    treeEl
      .querySelectorAll(".assets-tree-row.selected")
      .forEach((r) => r.classList.remove("selected"));
  });

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
      }
    }

    if (e.key === "Delete") {
      e.preventDefault();
      if (_selectedNodes.size > 0) {
        for (const node of _selectedNodes) {
          if (node.type === "asset-folder") deleteFolder(node);
        }
        _selectedNodes.clear();
      } else if (_selectedNode?.type === "asset-folder") {
        deleteFolder(_selectedNode);
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

  function showContextMenu(x, y, targetNode) {
    closeContextMenu();

    const menu = document.createElement("div");
    menu.className = "ctx-menu-wrapper";
    menu.style.left = x + "px";
    menu.style.top = y + "px";

    const ul = document.createElement("ul");
    ul.className = "ctx-menu";

    if (
      !targetNode ||
      targetNode.type === "root" ||
      targetNode.type === "folder-scenes"
    ) {
      ul.appendChild(
        makeCtxItem(t("assets.addFolder"), async () => {
          closeContextMenu();
          await createFolder();
        }),
      );
    }

    if (targetNode?.type === "asset-folder") {
      ul.appendChild(
        makeCtxItem(t("assets.addFolder"), async () => {
          closeContextMenu();
          await createFolder();
        }),
      );
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

    if (ul.children.length === 0) return;

    menu.appendChild(ul);
    document.body.appendChild(menu);
    _contextMenu = menu;

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

  // ── Operaciones de carpeta ────────────────────────────────────────────────
  async function createFolder() {
    const name = await promptFolderName(t("assets.newFolderName"));
    if (!name) return;

    try {
      await invoke("create_asset_folder", {
        projectFolder: projectData._folder,
        folderName: name,
      });
      const node = buildAssetFolderNode(name);
      treeData[0].children.push(node);
      rebuildTree();
      renderGrid(treeData[0]);
    } catch (e) {
      console.error("Failed to create folder:", e);
    }
  }

  async function deleteFolder(node) {
    try {
      await invoke("delete_asset_folder", {
        projectFolder: projectData._folder,
        folderName: node._diskName,
      });
      const parent = findParent(treeData, node);
      if (parent) {
        parent.children = parent.children.filter((c) => c !== node);
      }
      rebuildTree();
      renderGrid(treeData[0]);
    } catch (e) {
      console.error("Failed to delete folder:", e);
    }
  }

  async function duplicateFolder(node) {
    const newName = node._diskName + " (copy)";
    try {
      await invoke("create_asset_folder", {
        projectFolder: projectData._folder,
        folderName: newName,
      });
      const newNode = buildAssetFolderNode(newName);
      const parent = findParent(treeData, node) ?? treeData[0];
      parent.children.push(newNode);
      rebuildTree();
      renderGrid(parent);
    } catch (e) {
      console.error("Failed to duplicate folder:", e);
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
      try {
        await invoke("rename_asset_folder", {
          projectFolder: projectData._folder,
          oldName: node._diskName,
          newName,
        });
        node.label = newName;
        node._diskName = newName;
        rebuildTree();
        renderGrid(findParent(treeData, node) ?? treeData[0]);
      } catch (e) {
        console.error("Failed to rename folder:", e);
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

  // ── Árbol ─────────────────────────────────────────────────────────────────
  function renderTree(nodes, parent, depth = 0) {
    for (const node of nodes) {
      const row = document.createElement("div");
      row.className = "assets-tree-row";
      if (_selectedNode === node) row.classList.add("selected");
      row.style.paddingLeft = `${8 + depth * 16}px`;

      const hasChildren = node.children?.length > 0;

      row.innerHTML = `
        <span class="assets-tree-chevron">
          ${
            hasChildren
              ? `<i data-lucide="${node.expanded ? "chevron-down" : "chevron-right"}"></i>`
              : ""
          }
        </span>
        <i data-lucide="${node.icon}" class="assets-tree-icon" style="color:${node.iconColor ?? "#6b7280"}"></i>
        <span class="assets-tree-label">${node.label}</span>
      `;

      row.addEventListener("click", () => {
        activateAssets();
        treeEl
          .querySelectorAll(".assets-tree-row.selected")
          .forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
        _selectedNode = node;

        if (hasChildren) {
          node.expanded = !node.expanded;
          rebuildTree();
        }

        const isFolder =
          node.type === "root" ||
          node.type === "folder-scenes" ||
          node.type === "asset-folder" ||
          node.children !== undefined;

        if (isFolder) {
          renderGrid(node);
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

      if (hasChildren && node.expanded) {
        renderTree(node.children, parent, depth + 1);
      }
    }

    createIcons({
      icons: { Folder, ChevronDown, ChevronRight, Box, Container },
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
    gridEl.innerHTML = "";

    const items = node.type === "scene" ? [node] : (node.children ?? []);

    if (items.length === 0) {
      gridEl.innerHTML = `<div class="assets-grid-empty">${t("assets.empty")}</div>`;
      return;
    }

    for (const item of items) {
      const card = document.createElement("div");
      card.className = "assets-grid-card";

      card.innerHTML = `
        <i data-lucide="${item.icon}" class="assets-grid-icon" style="color:${item.iconColor ?? "#a78bfa"}"></i>
        <span class="assets-grid-label">${item.label}</span>
      `;

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
          renderGrid(item);
        });
      }

      card.addEventListener("click", (e) => {
        activateAssets();

        if (e.ctrlKey || e.metaKey) {
          if (_selectedNodes.has(item)) {
            _selectedNodes.delete(item);
            card.classList.remove("active");
          } else {
            _selectedNodes.add(item);
            card.classList.add("active");
          }
          _selectedNode = item;
        } else {
          _selectedNodes.clear();
          _selectedNode = item;
          _selectedNodes.add(item);
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
      icons: { Folder, Box, Container },
      attrs: { width: 28, height: 28 },
      root: gridEl,
    });
  }

  gridEl.addEventListener("contextmenu", (e) => {
    if (e.target === gridEl || e.target.id === "assets-grid-empty") {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, _selectedNode ?? treeData[0]);
    }
  });

  rebuildTree();
  renderGrid(treeData[0]);

  return { panel };
}
