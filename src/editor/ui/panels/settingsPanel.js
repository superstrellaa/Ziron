import {
  createIcons,
  Settings,
  X,
  SlidersHorizontal,
  Keyboard,
  ChevronDown,
  Check,
} from "lucide";
import { t } from "../../../engine/i18n/i18n.js";
import {
  get,
  set,
  setNoSave,
  saveConfig,
  getConfig,
} from "../../systems/persistence/config.js";
import { checkDirtyAndThen } from "../../systems/app/windowManager.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";
import { getActiveViewport } from "../../systems/app/projectManager.js";

let _activePanel = null;

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
        </div>

        <div id="settings-content">
          <div id="settings-section-general" class="settings-section"></div>
          <div id="settings-section-keybinds" class="settings-section" style="display:none;"></div>
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
    icons: { Settings, X, SlidersHorizontal, Keyboard, ChevronDown, Check },
    attrs: { width: 14, height: 14, stroke: "#cccccc" },
    root: overlay,
  });

  _renderGeneral(overlay.querySelector("#settings-section-general"));
  _renderKeybinds(overlay.querySelector("#settings-section-keybinds"));
  _setupNav(overlay);
  _setupActions(overlay);
}

function _setupNav(overlay) {
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
    });
  });
}

function _setupActions(overlay) {
  function close() {
    overlay.remove();
    _activePanel = null;
  }

  overlay.querySelector("#settings-close").addEventListener("click", close);
  overlay.querySelector("#settings-cancel").addEventListener("click", close);

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onEsc);
    }
  });

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
        const key = el.dataset.configKey;
        let value;

        if (el.classList.contains("settings-dropdown")) {
          value = Number.isNaN(Number(el.dataset.value))
            ? el.dataset.value
            : Number(el.dataset.value);
        } else if (el.type === "checkbox") {
          value = el.checked;
        } else {
          value = el.value;
        }

        setNoSave(key, value);
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
    });

  container._getPendingFolder = () => _pendingFolder;
}

function _initDropdowns(root) {
  root.querySelectorAll(".settings-dropdown").forEach((dropdown) => {
    const btn = dropdown.querySelector(".settings-dropdown-btn");
    const list = dropdown.querySelector(".settings-dropdown-list");
    const labelEl = dropdown.querySelector(".settings-dropdown-label");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
      root.querySelectorAll(".settings-dropdown").forEach((other) => {
        if (other !== dropdown) other.classList.remove("open");
      });
    });

    list.querySelectorAll(".settings-dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        const value = item.dataset.value;
        const label =
          item.childNodes[item.childNodes.length - 1].textContent.trim();

        dropdown.dataset.value = value;
        labelEl.textContent = label;
        dropdown.classList.remove("open");

        // Limpiar todos los checks y activos
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

    document.addEventListener("click", () => {
      dropdown.classList.remove("open");
    });
  });
}

function _renderKeybinds(container) {
  const keybinds = get("editor.keybinds") ?? {};

  const defaults = {
    SAVE: "Ctrl+S",
    UNDO: "Ctrl+Z",
    REDO: "Ctrl+Y",
    DUPLICATE: "Ctrl+D",
    DELETE: "Delete",
    COPY: "Ctrl+C",
    PASTE: "Ctrl+V",
    RENAME: "F2",
    SETTINGS: "Ctrl+,",
  };

  const rows = Object.entries(defaults)
    .map(([action, fallback]) => {
      const current = keybinds[action] ?? fallback;
      return `
      <div class="settings-row">
        <div class="settings-row-info">
          <span class="settings-row-label">${t(`keybind.${action.toLowerCase()}`) ?? action}</span>
        </div>
        <kbd class="settings-kbd" data-action="${action}">${current}</kbd>
      </div>
    `;
    })
    .join("");

  container.innerHTML = `
    <div class="settings-group">
      <div class="settings-group-title">${t("settings.groupKeybinds")}</div>
      ${rows}
    </div>
  `;
}
