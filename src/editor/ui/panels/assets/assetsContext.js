export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

export function getExt(name) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function isImageFile(name) {
  return IMAGE_EXTENSIONS.includes(getExt(name));
}

export function createAssetsContext({
  panel,
  treeEl,
  gridEl,
  projectData,
  callbacks,
}) {
  return {
    panel,
    treeEl,
    gridEl,
    projectData,
    callbacks,

    treeData: [],

    selectedNode: null,
    lastClickedItem: null,
    currentFolderNode: null,
    selectedNodes: new Set(),
    contextMenu: null,

    navHistory: [],
    navIndex: 0,

    // Asignados por los distintos initXxx(ctx) — declarados aquí solo para
    // dejar constancia de la forma completa del contexto compartido.
    rebuildTree: null,
    renderGrid: null,
    navigateTo: null,
    clearAssetSelection: null,
    showContextMenu: null,
    closeContextMenu: null,
    createFolder: null,
    deleteFolder: null,
    duplicateFolder: null,
    startRenameFolder: null,
    importModel: null,
    importTexture: null,
    deleteModel: null,
    duplicateModel: null,
    startRenameModel: null,
  };
}

export function findParent(nodes, target, parent = null) {
  for (const node of nodes) {
    if (node === target) return parent;
    if (node.children) {
      const found = findParent(node.children, target, node);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function findNodeByLabel(nodes, label) {
  for (const node of nodes) {
    if (node.label === label) return node;
    if (node.children) {
      const found = findNodeByLabel(node.children, label);
      if (found) return found;
    }
  }
  return null;
}

export function getNodePath(ctx, node) {
  const parts = [];
  let current = node;
  while (current && current.type !== "root") {
    if (current._diskName) parts.unshift(current._diskName);
    current = findParent(ctx.treeData, current);
  }
  return parts.join("/");
}

export function updateChildPaths(node, basePath) {
  for (const child of node.children ?? []) {
    if (child._diskName) {
      child._diskPath = `${basePath}/${child._diskName}`;
      updateChildPaths(child, child._diskPath);
    }
  }
}
