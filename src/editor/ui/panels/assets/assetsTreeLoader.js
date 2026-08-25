import { invoke } from "@tauri-apps/api/core";
import { t } from "../../../../engine/i18n/i18n.js";
import { logger } from "../../../../engine/core/logger.js";
import { Popup } from "../../../../engine/ui/popup/popupTypes.js";
import { Toast } from "../../../../engine/ui/toasts/toastTypes.js";
import { isImageFile } from "./assetsContext.js";

export function buildAssetFileNode(name, diskPath) {
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

export function buildAssetFolderNode(name, diskPath = null) {
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

export function buildAssetFolderNodeRecursive(folderNode, parentPath = "") {
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

export async function loadAssetFolders(projectData) {
  try {
    const tree = await invoke("list_asset_tree", {
      projectFolder: projectData._folder,
    });
    logger.info("Assets", `Loaded asset tree from disk`);
    return tree; // { folders, files }
  } catch (e) {
    logger.warn("Assets", `Failed to load asset tree: ${e}`);
    Toast.failedToLoadAssetTree();
    Popup.error(
      "Failed to load asset tree: " +
        (typeof e === "string" ? e : (e?.message ?? String(e))),
    );
    return { folders: [], files: [] };
  }
}

export async function buildInitialTreeData(ctx) {
  const scenesNode = {
    label: t("assets.scenes"),
    icon: "folder",
    iconColor: "#6b7280",
    expanded: true,
    type: "folder-scenes",
    children: [
      {
        label:
          ctx.projectData?.startup_scene
            ?.replace("scenes/", "")
            .replace(".ziron.scene", "") ?? "main",
        icon: "container",
        iconColor: "#a78bfa",
        type: "scene",
      },
    ],
  };

  const assetTree = await loadAssetFolders(ctx.projectData);
  const assetFolderNodes = assetTree.folders.map((node) =>
    buildAssetFolderNodeRecursive(node),
  );
  const assetRootFileNodes = (assetTree.files ?? []).map((f) =>
    buildAssetFileNode(f.name, f.name),
  );

  ctx.treeData = [
    {
      label: t("assets.project"),
      icon: "folder",
      iconColor: "#7c5cbf",
      expanded: true,
      type: "root",
      children: [scenesNode, ...assetFolderNodes, ...assetRootFileNodes],
    },
  ];

  ctx.currentFolderNode = ctx.treeData[0];
  ctx.navHistory = [ctx.treeData[0]];
  ctx.navIndex = 0;
}
