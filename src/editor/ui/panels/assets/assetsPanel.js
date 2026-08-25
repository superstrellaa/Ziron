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
import { initTexturePreview } from "../../../systems/assets/texturePreview.js";
import { initModelPreview } from "../../../systems/assets/modelPreview.js";
import { t } from "../../../../engine/i18n/i18n.js";

import { createAssetsContext } from "./assetsContext.js";
import { buildInitialTreeData } from "./assetsTreeLoader.js";
import { initTreeView } from "./assetsTreeView.js";
import { initGridView } from "./assetsGridView.js";
import { initContextMenu } from "./assetsContextMenu.js";
import { initFolderActions } from "./assetsFolderActions.js";
import { initFileActions } from "./assetsFileActions.js";
import { initNavigation } from "./assetsNavigation.js";

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

  const ctx = createAssetsContext({
    panel,
    treeEl,
    gridEl,
    projectData,
    callbacks,
  });

  await buildInitialTreeData(ctx);

  initTreeView(ctx);
  initGridView(ctx);
  initFolderActions(ctx);
  initFileActions(ctx);
  initContextMenu(ctx);
  initNavigation(ctx);

  ctx.rebuildTree();
  ctx.renderGrid(ctx.treeData[0]);

  return { panel };
}
