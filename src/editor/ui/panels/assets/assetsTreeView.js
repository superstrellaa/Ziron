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
import { activateAssets } from "../../../systems/app/selectionContext.js";
import { logger } from "../../../../engine/core/logger.js";
import { findParent } from "./assetsContext.js";

const TREE_ICONS = {
  Folder,
  FolderOpen,
  FolderClosed,
  ChevronDown,
  ChevronRight,
  Box,
  Container,
  Package,
  FileImage,
};

export function initTreeView(ctx) {
  function renderTree(nodes, parent, depth = 0) {
    for (const node of nodes) {
      const row = document.createElement("div");
      row.className = "assets-tree-row";
      if (ctx.selectedNode === node) row.classList.add("selected");
      row.style.paddingLeft = `${8 + depth * 16}px`;

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
        ctx.treeEl
          .querySelectorAll(".assets-tree-row.selected")
          .forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
        ctx.selectedNode = node;

        if (hasAnyChildren) {
          node.expanded = !node.expanded;
        }

        const isFolder =
          node.type === "root" ||
          node.type === "folder-scenes" ||
          node.type === "asset-folder" ||
          node.children !== undefined;

        if (isFolder) {
          ctx.navigateTo(node);
        } else {
          const parentNode = findParent(ctx.treeData, node);
          if (parentNode) {
            ctx.renderGrid(parentNode);
            setTimeout(() => {
              ctx.gridEl
                .querySelectorAll(".assets-grid-card")
                .forEach((card) => {
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
        ctx.selectedNode = node;
        ctx.treeEl
          .querySelectorAll(".assets-tree-row.selected")
          .forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
        ctx.showContextMenu(e.clientX, e.clientY, node);
      });

      parent.appendChild(row);

      if (hasAnyChildren && node.expanded) {
        renderTree(node.children, parent, depth + 1);
      }
    }

    createIcons({
      icons: TREE_ICONS,
      attrs: { width: 13, height: 13 },
      root: parent,
    });
  }

  ctx.rebuildTree = function rebuildTree() {
    ctx.treeEl.innerHTML = "";
    renderTree(ctx.treeData, ctx.treeEl);
  };
}
