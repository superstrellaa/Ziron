import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { createIcons, Image, X } from "lucide";
import { t } from "../../i18n/i18n.js";

let overlay = null;
let currentResolve = null;

export function initAssetPickerSystem() {
  overlay = document.createElement("div");
  overlay.id = "asset-picker-overlay";
  overlay.innerHTML = `<div id="asset-picker-box"></div>`;
  document.body.appendChild(overlay);
}

function flattenFiles(node, basePath, out) {
  for (const f of node.files ?? []) {
    out.push({
      name: f.name,
      relativePath: basePath ? `${basePath}/${f.name}` : f.name,
    });
  }
  for (const folder of node.folders ?? []) {
    const sub = basePath ? `${basePath}/${folder.name}` : folder.name;
    flattenFiles(folder, sub, out);
  }
}

export function openAssetPicker({
  projectData,
  extensions,
  titleKey = "assetPicker.title",
}) {
  return new Promise(async (resolve) => {
    if (currentResolve) return;
    currentResolve = resolve;

    const box = overlay.querySelector("#asset-picker-box");
    box.innerHTML = `
      <div class="asset-picker-header">
        <span class="asset-picker-title">${t(titleKey)}</span>
        <button id="asset-picker-close"><i data-lucide="x"></i></button>
      </div>
      <div class="asset-picker-grid" id="asset-picker-grid">
        <div class="asset-picker-empty">${t("assetPicker.loading")}</div>
      </div>
    `;

    createIcons({ icons: { X }, attrs: { width: 14, height: 14 }, root: box });
    box
      .querySelector("#asset-picker-close")
      .addEventListener("click", () => close(null));

    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        overlay.classList.add("asset-picker-visible"),
      ),
    );

    let tree;
    try {
      tree = await invoke("list_assets_by_extension", {
        projectFolder: projectData._folder,
        extensions,
      });
    } catch (e) {
      close(null);
      return;
    }

    const files = [];
    flattenFiles(tree, "", files);

    const grid = box.querySelector("#asset-picker-grid");
    grid.innerHTML = "";

    if (files.length === 0) {
      grid.innerHTML = `<div class="asset-picker-empty">${t("assetPicker.empty")}</div>`;
    }

    for (const file of files) {
      const card = document.createElement("div");
      card.className = "asset-picker-card";
      const absolutePath = `${projectData._folder}/assets/${file.relativePath}`;

      card.innerHTML = `
        <img src="${convertFileSrc(absolutePath)}" class="asset-picker-thumb" loading="lazy" />
        <span class="asset-picker-label">${file.name}</span>
      `;

      card.addEventListener("click", () => close(file.relativePath));
      grid.appendChild(card);
    }
  });
}

function close(result) {
  overlay.classList.remove("asset-picker-visible");
  overlay.classList.add("asset-picker-hiding");
  overlay.addEventListener(
    "transitionend",
    () => {
      overlay.classList.remove("asset-picker-hiding");
      overlay.querySelector("#asset-picker-box").innerHTML = "";
      const resolve = currentResolve;
      currentResolve = null;
      resolve?.(result);
    },
    { once: true },
  );
}
