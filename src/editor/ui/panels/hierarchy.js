import { createIcons, Box, Container, TriangleAlert } from "lucide";
import { t } from "../../../engine/i18n/i18n.js";
import { onKeybind } from "../../systems/input/keybinds.js";
import { RenameCommand } from "../../../engine/history/commands.js";
import { getContext } from "../../systems/app/selectionContext.js";
import {
  getDraggingModel,
  clearDraggingModel,
} from "../../systems/app/dragState.js";

export function createHierarchy(
  container,
  sceneManager,
  selection,
  sceneName = "",
  getHistory,
  onAddModel = null,
) {
  const panel = document.createElement("div");
  panel.id = "hierarchy";

  const sceneLabel = sceneName ? ` — ${sceneName.toUpperCase()}` : "";

  panel.innerHTML = `
    <div id="hierarchy-header">
      <i data-lucide="container"></i>
      <span id="hierarchy-title">${t("hierarchy.header")}${sceneLabel}</span>
      <span id="hierarchy-dirty" style="display:none" data-tooltip="Unsaved changes">●</span>
    </div>
    <div id="hierarchy-list"></div>
  `;

  container.appendChild(panel);

  createIcons({
    icons: { Container },
    attrs: { width: 14, height: 14, stroke: "#cccccc" },
  });

  // ------ Escuchadores de eventos ------
  sceneManager.on("onAddBatch", () => render());
  sceneManager.on("onRemoveBatch", () => render());

  sceneManager.on("onAdd", () => render());
  sceneManager.on("onRemove", () => render());

  sceneManager.on("onUpdate", () => render());
  // -------------------------------------

  const list = panel.querySelector("#hierarchy-list");

  let selectedIds = new Set();
  let lastClickedId = null;
  let editingId = null;

  let _ctxMenu = null;

  const rowMap = new Map();

  function render() {
    const entities = sceneManager.getAll();

    for (const [id, row] of rowMap) {
      if (!entities.find((e) => e.id === id)) {
        row.remove();
        rowMap.delete(id);
      }
    }

    let dirty = false;

    for (const entity of entities) {
      if (!rowMap.has(entity.id)) {
        const row = document.createElement("div");
        row.className = "h-row";
        row.dataset.id = entity.id;
        rowMap.set(entity.id, row);
        dirty = true;
      }
    }

    for (const entity of entities) {
      const row = rowMap.get(entity.id);

      const isError = entity._loadError === true;

      const desired = `
        <span class="h-icon"><i data-lucide="${isError ? "triangle-alert" : "box"}"></i></span>
        <span class="h-name ${isError ? "h-name--error" : ""}">${entity.name}</span>
        ${isError ? `<span class="h-error-badge" data-tooltip="Model file not found">!</span>` : ""}
      `;

      if (row.innerHTML !== desired) {
        row.innerHTML = desired;
        dirty = true;
      }

      row.classList.toggle("h-selected", selectedIds.has(entity.id));
      row.classList.toggle("h-inactive", entity.active === false);
      row.classList.toggle("h-error", isError);

      list.appendChild(row);
    }

    if (dirty) {
      createIcons({
        icons: { Box, TriangleAlert },
        attrs: { width: 12, height: 12, stroke: "#cccccc" },
      });
    }

    syncHighlight();
  }

  function syncHighlight() {
    for (const [eid, row] of rowMap) {
      row.classList.toggle("h-selected", selectedIds.has(eid));
    }
  }

  // registrar paranoias para que el rename funcione
  onKeybind("RENAME", (e) => {
    if (getContext() !== "scene") return;
    if (selectedIds.size !== 1) return;
    if (editingId !== null) return;
    e.preventDefault();
    startRename([...selectedIds][0]);
  });

  window.addEventListener("ziron:rename", (e) => {
    const id = e.detail?.id;
    if (!id) return;
    if (!selectedIds.has(id)) {
      const entity = sceneManager.getById(id);
      if (entity) selection.selectEntity(entity);
    }
    startRename(id);
  });

  function startRename(id) {
    if (editingId !== null) commitRename();

    const row = rowMap.get(id);
    if (!row) return;
    const entity = sceneManager.getById(id);
    if (!entity) return;

    editingId = id;

    row.innerHTML = `<input class="h-rename-input" type="text" value="${entity.name}" spellcheck="false" autocomplete="off" />`;
    const input = row.querySelector("input");

    input.focus();
    input.select();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelRename();
      }
    });

    function commitRename() {
      if (editingId !== id) return;
      const newName = input.value.trim();
      editingId = null;
      row.innerHTML = "";
      if (newName && newName !== entity.name) {
        const cmd = RenameCommand(sceneManager, entity, newName);
        cmd.execute();
        getHistory().push(cmd);
      } else {
        render();
      }
    }

    function cancelRename() {
      if (editingId !== id) return;
      editingId = null;
      row.innerHTML = "";
      render();
    }

    input.addEventListener("blur", () => commitRename());
  }

  list.addEventListener("click", (e) => {
    const row = e.target.closest(".h-row");

    if (!row) {
      selection.deselect();
      return;
    }

    const id = Number(row.dataset.id);
    const entity = sceneManager.getById(id);
    if (!entity) return;

    const entities = sceneManager.getAll();

    // al hacer doble click hacer rename, algo de UX por favor
    list.addEventListener("dblclick", (e) => {
      const row = e.target.closest(".h-row");
      if (!row) return;
      const id = Number(row.dataset.id);
      if (!sceneManager.getById(id)) return;
      if (editingId !== null) return;
      startRename(id);
    });

    if (e.shiftKey && lastClickedId !== null) {
      const ids = entities.map((en) => en.id);
      const a = ids.indexOf(lastClickedId);
      const b = ids.indexOf(id);
      const [from, to] = a < b ? [a, b] : [b, a];
      const rangeEntities = entities.slice(from, to + 1);

      selection.selectMultiple(rangeEntities);
    } else if (e.ctrlKey || e.metaKey) {
      const current = selection.getMultiSelected();
      const single = selection.getSelected();

      let all = new Set(current.map((en) => en.id));
      if (single) all.add(single.id);

      if (all.has(id)) {
        all.delete(id);
      } else {
        all.add(id);
      }

      const newEntities = entities.filter((en) => all.has(en.id));

      if (newEntities.length === 0) {
        selection.deselect();
      } else if (newEntities.length === 1) {
        selection.selectEntity(newEntities[0]);
      } else {
        selection.selectMultiple(newEntities);
      }

      lastClickedId = id;
    } else {
      selection.selectEntity(entity);
      lastClickedId = id;
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "F2") return;
    if (getContext() !== "scene") return;
    if (selectedIds.size !== 1) return;
    if (editingId !== null) return;
    e.preventDefault();
    startRename([...selectedIds][0]);
  });

  panel.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const row = e.target.closest(".h-row");

    if (row) {
      const id = Number(row.dataset.id);
      const entity = sceneManager.getById(id);
      if (entity) {
        selection.selectEntity(entity);
        _ctxMenu?.showAt(e.clientX, e.clientY, entity);
      }
    } else {
      _ctxMenu?.showAt(e.clientX, e.clientY, null);
    }
  });

  panel.addEventListener("dragover", (e) => {
    if (!getDraggingModel()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  panel.addEventListener("drop", async (e) => {
    const payload = getDraggingModel();
    if (!payload || !onAddModel) return;
    e.preventDefault();
    clearDraggingModel();
    const { absolutePath, diskPath, name } = payload;
    await onAddModel(absolutePath, diskPath, name);
  });

  function setSelected(single, multi = []) {
    selectedIds.clear();
    if (single) selectedIds.add(single.id);
    (multi ?? []).forEach((en) => selectedIds.add(en.id));
    syncHighlight();
  }

  function refresh() {
    render();
  }

  render();

  function setContextMenu(ctxMenu) {
    _ctxMenu = ctxMenu;
  }

  function setDirty(dirty) {
    const dot = panel.querySelector("#hierarchy-dirty");
    if (dot) dot.style.display = dirty ? "inline" : "none";
  }

  return { setSelected, refresh, setContextMenu, setDirty };
}
