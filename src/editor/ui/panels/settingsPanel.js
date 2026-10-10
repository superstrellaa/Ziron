import {
  createIcons,
  Settings,
  X,
  SlidersHorizontal,
  Keyboard,
  RotateCwClock,
  ChevronDown,
  Check,
} from "lucide";
import { createUpdaterTab } from "./settingsUpdaterTab.js";
import { t } from "../../../engine/i18n/i18n.js";
import {
  get,
  set,
  setNoSave,
  saveConfig,
  getConfig,
} from "../../systems/persistence/config.js";
import { KEYBINDS } from "../../systems/input/keybinds.js";
import { checkDirtyAndThen } from "../../systems/app/windowManager.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";
import { getActiveViewport } from "../../systems/app/project/projectManager.js";

let _activePanel = null;

const DROPDOWN_GAP = 4;
const DROPDOWN_MARGIN = 8;

const KEYBIND_GROUPS = [
  {
    titleKey: "settings.keybindGroups.general",
    actions: [
      ["SAVE", "keybind.save"],
      ["OPEN_SETTINGS", "keybind.settings"],
    ],
  },
  {
    titleKey: "settings.keybindGroups.history",
    actions: [
      ["UNDO", "keybind.undo"],
      ["REDO", "keybind.redo"],
    ],
  },
  {
    titleKey: "settings.keybindGroups.entities",
    actions: [
      ["DUPLICATE", "keybind.duplicate"],
      ["DELETE", "keybind.delete"],
      ["COPY", "keybind.copy"],
      ["PASTE", "keybind.paste"],
      ["RENAME", "keybind.rename"],
    ],
  },
  {
    titleKey: "settings.keybindGroups.tools",
    actions: [
      ["TOOL_TRANSLATE", "keybind.translate"],
      ["TOOL_ROTATE", "keybind.rotate"],
      ["TOOL_SCALE", "keybind.scale"],
    ],
  },
  {
    titleKey: "settings.keybindGroups.selection",
    actions: [["SELECT_ADD", "keybind.selectAdd"]],
  },
];

export function isSettingsOpen() {
  return _activePanel !== null;
}

export function openSettings() {
  if (_activePanel) return;

  const overlay = document.createElement("div");
  overlay.id = "settings-overlay";

  overlay.innerHTML = `
    <div id="settings-window">

      <div id="settings-header">
        <div id="settings-header-left">
          <i data-lucide="settings"></i>
          <span>${t("settings.title")}</span>
        </div>
        <button id="settings-close" aria-label="Close">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div id="settings-body">

        <div id="settings-sidebar">
          <div class="settings-category-label">${t("settings.categoryEditor")}</div>
          <button class="settings-nav-item active" data-section="general">
            <i data-lucide="sliders-horizontal"></i>
            ${t("settings.general")}
          </button>
          <button class="settings-nav-item" data-section="keybinds">
            <i data-lucide="keyboard"></i>
            ${t("settings.keybinds")}
          </button>
          <button class="settings-nav-item" data-section="updater">
            <i data-lucide="rotate-cw-clock"></i>
            ${t("settings.updater")}
          </button>
        </div>

        <div id="settings-content">
          <div id="settings-section-general" class="settings-section"></div>
          <div id="settings-section-keybinds" class="settings-section" style="display:none;"></div>
          <div id="settings-section-updater" class="settings-section" style="display:none;"></div>
        </div>

      </div>

      <div id="settings-footer">
        <button id="settings-cancel">${t("settings.cancel")}</button>
        <button id="settings-save">${t("settings.save")}</button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);
  _activePanel = overlay;

  createIcons({
    icons: {
      Settings,
      X,
      SlidersHorizontal,
      Keyboard,
      RotateCwClock,
      ChevronDown,
      Check,
    },
    attrs: { width: 14, height: 14, stroke: "#cccccc" },
    root: overlay,
  });

  _renderGeneral(overlay.querySelector("#settings-section-general"));
  _renderKeybinds(overlay.querySelector("#settings-section-keybinds"));
  const updaterTab = createUpdaterTab(
    overlay.querySelector("#settings-section-updater"),
    overlay.querySelector('.settings-nav-item[data-section="updater"]'),
  );
  _setupNav(overlay, updaterTab);
  const dirty = _setupDirtyTracking(overlay);
  _setupActions(overlay, dirty, updaterTab);
}

function _setupNav(overlay, updaterTab) {
  const navItems = overlay.querySelectorAll(".settings-nav-item");
  const sections = overlay.querySelectorAll(".settings-section");

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      navItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.section;
      sections.forEach((s) => {
        s.style.display =
          s.id === `settings-section-${target}` ? "flex" : "none";
      });

      if (target === "updater") updaterTab.onShow();
    });
  });
}

function _setupActions(overlay, dirty, updaterTab) {
  const win = overlay.querySelector("#settings-window");

  function closeOpenDropdowns() {
    const open = overlay.querySelectorAll(".settings-dropdown.open");
    open.forEach((d) => d.classList.remove("open"));
    return open.length > 0;
  }

  function close() {
    document.removeEventListener("keydown", onEsc);
    updaterTab.destroy();
    overlay.remove();
    _activePanel = null;
  }

  function shake() {
    closeOpenDropdowns();
    win.classList.remove("shake");
    void win.offsetWidth; // reinicia la animación si ya estaba temblando
    win.classList.add("shake");
  }

  function requestClose() {
    if (dirty.isDirty()) {
      shake();
      return;
    }
    close();
  }

  function onEsc(e) {
    if (e.key !== "Escape") return;
    if (closeOpenDropdowns()) return; // el primer Escape solo cierra el dropdown
    requestClose();
  }

  win.addEventListener("animationend", (e) => {
    if (e.target === win) win.classList.remove("shake");
  });

  overlay
    .querySelector("#settings-close")
    .addEventListener("click", requestClose);
  overlay.querySelector("#settings-cancel").addEventListener("click", close);

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) requestClose();
  });

  document.addEventListener("keydown", onEsc);

  overlay
    .querySelector("#settings-save")
    .addEventListener("click", async () => {
      // ── ANTES del guardado — capturar estado previo ───────────────────────────
      const previousLocale = get("editor.locale");
      const prevAutoSave = get("editor.auto_save");
      const prevInterval = get("editor.auto_save_interval");

      // ── Recoger todos los valores de los controles ────────────────────────────
      const elements = overlay.querySelectorAll("[data-config-key]");
      for (const el of elements) {
        setNoSave(el.dataset.configKey, _readValue(el));
      }

      // Folder pendiente
      const generalSection = overlay.querySelector("#settings-section-general");
      const pendingFolder = generalSection?._getPendingFolder?.();
      if (pendingFolder != null)
        setNoSave("editor.projects_folder", pendingFolder);

      // ── GUARDAR ───────────────────────────────────────────────────────────────
      await saveConfig();
      Toast.settingsSaved();

      // ── DESPUÉS del guardado — reaccionar a cambios ───────────────────────────

      // Autosave: reiniciar si cambió el toggle o el intervalo
      const newAutoSave = getConfig()?.editor?.auto_save;
      const newInterval = getConfig()?.editor?.auto_save_interval;
      if (newAutoSave !== prevAutoSave || newInterval !== prevInterval) {
        getActiveViewport()?.restartAutoSave?.();
      }

      // Locale: pedir reinicio si cambió
      const newLocale = getConfig()?.editor?.locale;
      const localeChanged = newLocale && newLocale !== previousLocale;

      close();

      if (localeChanged) {
        const result = await Popup.restartRequired();
        if (result === "restart") {
          await checkDirtyAndThen(async () => {
            await invoke("save_window_state").catch(() => {});
            await relaunch();
          });
        }
      }
    });
}

function _renderGeneral(container) {
  const currentLocale = get("editor.locale") ?? "en";
  const localeOptions = [
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
  ];

  // guardar el estado pendiente de la folder de proyectos
  let _pendingFolder = null;

  container.innerHTML = `
    <div class="settings-group">
      <div class="settings-group-title">${t("settings.groupInterface")}</div>

      <div class="settings-row">
        <div class="settings-row-info">
          <span class="settings-row-label">${t("settings.language")}</span>
          <span class="settings-row-desc">${t("settings.languageDesc")}</span>
        </div>
        <div class="settings-dropdown" data-config-key="editor.locale" data-value="${currentLocale}">
          <button class="settings-dropdown-btn" type="button">
            <span class="settings-dropdown-label">
              ${localeOptions.find((o) => o.value === currentLocale)?.label ?? "English"}
            </span>
            <i data-lucide="chevron-down"></i>
          </button>
          <div class="settings-dropdown-list">
            ${localeOptions
              .map(
                (o) => `
              <div class="settings-dropdown-item ${o.value === currentLocale ? "active" : ""}" data-value="${o.value}">
                <span class="settings-dropdown-item-check">${o.value === currentLocale ? "✓" : ""}</span>
                ${o.label}
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-row-info">
          <span class="settings-row-label">${t("settings.discordRpc")}</span>
          <span class="settings-row-desc">${t("settings.discordRpcDesc")}</span>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" data-config-key="editor.discord_rpc"
            ${get("editor.discord_rpc") !== false ? "checked" : ""} />
          <span class="settings-toggle-track"></span>
        </label>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">${t("settings.groupProjects")}</div>

      <div class="settings-row">
        <div class="settings-row-info">
          <span class="settings-row-label">${t("settings.defaultFolder")}</span>
          <span class="settings-row-desc" id="settings-folder-preview">
            ${get("editor.projects_folder") || t("settings.defaultFolderNone")}
          </span>
        </div>
        <button class="settings-browse-btn" id="settings-browse-folder">
          ${t("settings.browse")}
        </button>
      </div>

      <div class="settings-row">
        <div class="settings-row-info">
          <span class="settings-row-label">${t("settings.autosave")}</span>
          <span class="settings-row-desc">${t("settings.autosaveDesc")}</span>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" data-config-key="editor.auto_save"
            ${get("editor.auto_save") ? "checked" : ""} />
          <span class="settings-toggle-track"></span>
        </label>
      </div>

      <div class="settings-row" id="settings-autosave-interval-row"
        style="${get("editor.auto_save") ? "" : "opacity:0.4; pointer-events:none;"}">
  <div class="settings-row-info">
    <span class="settings-row-label">${t("settings.autosaveInterval")}</span>
    <span class="settings-row-desc">${t("settings.autosaveIntervalDesc")}</span>
  </div>
  <div class="settings-dropdown" data-config-key="editor.auto_save_interval"
    data-value="${get("editor.auto_save_interval") ?? 5}">
    <button class="settings-dropdown-btn" type="button">
      <span class="settings-dropdown-label">
        ${get("editor.auto_save_interval") ?? 5} min
      </span>
      <i data-lucide="chevron-down"></i>
    </button>
    <div class="settings-dropdown-list">
      ${[1, 2, 5, 10, 15, 30]
        .map(
          (n) => `
        <div class="settings-dropdown-item ${(get("editor.auto_save_interval") ?? 5) === n ? "active" : ""}"
          data-value="${n}">
          <span class="settings-dropdown-item-check">${(get("editor.auto_save_interval") ?? 5) === n ? "✓" : ""}</span>
          ${n} min
        </div>
      `,
        )
        .join("")}
    </div>
  </div>
</div>
    </div>
  `;

  createIcons({
    icons: { ChevronDown },
    attrs: { width: 12, height: 12, stroke: "#9ca3af" },
    root: container,
  });
  _initDropdowns(container);

  const autoSaveToggle = container.querySelector(
    "[data-config-key='editor.auto_save']",
  );
  const intervalRow = container.querySelector(
    "#settings-autosave-interval-row",
  );

  autoSaveToggle?.addEventListener("change", () => {
    const enabled = autoSaveToggle.checked;
    intervalRow.style.opacity = enabled ? "" : "0.4";
    intervalRow.style.pointerEvents = enabled ? "" : "none";
  });

  container
    .querySelector("#settings-browse-folder")
    ?.addEventListener("click", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const folder = await invoke("pick_folder").catch(() => null);
      if (!folder) return;
      _pendingFolder = folder;
      container.querySelector("#settings-folder-preview").textContent = folder;
      container.dispatchEvent(
        new CustomEvent("settings:change", { bubbles: true }),
      );
    });

  container._getPendingFolder = () => _pendingFolder;
}

function _initDropdowns(root) {
  const overlay = root.closest("#settings-overlay");
  const scroller = root.closest("#settings-content");
  const dropdowns = root.querySelectorAll(".settings-dropdown");

  function closeAll() {
    dropdowns.forEach((d) => d.classList.remove("open"));
  }

  function positionList(dropdown) {
    const btn = dropdown.querySelector(".settings-dropdown-btn");
    const list = dropdown.querySelector(".settings-dropdown-list");
    const rect = btn.getBoundingClientRect();

    list.style.minWidth = `${rect.width}px`;
    list.style.maxHeight = "";
    const naturalHeight = list.offsetHeight;

    const spaceBelow =
      window.innerHeight - rect.bottom - DROPDOWN_GAP - DROPDOWN_MARGIN;
    const spaceAbove = rect.top - DROPDOWN_GAP - DROPDOWN_MARGIN;
    const openUp = naturalHeight > spaceBelow && spaceAbove > spaceBelow;

    const maxH = Math.max(80, openUp ? spaceAbove : spaceBelow);
    list.style.maxHeight = `${maxH}px`;

    const height = Math.min(naturalHeight, maxH);
    const width = list.offsetWidth;

    list.style.top = `${openUp ? rect.top - DROPDOWN_GAP - height : rect.bottom + DROPDOWN_GAP}px`;
    list.style.left = `${Math.max(DROPDOWN_MARGIN, rect.right - width)}px`;
  }

  dropdowns.forEach((dropdown) => {
    const btn = dropdown.querySelector(".settings-dropdown-btn");
    const list = dropdown.querySelector(".settings-dropdown-list");
    const labelEl = dropdown.querySelector(".settings-dropdown-label");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains("open");
      closeAll();
      if (willOpen) {
        dropdown.classList.add("open");
        positionList(dropdown);
      }
    });

    list.querySelectorAll(".settings-dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        const value = item.dataset.value;
        const label =
          item.childNodes[item.childNodes.length - 1].textContent.trim();

        dropdown.dataset.value = value;
        dropdown.dispatchEvent(
          new CustomEvent("settings:change", { bubbles: true }),
        );
        labelEl.textContent = label;
        dropdown.classList.remove("open");

        list.querySelectorAll(".settings-dropdown-item").forEach((i) => {
          i.classList.remove("active");
          const check = i.querySelector(".settings-dropdown-item-check");
          if (check) check.textContent = "";
        });

        item.classList.add("active");
        const check = item.querySelector(".settings-dropdown-item-check");
        if (check) check.textContent = "✓";
      });
    });
  });

  // La lista es fixed, así que no sigue al scroll: se cierra si el contenido se mueve
  overlay?.addEventListener("click", closeAll);
  scroller?.addEventListener("scroll", closeAll, { passive: true });
  window.addEventListener("resize", closeAll);
}

function _esc(s) {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function _formatKey(key) {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function _bindToParts(bind) {
  const parts = [];
  if (bind.ctrl) parts.push("Ctrl");
  if (bind.alt) parts.push("Alt");
  if (bind.shift) parts.push("Shift");
  const main = _formatKey(bind.key);
  if (!parts.includes(main)) parts.push(main);
  return parts;
}

function _renderKeybinds(container) {
  container.innerHTML = KEYBIND_GROUPS.map(({ titleKey, actions }) => {
    const cards = actions
      .filter(([action]) => KEYBINDS[action])
      .map(([action, labelKey]) => {
        const keys = _bindToParts(KEYBINDS[action])
          .map((k) => `<kbd class="kb-key">${_esc(k)}</kbd>`)
          .join('<span class="kb-plus">+</span>');
        return `
          <div class="kb-card" data-action="${action}">
            <span class="kb-label">${t(labelKey)}</span>
            <span class="kb-keys">${keys}</span>
          </div>`;
      })
      .join("");

    return `
      <div class="settings-group">
        <div class="settings-group-title">${t(titleKey)}</div>
        <div class="kb-grid">${cards}</div>
      </div>`;
  }).join("");
}

// Nuevo para hacer sistema de dirty
function _readValue(el) {
  if (el.classList.contains("settings-dropdown")) {
    return Number.isNaN(Number(el.dataset.value))
      ? el.dataset.value
      : Number(el.dataset.value);
  }
  if (el.type === "checkbox") return el.checked;
  return el.value;
}

function _setupDirtyTracking(overlay) {
  const entries = [];

  function addEntry(row, changed) {
    const label = row?.querySelector(".settings-row-label");
    if (!label) return;
    const mark = document.createElement("span");
    mark.className = "settings-dirty-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "*";
    label.appendChild(mark);
    entries.push({ mark, changed });
  }

  // Línea base = valor del control justo tras renderizar (misma lectura que al guardar)
  overlay.querySelectorAll("[data-config-key]").forEach((el) => {
    const base = _readValue(el);
    addEntry(el.closest(".settings-row"), () => _readValue(el) !== base);
  });

  // La carpeta de proyectos no es un control con data-config-key
  const generalSection = overlay.querySelector("#settings-section-general");
  const folderRow = overlay
    .querySelector("#settings-browse-folder")
    ?.closest(".settings-row");
  const folderBase = get("editor.projects_folder") || "";
  addEntry(folderRow, () => {
    const pending = generalSection?._getPendingFolder?.();
    return pending != null && pending !== folderBase;
  });

  function refresh() {
    for (const { mark, changed } of entries) {
      mark.classList.toggle("is-visible", changed());
    }
  }

  ["input", "change", "settings:change"].forEach((evt) =>
    overlay.addEventListener(evt, refresh),
  );

  return { isDirty: () => entries.some((e) => e.changed()) };
}
