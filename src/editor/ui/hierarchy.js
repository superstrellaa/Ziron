import { createIcons, Box } from "lucide";
import { t } from "../../engine/i18n/i18n";
import { onKeybind } from "../systems/keybinds.js";

export function createHierarchy(container, sceneManager, selection) {
  const panel = document.createElement("div");
  panel.id = "hierarchy";

  panel.innerHTML = `
    <div id="hierarchy-header">${t("hierarchy.header")}</div>
    <div id="hierarchy-list"></div>
  `;
  container.appendChild(panel);

  const list = panel.querySelector("#hierarchy-list");

  let selectedIds = new Set();
  let lastClickedId = null;
  let editingId = null;

  let _ctxMenu = null;

  const rowMap = new Map();

  function render() {
    const entities = sceneManager.getAll().filter((e) => e.type !== "sun");

    for (const [id, row] of rowMap) {
      if (!entities.find((e) => e.id === id)) {
        row.remove();
        rowMap.delete(id);
      }
    }

    let dirty = false;

    entities.forEach((entity) => {
      let row = rowMap.get(entity.id);

      if (!row) {
        row = document.createElement("div");
        row.className = "h-row";
        row.dataset.id = entity.id;
        list.appendChild(row);
        rowMap.set(entity.id, row);
        dirty = true;
      }

      const desired = `<span class="h-icon"><i data-lucide="box"></i></span><span class="h-name">${entity.name}</span>`;
      if (row.innerHTML !== desired) {
        row.innerHTML = desired;
        dirty = true;
      }

      row.classList.toggle("h-selected", selectedIds.has(entity.id));
    });

    if (dirty) {
      createIcons({
        icons: { Box },
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

  function startRename(id) {
    if (editingId !== null) commitRename();

    const row = rowMap.get(id);
    if (!row) return;
    const entity = sceneManager.getById(id);
    if (!entity) return;

    editingId = id;

    row.innerHTML = `<input class="h-rename-input" type="text" value="${entity.name}" spellcheck="false" />`;
    const input = row.querySelector("input");

    input.focus();
    input.select();

    function commitRename() {
      if (editingId !== id) return;
      const newName = input.value.trim();
      if (newName && newName !== entity.name) {
        sceneManager.rename(id, newName);
      }
      editingId = null;
      row.innerHTML = "";
      render();
    }

    function cancelRename() {
      if (editingId !== id) return;
      editingId = null;
      row.innerHTML = "";
      render();
    }

    onKeybind("RENAME", (e) => {
      if (selectedIds.size !== 1) return;
      if (editingId !== null) return;
      e.preventDefault();
      startRename([...selectedIds][0]);
    });

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

    const entities = sceneManager.getAll().filter((en) => en.type !== "sun");

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

  sceneManager.on("onAdd", () => render());
  sceneManager.on("onRemove", () => render());

  return { setSelected, refresh, setContextMenu };
}
