import {
  onClearAssets,
  getContext,
} from "../../../systems/app/selectionContext.js";

export function initNavigation(ctx) {
  ctx.clearAssetSelection = function clearAssetSelection() {
    ctx.selectedNodes.clear();
    ctx.selectedNode = null;
    ctx.lastClickedItem = null;
    ctx.gridEl
      .querySelectorAll(".assets-grid-card.active")
      .forEach((c) => c.classList.remove("active"));
    ctx.treeEl
      .querySelectorAll(".assets-tree-row.selected")
      .forEach((r) => r.classList.remove("selected"));
  };

  onClearAssets(ctx.clearAssetSelection);

  ctx.treeEl.addEventListener("mousedown", (e) => {
    if (e.target === ctx.treeEl) {
      ctx.clearAssetSelection();
    }
  });

  ctx.navigateTo = function navigateTo(node, pushHistory = true) {
    if (pushHistory) {
      ctx.navHistory.splice(ctx.navIndex + 1);
      ctx.navHistory.push(node);
      ctx.navIndex = ctx.navHistory.length - 1;
    }

    ctx.selectedNode = node;
    ctx.rebuildTree();

    ctx.treeEl.querySelectorAll(".assets-tree-row").forEach((row) => {
      if (row.querySelector(".assets-tree-label")?.textContent === node.label) {
        ctx.treeEl
          .querySelectorAll(".assets-tree-row.selected")
          .forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
      }
    });

    ctx.renderGrid(node);
  };

  ctx.panel.addEventListener("mousedown", (e) => {
    if (e.button === 3) {
      e.preventDefault();
      if (ctx.navIndex > 0) {
        ctx.navIndex--;
        ctx.navigateTo(ctx.navHistory[ctx.navIndex], false);
      }
    } else if (e.button === 4) {
      e.preventDefault();
      if (ctx.navIndex < ctx.navHistory.length - 1) {
        ctx.navIndex++;
        ctx.navigateTo(ctx.navHistory[ctx.navIndex], false);
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if (getContext() !== "assets") return;

    if (e.key === "F2") {
      e.preventDefault();
      if (ctx.selectedNode?.type === "asset-folder") {
        ctx.startRenameFolder(ctx.selectedNode);
      } else if (
        ctx.selectedNode?.type === "asset-model" ||
        ctx.selectedNode?.type === "asset-texture"
      ) {
        ctx.startRenameModel(ctx.selectedNode);
      }
    }

    if (e.key === "Delete") {
      e.preventDefault();
      if (ctx.selectedNodes.size > 0) {
        for (const node of ctx.selectedNodes) {
          if (node.type === "asset-folder") ctx.deleteFolder(node);
          else if (node.type === "asset-model" || node.type === "asset-texture")
            ctx.deleteModel(node);
        }
        ctx.selectedNodes.clear();
      } else if (ctx.selectedNode?.type === "asset-folder") {
        ctx.deleteFolder(ctx.selectedNode);
      } else if (
        ctx.selectedNode?.type === "asset-model" ||
        ctx.selectedNode?.type === "asset-texture"
      ) {
        ctx.deleteModel(ctx.selectedNode);
      }
    }
  });
}
