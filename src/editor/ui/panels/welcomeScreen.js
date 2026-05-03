import { invoke } from "@tauri-apps/api/core";
import {
  createIcons,
  Plus,
  FolderKanban,
  FolderOpen,
  X,
  Box,
  PackageOpen,
} from "lucide";
import { t } from "../../../engine/i18n/i18n.js";
import { get, set } from "../../systems/persistence/config.js";
import { logger } from "../../../engine/core/logger.js";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";
import { ENGINE_VERSION } from "../../systems/app/versionManager.js";

export async function createWelcomeScreen(
  container,
  onProjectReady,
  autoOpenNew = false,
) {
  const el = document.createElement("div");
  el.id = "welcome";

  el.innerHTML = `
    <div id="welcome-body">
      <div id="welcome-sidebar">
        <div id="welcome-logo">
          <i data-lucide="box"></i>
          <span>${t("general.title")}</span>
        </div>
        <button class="welcome-action-btn primary" id="btn-new-project">
          <i data-lucide="plus"></i>
          ${t("welcome.newProject")}
        </button>
        <button class="welcome-action-btn" id="btn-open-project">
          <i data-lucide="folder-open"></i>
          ${t("welcome.openProject")}
        </button>
        <div id="welcome-sidebar-bottom" data-tooltip="v${ENGINE_VERSION}">
          ${t("welcome.version")}
        </div>
      </div>

      <div id="welcome-main">
        <h2 id="welcome-main-title">${t("welcome.recentProjects")}</h2>
        <div id="welcome-content"></div>
      </div>
    </div>
  `;

  container.appendChild(el);

  createIcons({
    icons: { Plus, FolderKanban, FolderOpen, X, Box, PackageOpen },
    attrs: { width: 14, height: 14, stroke: "#cccccc" },
    root: el,
  });

  const content = el.querySelector("#welcome-content");
  const title = el.querySelector("#welcome-main-title");

  // ── Estado del panel de nuevo proyecto ──────────────────────────────────────
  let newProjectOpen = false;

  function showRecents() {
    newProjectOpen = false;
    title.textContent = t("welcome.recentProjects");
    el.querySelector("#btn-new-project").classList.add("primary");
    renderRecents(content, el, onProjectReady);
  }

  function showNewProject() {
    newProjectOpen = true;
    title.textContent = t("welcome.newProject");
    el.querySelector("#btn-new-project").classList.remove("primary");
    renderNewProjectPanel(content, el, onProjectReady, showRecents);
  }

  el.querySelector("#btn-new-project").addEventListener("click", () => {
    if (newProjectOpen) showRecents();
    else showNewProject();
  });

  el.querySelector("#btn-open-project").addEventListener("click", async () => {
    const projectFile = await invoke("pick_project_file").catch(() => null);
    if (!projectFile) return;
    try {
      const projectData = await invoke("load_project", { projectFile });
      logger.info("Welcome", `Opened project "${projectData.name}"`);
      el.remove();
      onProjectReady(projectData);
    } catch (e) {
      logger.warn("Welcome", `Failed to open project: ${e}`);
    }
  });

  // Mostrar recientes por defecto a menos que le haya dao al boton de nuevo proyecto desde el toolbar
  if (autoOpenNew) showNewProject();
  else showRecents();
}

// ── Panel de nuevo proyecto ────────────────────────────────────────────────────

function renderNewProjectPanel(content, el, onProjectReady, onCancel) {
  const savedFolder = get("editor.projects_folder") ?? "";

  content.innerHTML = `
    <div id="new-project-panel">
      <div class="np-header">
        <h3>${t("welcome.newProjectPanel.title")}</h3>
        <button class="np-close-btn" id="np-close" title="Close">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="np-field">
        <span class="np-label">${t("welcome.newProjectPanel.nameLabel")}</span>
        <input class="np-input" id="np-name" type="text"
          placeholder="${t("welcome.newProjectPanel.namePlaceholder")}"
          spellcheck="false" autocomplete="off" />
      </div>

      <div class="np-field">
        <span class="np-label">${t("welcome.newProjectPanel.folderLabel")}</span>
        <div class="np-folder-row">
          <input class="np-input" id="np-folder" type="text" readonly
            placeholder="${t("welcome.newProjectPanel.folderPlaceholder")}"
            value="${savedFolder}" />
          <button class="np-browse-btn" id="np-browse">
            ${t("welcome.newProjectPanel.browseBtn")}
          </button>
        </div>
      </div>

      <div class="np-preview" id="np-preview">
        ${t("welcome.newProjectPanel.preview")} <span id="np-preview-path">—</span>
      </div>

      <button class="np-create-btn" id="np-create" disabled>
        ${t("welcome.newProjectPanel.createBtn")}
      </button>
    </div>
  `;

  createIcons({
    icons: { X },
    attrs: { width: 12, height: 12, stroke: "#6b7280" },
    root: content,
  });

  const nameInput = content.querySelector("#np-name");
  const folderInput = content.querySelector("#np-folder");
  const previewPath = content.querySelector("#np-preview-path");
  const createBtn = content.querySelector("#np-create");

  function close() {
    document.removeEventListener("keydown", onEsc);
    onCancel();
  }

  function onEsc(e) {
    if (e.key === "Escape") close();
  }

  content.querySelector("#np-close").addEventListener("click", close);
  document.addEventListener("keydown", onEsc);

  function updatePreview() {
    const name = nameInput.value.trim();
    const folder = folderInput.value.trim();
    if (name && folder) {
      previewPath.textContent = `${folder}/${name}`;
      createBtn.disabled = false;
    } else {
      previewPath.textContent = "—";
      createBtn.disabled = true;
    }
  }

  nameInput.addEventListener("input", updatePreview);
  updatePreview();

  content.querySelector("#np-browse").addEventListener("click", async () => {
    const folder = await invoke("pick_folder").catch(() => null);
    if (!folder) return;
    folderInput.value = folder;
    await set("editor.projects_folder", folder);
    updatePreview();
  });

  createBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const folder = folderInput.value.trim();
    if (!name || !folder) return;

    createBtn.disabled = true;
    createBtn.textContent = "Creating...";

    try {
      const projectFolder = `${folder}/${name}`;
      const projectFile = await invoke("create_project", {
        folderPath: projectFolder,
        name,
      });
      const projectData = await invoke("load_project", { projectFile });
      logger.info("Welcome", `Created project "${name}"`);
      document.removeEventListener("keydown", onEsc);
      Toast.createProjectSuccess();
      el.remove();
      onProjectReady(projectData);
    } catch (e) {
      logger.warn("Welcome", `Failed to create project: ${e}`);
      Toast.createProjectError();
      createBtn.disabled = false;
      createBtn.textContent = t("welcome.newProjectPanel.createBtn");
    }
  });

  setTimeout(() => nameInput.focus(), 50);
}

// ── Recientes ──────────────────────────────────────────────────────────────────

async function renderRecents(content, el, onProjectReady) {
  content.innerHTML = `<div id="welcome-projects-grid"></div>`;
  const grid = content.querySelector("#welcome-projects-grid");

  let recents = [];
  try {
    recents = await invoke("get_recent_projects");
  } catch (e) {
    logger.warn("Welcome", `Could not load recents: ${e}`);
    Toast.loadRecentsError();
  }

  if (recents.length === 0) {
    grid.innerHTML = `
      <div id="welcome-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
          fill="none" stroke="#4b5563" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>${t("welcome.noRecents")}</span>
      </div>
    `;
    return;
  }

  for (const project of recents) {
    const card = makeProjectCard(project, el, grid, onProjectReady);
    grid.appendChild(card);
  }

  createIcons({
    icons: { FolderKanban, X },
    attrs: { width: 14, height: 14, stroke: "#cccccc" },
    root: grid,
  });
}

function makeProjectCard(project, el, grid, onProjectReady) {
  const card = document.createElement("div");
  card.className = "project-card";

  const date = formatDate(project.last_opened);
  const shortPath =
    project.path.length > 50 ? "..." + project.path.slice(-47) : project.path;

  card.innerHTML = `
    <div class="project-card-header">
      <span class="project-card-icon"><i data-lucide="folder-kanban"></i></span>
      <span class="project-card-name">${project.name}</span>
    </div>
    <div class="project-card-path" data-tooltip="${project.path}">${shortPath}</div>
    <div class="project-card-date">Last opened: ${date}</div>
    <button class="project-card-remove" data-tooltip="Remove from list"><i data-lucide="x"></i></button>
  `;

  card.addEventListener("click", async (e) => {
    if (e.target.closest(".project-card-remove")) return;
    try {
      const projectData = await invoke("load_project", {
        projectFile: project.path,
      });
      logger.info("Welcome", `Opened project "${project.name}"`);
      el.remove();
      onProjectReady(projectData);
    } catch {
      card.style.opacity = "0.4";
      Toast.projectNotFound();
      card.querySelector(".project-card-path").textContent =
        "⚠ Project not found";
    }
  });

  card
    .querySelector(".project-card-remove")
    .addEventListener("click", async (e) => {
      e.stopPropagation();
      await invoke("remove_recent_project", {
        projectPath: project.path,
      }).catch(() => {});
      card.style.transition = "opacity 0.2s, transform 0.2s";
      card.style.opacity = "0";
      card.style.transform = "scale(0.95)";
      Toast.projectRemovedRecents();
      setTimeout(() => card.remove(), 200);
    });

  return card;
}

function formatDate(isoString) {
  if (!isoString) return "Unknown";
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Unknown";
  }
}
