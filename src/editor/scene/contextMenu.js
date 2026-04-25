import * as THREE from "three";
import { createIcons, ChevronRight } from "lucide";
import { t } from "../../engine/i18n/i18n.js";
import { CreateCommand, DeleteCommand } from "../../engine/history/commands.js";

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
    },
  };
}

let activeMenu = null;

export function createContextMenu(
  container,
  sceneManager,
  history,
  selection,
  camera,
  flyControls,
) {
  let mouseDownX = 0;
  let mouseDownY = 0;
  let mouseDownTime = 0;

  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  container.addEventListener("mousedown", (e) => {
    if (e.button !== 2) return;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    mouseDownTime = performance.now();
  });

  container.addEventListener("mouseup", (e) => {
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
    const hits = raycaster.intersectObjects(meshes, false);

    let hitEntity = null;
    if (hits.length > 0) {
      hitEntity =
        sceneManager.getAll().find((en) => en.mesh === hits[0].object) ?? null;
      if (hitEntity && hitEntity.type !== "sun") {
        selection.selectEntity(hitEntity);
      }
    }

    showMenu(e.clientX, e.clientY, sceneManager, history, selection, hitEntity);
  });

  window.addEventListener("mousedown", (e) => {
    if (activeMenu && !activeMenu.contains(e.target)) closeMenu();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

function closeMenu() {
  if (!activeMenu) return;
  activeMenu.remove();
  activeMenu = null;
}

function showMenu(x, y, sceneManager, history, selection, hitEntity) {
  closeMenu();

  const menu = document.createElement("div");
  menu.className = "ctx-menu-wrapper";

  if (hitEntity && hitEntity.type !== "sun") {
    const ul = document.createElement("ul");
    ul.className = "ctx-menu";

    const li = document.createElement("li");
    li.className = "ctx-item ctx-item--danger";
    li.innerHTML = `<span class="ctx-label">${t("contextMenu.delete")}</span>`;
    li.addEventListener("click", () => {
      const cmd = DeleteCommand(sceneManager, hitEntity);
      cmd.execute();
      history.push(cmd);
      selection.deselect();
      closeMenu();
    });
    ul.appendChild(li);
    menu.appendChild(ul);

    const sep = document.createElement("div");
    sep.className = "ctx-separator";
    menu.appendChild(sep);
  }

  const addMenu = buildMenu(getMenuStructure(), sceneManager, history);
  menu.appendChild(addMenu);

  menu.style.left = x + "px";
  menu.style.top = y + "px";
  document.body.appendChild(menu);
  activeMenu = menu;

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = x - rect.width + "px";
  if (rect.bottom > window.innerHeight) menu.style.top = y - rect.height + "px";

  createIcons({
    icons: { ChevronRight },
    attrs: { width: 12, height: 12, stroke: "#6b7280" },
    root: menu,
  });
}

function buildMenu(structure, sceneManager, history) {
  const ul = document.createElement("ul");
  ul.className = "ctx-menu";

  for (const [label, value] of Object.entries(structure)) {
    const li = document.createElement("li");
    li.className = "ctx-item";

    if (typeof value === "object" && !Array.isArray(value)) {
      li.innerHTML = `<span class="ctx-label">${label}</span><i data-lucide="chevron-right"></i>`;
      li.classList.add("ctx-has-sub");

      const sub = buildMenu(value, sceneManager, history);
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
      li.innerHTML = `<span class="ctx-label">${label}</span>`;
      li.addEventListener("click", () => {
        const cmd = CreateCommand(sceneManager, value, { name: value });
        cmd.execute();
        history.push(cmd);
        closeMenu();
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
