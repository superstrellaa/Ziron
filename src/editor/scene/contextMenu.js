import * as THREE from "three";
import {
  createIcons,
  ChevronRight,
  Box,
  CircleDashed,
  Cylinder,
  Cone,
  Layers2,
  Video,
  RectangleVertical,
} from "lucide";
import { t } from "../../engine/i18n/i18n.js";
import {
  CreateCommand,
  DeleteCommand,
  DuplicateCommand,
} from "../../engine/history/commands.js";
import {
  registerOpenMenu,
  clearActiveMenu,
} from "../../engine/ui/contextMenuRegistry.js";

const TYPE_ICONS = {
  cube: "box",
  sphere: "circle-dashed",
  capsule: "rectangle-vertical",
  cylinder: "cylinder",
  cone: "cone",
  plane: "layers-2",
  camera: "video",
};

function getMenuStructure() {
  return {
    [t("contextMenu.add")]: {
      [t("contextMenu.objects3d")]: {
        [t("contextMenu.cube")]: "cube",
        [t("contextMenu.sphere")]: "sphere",
        [t("contextMenu.capsule")]: "capsule",
        [t("contextMenu.cylinder")]: "cylinder",
        [t("contextMenu.plane")]: "plane",
        [t("contextMenu.cone")]: "cone",
      },
      [t("contextMenu.camera")]: "camera",
    },
  };
}

let _clipboard = null;

export function getClipboard() {
  return _clipboard;
}
export function setClipboard(entity) {
  _clipboard = entity;
}

let activeMenu = null;

export function createContextMenu(
  container,
  sceneManager,
  runner,
  selection,
  camera,
  flyControls,
  projectData,
) {
  let mouseDownX = 0,
    mouseDownY = 0,
    mouseDownTime = 0;

  const onContextMenu = (e) => e.preventDefault();

  const onMouseDown = (e) => {
    if (e.button !== 2) return;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    mouseDownTime = performance.now();
  };

  const onMouseUp = (e) => {
    if (e.button !== 2) return;
    if (flyControls.didFly()) return;

    const elapsed = performance.now() - mouseDownTime;
    const dx = Math.abs(e.clientX - mouseDownX);
    const dy = Math.abs(e.clientY - mouseDownY);
    if (elapsed > 300 || dx > 5 || dy > 5) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const meshes = sceneManager.getAll().map((en) => en.mesh);
    const hits = raycaster.intersectObjects(meshes, true);

    let hitEntity = null;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !hitEntity) {
        hitEntity = sceneManager.getAll().find((en) => en.mesh === obj) ?? null;
        obj = obj.parent;
      }
      if (hitEntity && hitEntity.type !== "sun")
        selection.selectEntity(hitEntity);
    }

    showMenu(
      e.clientX,
      e.clientY,
      sceneManager,
      runner,
      selection,
      hitEntity,
      projectData,
    );
  };

  const onWindowMouseDown = (e) => {
    if (activeMenu && !activeMenu.contains(e.target)) closeMenu();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") closeMenu();
  };

  window.addEventListener("contextmenu", onContextMenu);
  container.addEventListener("mousedown", onMouseDown);
  container.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousedown", onWindowMouseDown);
  window.addEventListener("keydown", onKeyDown);

  return {
    showAt(x, y, hitEntity = null) {
      showMenu(x, y, sceneManager, runner, selection, hitEntity, projectData);
    },

    destroy() {
      window.removeEventListener("contextmenu", onContextMenu);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousedown", onWindowMouseDown);
      window.removeEventListener("keydown", onKeyDown);
      closeMenu();
      _clipboard = null;
    },
  };
}

function closeMenu() {
  if (!activeMenu) return;
  activeMenu.remove();
  activeMenu = null;
  clearActiveMenu(closeMenu);
}

function showMenu(
  x,
  y,
  sceneManager,
  runner,
  selection,
  hitEntity,
  projectData,
) {
  closeMenu();
  registerOpenMenu(closeMenu);

  const reselect = (entity) => {
    selection.deselect();
    selection.selectEntity(entity);
  };

  const menu = document.createElement("div");
  menu.className = "ctx-menu-wrapper";

  if (hitEntity && hitEntity.type !== "sun") {
    const ul = document.createElement("ul");
    ul.className = "ctx-menu";

    ul.appendChild(
      makeItem(t("contextMenu.copy"), () => {
        _clipboard = hitEntity;
        closeMenu();
      }),
    );

    ul.appendChild(
      makeItem(t("contextMenu.duplicate"), () => {
        closeMenu();
        runner.run("Duplicate", () =>
          DuplicateCommand(sceneManager, hitEntity, reselect, projectData),
        );
      }),
    );

    ul.appendChild(
      makeItem(t("contextMenu.rename"), () => {
        closeMenu();
        window.dispatchEvent(
          new CustomEvent("ziron:rename", { detail: { id: hitEntity.id } }),
        );
      }),
    );

    ul.appendChild(makeSeparator());

    ul.appendChild(
      makeItem(
        t("contextMenu.delete"),
        async () => {
          closeMenu();
          const cmd = await runner.run("Delete", () =>
            DeleteCommand(sceneManager, hitEntity, projectData),
          );
          if (cmd) selection.deselect();
        },
        true,
      ),
    );

    menu.appendChild(ul);
    menu.appendChild(makeSeparator());
  }

  if (_clipboard) {
    const ulPaste = document.createElement("ul");
    ulPaste.className = "ctx-menu";
    ulPaste.appendChild(
      makeItem(t("contextMenu.paste"), () => {
        const source = _clipboard;
        closeMenu();
        runner.run("Paste", () =>
          DuplicateCommand(sceneManager, source, reselect, projectData),
        );
      }),
    );
    menu.appendChild(ulPaste);
    menu.appendChild(makeSeparator());
  }

  menu.appendChild(buildMenu(getMenuStructure(), sceneManager, runner));

  menu.style.left = x + "px";
  menu.style.top = y + "px";
  document.body.appendChild(menu);
  activeMenu = menu;

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = x - rect.width + "px";
  if (rect.bottom > window.innerHeight) menu.style.top = y - rect.height + "px";

  createIcons({
    icons: {
      ChevronRight,
      Box,
      CircleDashed,
      Cylinder,
      Cone,
      Layers2,
      Video,
      RectangleVertical,
    },
    attrs: { width: 12, height: 12, stroke: "#9ca3af" },
    root: menu,
  });
}

function makeItem(label, onClick, danger = false) {
  const li = document.createElement("li");
  li.className = "ctx-item" + (danger ? " ctx-item--danger" : "");
  li.innerHTML = `<span class="ctx-label">${label}</span>`;
  li.addEventListener("click", onClick);
  return li;
}

function makeSeparator() {
  const sep = document.createElement("div");
  sep.className = "ctx-separator";
  return sep;
}

function buildMenu(structure, sceneManager, runner) {
  const ul = document.createElement("ul");
  ul.className = "ctx-menu";

  for (const [label, value] of Object.entries(structure)) {
    const li = document.createElement("li");
    li.className = "ctx-item";

    if (typeof value === "object" && !Array.isArray(value)) {
      li.innerHTML = `<span class="ctx-label">${label}</span><i data-lucide="chevron-right"></i>`;
      li.classList.add("ctx-has-sub");

      const sub = buildMenu(value, sceneManager, runner);
      sub.classList.add("ctx-submenu");
      li.appendChild(sub);

      let closeTimer = null;

      li.addEventListener("mouseenter", () => {
        clearTimeout(closeTimer);
        sub.style.display = "block";
        adjustSubmenuPosition(li, sub);
      });

      li.addEventListener("mouseleave", (e) => {
        if (sub.contains(e.relatedTarget)) return;
        closeTimer = setTimeout(() => {
          sub.style.display = "none";
        }, 120);
      });

      sub.addEventListener("mouseenter", () => {
        clearTimeout(closeTimer);
      });

      sub.addEventListener("mouseleave", () => {
        closeTimer = setTimeout(() => {
          sub.style.display = "none";
        }, 120);
      });
    } else {
      const icon = TYPE_ICONS[value];
      li.innerHTML = `${icon ? `<i data-lucide="${icon}" class="ctx-item-icon"></i>` : ""}<span class="ctx-label">${label}</span>`;
      li.addEventListener("click", () => {
        closeMenu();
        runner.run("Create", () =>
          CreateCommand(sceneManager, value, { name: value }),
        );
      });
    }

    ul.appendChild(li);
  }

  return ul;
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
