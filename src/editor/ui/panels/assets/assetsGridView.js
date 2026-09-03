import {
  createIcons,
  Folder,
  Box,
  Container,
  Package,
  FileImage,
} from "lucide";
import { activateAssets } from "../../../systems/app/selectionContext.js";
import {
  showTexturePreview,
  hideTexturePreview,
  moveTexturePreview,
} from "../../../systems/assets/texturePreview.js";
import {
  showModelPreview,
  hideModelPreview,
  moveModelPreview,
} from "../../../systems/assets/modelPreview.js";
import { beginInternalDrag } from "../../../systems/app/drag/internalDrag.js";
import { t } from "../../../../engine/i18n/i18n.js";

const GRID_ICONS = { Folder, Box, Container, Package, FileImage };

export function initGridView(ctx) {
  ctx.renderGrid = function renderGrid(node) {
    ctx.currentFolderNode = node;
    ctx.gridEl.innerHTML = "";

    const items = node.type === "scene" ? [node] : (node.children ?? []);

    if (items.length === 0) {
      ctx.gridEl.innerHTML = `<div class="assets-grid-empty">${t("assets.empty")}</div>`;
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
        const absolutePath = `${ctx.projectData._folder}/assets/${item._diskPath}`;

        card.addEventListener("mouseenter", (e) =>
          showModelPreview(absolutePath, item.label, e.clientX, e.clientY),
        );
        card.addEventListener("mouseleave", () => hideModelPreview());
        card.addEventListener("mousemove", (e) =>
          moveModelPreview(e.clientX, e.clientY),
        );

        card.addEventListener("dblclick", async () => {
          if (!ctx.callbacks.onAddModel) return;
          const name = item._diskName.replace(/\.[^.]+$/, "");
          await ctx.callbacks.onAddModel(absolutePath, item._diskPath, name);
        });

        card.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          hideModelPreview();
          const name = item._diskName.replace(/\.[^.]+$/, "");
          beginInternalDrag(
            { absolutePath, diskPath: item._diskPath, name },
            e,
          );
        });
      }

      if (item.type === "asset-texture") {
        const absolutePath = `${ctx.projectData._folder}/assets/${item._diskPath}`;

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
          ctx.selectedNode = item;
          item.expanded = true;
          ctx.rebuildTree();
          setTimeout(() => {
            ctx.treeEl.querySelectorAll(".assets-tree-row").forEach((row) => {
              if (
                row.querySelector(".assets-tree-label")?.textContent ===
                item.label
              ) {
                ctx.treeEl
                  .querySelectorAll(".assets-tree-row.selected")
                  .forEach((r) => r.classList.remove("selected"));
                row.classList.add("selected");
              }
            });
          }, 0);
          ctx.navigateTo(item);
        });
      }

      card.addEventListener("click", (e) => {
        activateAssets();

        const allCards = [...ctx.gridEl.querySelectorAll(".assets-grid-card")];
        const allItems = allCards.map((c) => c._item);

        if (
          e.shiftKey &&
          ctx.lastClickedItem &&
          allItems.includes(ctx.lastClickedItem)
        ) {
          const lastIdx = allItems.indexOf(ctx.lastClickedItem);
          const currIdx = allItems.indexOf(item);
          const [from, to] =
            lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx];

          if (!e.ctrlKey && !e.metaKey) {
            ctx.selectedNodes.clear();
            ctx.gridEl
              .querySelectorAll(".assets-grid-card.active")
              .forEach((c) => c.classList.remove("active"));
          }

          for (let i = from; i <= to; i++) {
            ctx.selectedNodes.add(allItems[i]);
            allCards[i].classList.add("active");
          }
          ctx.selectedNode = item;
        } else if (e.ctrlKey || e.metaKey) {
          if (ctx.selectedNodes.has(item)) {
            ctx.selectedNodes.delete(item);
            card.classList.remove("active");
          } else {
            ctx.selectedNodes.add(item);
            card.classList.add("active");
          }
          ctx.selectedNode = item;
          ctx.lastClickedItem = item;
        } else {
          ctx.selectedNodes.clear();
          ctx.selectedNode = item;
          ctx.selectedNodes.add(item);
          ctx.lastClickedItem = item;
          ctx.gridEl
            .querySelectorAll(".assets-grid-card.active")
            .forEach((c) => c.classList.remove("active"));
          card.classList.add("active");
        }
      });

      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ctx.gridEl
          .querySelectorAll(".assets-grid-card.active")
          .forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        ctx.showContextMenu(e.clientX, e.clientY, item);
      });

      ctx.gridEl.appendChild(card);
    }

    createIcons({
      icons: GRID_ICONS,
      attrs: { width: 28, height: 28 },
      root: ctx.gridEl,
    });
  };

  ctx.gridEl.addEventListener("contextmenu", (e) => {
    if (
      e.target === ctx.gridEl ||
      e.target.classList.contains("assets-grid-empty")
    ) {
      e.preventDefault();
      ctx.showContextMenu(e.clientX, e.clientY, ctx.currentFolderNode, true); // ← isBackground
    }
  });

  ctx.gridEl.addEventListener("mousedown", (e) => {
    if (
      e.target === ctx.gridEl ||
      e.target.classList.contains("assets-grid-empty")
    ) {
      ctx.clearAssetSelection();
    }
  });
}
