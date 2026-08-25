import { createIcons, ChevronRight } from "lucide";
import { t } from "../../../../engine/i18n/i18n.js";
import {
  registerOpenMenu,
  clearActiveMenu,
} from "../../../../engine/ui/contextMenuRegistry.js";

export function initContextMenu(ctx) {
  function closeContextMenu() {
    if (ctx.contextMenu) {
      ctx.contextMenu.remove();
      ctx.contextMenu = null;
      clearActiveMenu(closeContextMenu);
    }
  }
  ctx.closeContextMenu = closeContextMenu;

  document.addEventListener("click", closeContextMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeContextMenu();
  });

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

  function buildImportSubmenu() {
    const li = document.createElement("li");
    li.className = "ctx-item ctx-has-sub";
    li.innerHTML = `<span class="ctx-label">${t("contextMenu.import")}</span><i data-lucide="chevron-right"></i>`;

    const sub = document.createElement("ul");
    sub.className = "ctx-menu ctx-submenu";

    sub.appendChild(
      makeCtxItem(t("assets.importModel"), async () => {
        closeContextMenu();
        await ctx.importModel();
      }),
    );
    sub.appendChild(
      makeCtxItem(t("assets.importTexture"), async () => {
        closeContextMenu();
        await ctx.importTexture();
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

  ctx.showContextMenu = function showContextMenu(
    x,
    y,
    targetNode,
    isBackground = false,
  ) {
    closeContextMenu();
    registerOpenMenu(closeContextMenu);

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
            await ctx.createFolder();
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
          ctx.startRenameFolder(targetNode);
        }),
      );
      ul.appendChild(
        makeCtxItem(t("contextMenu.duplicate"), async () => {
          closeContextMenu();
          await ctx.duplicateFolder(targetNode);
        }),
      );
      ul.appendChild(makeCtxSeparator());
      ul.appendChild(
        makeCtxItem(
          t("contextMenu.delete"),
          async () => {
            closeContextMenu();
            await ctx.deleteFolder(targetNode);
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
          ctx.startRenameModel(targetNode);
        }),
      );
      ul.appendChild(
        makeCtxItem(t("contextMenu.duplicate"), async () => {
          closeContextMenu();
          await ctx.duplicateModel(targetNode);
        }),
      );
      ul.appendChild(makeCtxSeparator());
      ul.appendChild(
        makeCtxItem(
          t("contextMenu.delete"),
          async () => {
            closeContextMenu();
            await ctx.deleteModel(targetNode);
          },
          true,
        ),
      );
    }

    if (ul.children.length === 0) return;

    menu.appendChild(ul);
    document.body.appendChild(menu);
    ctx.contextMenu = menu;

    createIcons({
      icons: { ChevronRight },
      attrs: { width: 12, height: 12, stroke: "#6b7280" },
      root: menu,
    });

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = x - rect.width + "px";
    if (rect.bottom > window.innerHeight)
      menu.style.top = y - rect.height + "px";
  };
}
