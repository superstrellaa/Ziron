import {
  createIcons,
  RefreshCw,
  History,
  Download,
  RotateCw,
  Sparkles,
  CircleCheck,
  TriangleAlert,
  LoaderCircle,
} from "lucide";
import { t } from "../../../engine/i18n/i18n.js";
import { checkDirtyAndThen } from "../../systems/app/windowManager.js";
import {
  subscribe,
  getState,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  ensureVersion,
} from "../../systems/app/updater/updaterService.js";
import {
  fetchReleaseByVersion,
  fetchReleaseHistory,
  renderMarkdown,
  escapeHtml,
} from "../../systems/app/updater/releaseNotes.js";
import { logger } from "../../../engine/core/logger.js";

const ICONS = {
  RefreshCw,
  History,
  Download,
  RotateCw,
  Sparkles,
  CircleCheck,
  TriangleAlert,
  LoaderCircle,
};

const UPDATE_PHASES = ["available", "downloading", "downloaded", "installing"];
const BUSY_PHASES = ["checking", ...UPDATE_PHASES.slice(1)];

const STATUS = {
  checking: {
    icon: "loader-circle",
    key: "updater.status.checking",
    spin: true,
  },
  "up-to-date": { icon: "circle-check", key: "updater.status.upToDate" },
  available: { icon: "sparkles", key: "updater.status.available" },
  downloading: { icon: "sparkles", key: "updater.status.available" },
  downloaded: { icon: "sparkles", key: "updater.status.available" },
  installing: { icon: "sparkles", key: "updater.status.available" },
  error: { icon: "triangle-alert", key: "updater.status.error" },
};

const ACTIONS = {
  available: {
    icon: "download",
    label: "updater.download",
    tip: "updater.downloadTip",
  },
  downloading: {
    icon: "loader-circle",
    label: "updater.downloading",
    spin: true,
    disabled: true,
  },
  downloaded: {
    icon: "rotate-cw",
    label: "updater.install",
    tip: "updater.installTip",
  },
  installing: {
    icon: "loader-circle",
    label: "updater.installing",
    spin: true,
    disabled: true,
  },
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function setNotes(target, markdown) {
  const html = renderMarkdown(markdown);
  if (html) target.innerHTML = html;
  else target.textContent = t("updater.noNotes");
}

export function createUpdaterTab(container, navBtn, hooks = {}) {
  container.innerHTML = `
    <div class="upd-card">
      <img class="upd-icon" src="/images/icon.png" alt="" draggable="false" />
      <div class="upd-name">ZIRON Studio</div>
      <div class="upd-version-row">
        <span class="upd-version" id="upd-version">…</span>
        <span class="upd-badge">${t("updater.installed")}</span>
      </div>
      <div class="upd-status" id="upd-status"></div>
      <div class="upd-actions">
        <button type="button" class="upd-btn" id="upd-check"
          data-tooltip="${t("updater.checkTip")}">
          <i data-lucide="refresh-cw"></i><span>${t("updater.check")}</span>
        </button>
        <button type="button" class="upd-btn" id="upd-history"
          data-tooltip="${t("updater.historyTip")}">
          <i data-lucide="history"></i><span>${t("updater.history")}</span>
        </button>
      </div>
    </div>

    <div class="upd-banner upd-hidden" id="upd-banner">
      <div class="upd-banner-head">
        <i data-lucide="sparkles"></i>
        <span class="upd-banner-title">${t("updater.bannerTitle")}</span>
        <span class="upd-badge upd-badge--new" id="upd-new-version"></span>
      </div>
      <div class="upd-notes" id="upd-new-notes"></div>
      <div class="upd-progress upd-hidden" id="upd-progress">
        <div class="upd-progress-bar" id="upd-progress-bar"></div>
      </div>
      <button type="button" class="upd-btn upd-btn--primary" id="upd-action"></button>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">${t("updater.currentNotes")}</div>
      <div class="upd-notes upd-notes--box" id="upd-current-notes"></div>
    </div>

    <div class="settings-group upd-hidden" id="upd-history-group">
      <div class="settings-group-title">${t("updater.previousNotes")}</div>
      <div class="upd-release-list" id="upd-history-list"></div>
    </div>
  `;

  const q = (sel) => container.querySelector(sel);
  const el = {
    version: q("#upd-version"),
    status: q("#upd-status"),
    check: q("#upd-check"),
    history: q("#upd-history"),
    banner: q("#upd-banner"),
    newVersion: q("#upd-new-version"),
    newNotes: q("#upd-new-notes"),
    progress: q("#upd-progress"),
    progressBar: q("#upd-progress-bar"),
    action: q("#upd-action"),
    currentNotes: q("#upd-current-notes"),
    historyGroup: q("#upd-history-group"),
    historyList: q("#upd-history-list"),
  };

  const drawIcons = (root, size = 13) =>
    createIcons({ icons: ICONS, attrs: { width: size, height: size }, root });

  drawIcons(container);

  ensureVersion().then((v) => {
    el.version.textContent = `v${v}`;
  });

  let lastKey = "";

  function renderStatus(phase) {
    const s = STATUS[phase];
    el.status.dataset.phase = phase;
    if (!s) {
      el.status.innerHTML = "";
      return;
    }
    el.status.innerHTML = `<i data-lucide="${s.icon}" class="${s.spin ? "upd-spin" : ""}"></i><span>${t(s.key)}</span>`;
    drawIcons(el.status, 12);
  }

  function buildAction(phase) {
    const a = ACTIONS[phase];
    el.action.disabled = !!a.disabled;
    if (a.tip) el.action.dataset.tooltip = t(a.tip);
    else delete el.action.dataset.tooltip;
    el.action.innerHTML = `<i data-lucide="${a.icon}" class="${a.spin ? "upd-spin" : ""}"></i><span>${t(a.label)}</span>`;
    drawIcons(el.action);
  }

  function updateProgress(s) {
    const downloading = s.phase === "downloading";
    el.progress.classList.toggle("upd-hidden", !downloading);
    if (!downloading) return;

    const { downloaded, total } = s.progress;
    const known = total > 0;
    el.progress.classList.toggle("is-indeterminate", !known);

    const pct = known
      ? Math.min(100, Math.round((downloaded / total) * 100))
      : 0;
    el.progressBar.style.width = known ? `${pct}%` : "";

    const label = el.action.querySelector("span");
    if (label) {
      label.textContent = known
        ? `${t("updater.downloading")} ${pct}%`
        : t("updater.downloading");
    }
  }

  function render(s) {
    renderStatus(s.phase);

    el.check.disabled = BUSY_PHASES.includes(s.phase);
    el.check.classList.toggle("is-busy", s.phase === "checking");
    navBtn?.classList.toggle("has-update", UPDATE_PHASES.includes(s.phase));

    const showBanner = !!s.info && UPDATE_PHASES.includes(s.phase);
    el.banner.classList.toggle("upd-hidden", !showBanner);
    if (!showBanner) {
      lastKey = "";
      return;
    }

    // reconstruir solo cuando cambia la fase o la versión, no en cada chunk
    const key = `${s.phase}|${s.info.version}`;
    if (key !== lastKey) {
      lastKey = key;
      el.newVersion.textContent = `v${s.info.version}`;
      setNotes(el.newNotes, s.info.notes);
      buildAction(s.phase);
    }
    updateProgress(s);
  }

  const unsubscribe = subscribe(render);

  el.check.addEventListener("click", () => {
    logger.debug("Updater", "Manual update check requested");
    checkForUpdates({ trigger: "manual" });
  });

  el.action.addEventListener("click", () => {
    const { phase } = getState();
    if (phase === "available") {
      logger.info("Updater", "Download requested by user");
      downloadUpdate();
    } else if (phase === "downloaded") {
      logger.info("Updater", "Install requested by user");
      checkDirtyAndThen(
        async () => {
          try {
            const saved = await hooks.persistSettings?.();
            if (saved) {
              logger.info(
                "Updater",
                "Pending settings auto-saved before restart",
              );
            }
          } catch (e) {
            // un fallo guardando ajustes no debe impedir la actualización
            logger.warn(
              "Updater",
              `Could not persist settings before restart: ${e}`,
            );
          }
          await installUpdate();
        },
        { action: "restart" },
      );
    }
  });

  let historyLoaded = false;
  el.history.addEventListener("click", async () => {
    const opening = el.historyGroup.classList.contains("upd-hidden");
    el.historyGroup.classList.toggle("upd-hidden", !opening);
    el.history.classList.toggle("is-active", opening);
    if (!opening) return;

    el.historyGroup.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (historyLoaded) return;

    el.historyList.textContent = t("updater.notesLoading");
    try {
      const [releases, current] = await Promise.all([
        fetchReleaseHistory(10),
        ensureVersion(),
      ]);
      el.historyList.innerHTML = releases
        .map(
          (r) => `
        <details class="upd-release">
          <summary>
            <span class="upd-release-name">v${escapeHtml(r.version)}${
              r.version === current
                ? `<span class="upd-badge">${t("updater.installed")}</span>`
                : ""
            }</span>
            <span class="upd-release-date">${escapeHtml(formatDate(r.date))}</span>
          </summary>
          <div class="upd-notes">${
            renderMarkdown(r.notes) || escapeHtml(t("updater.noNotes"))
          }</div>
        </details>`,
        )
        .join("");
      historyLoaded = true;
      logger.debug(
        "Updater",
        `Release history loaded (${releases.length} releases)`,
      );
    } catch (e) {
      logger.warn("Updater", `Could not load release history: ${e}`);
      el.historyList.textContent = t("updater.notesUnavailable");
    }
  });

  let currentNotesLoaded = false;
  async function loadCurrentNotes() {
    if (currentNotesLoaded) return;
    el.currentNotes.textContent = t("updater.notesLoading");
    try {
      const version = await ensureVersion();
      const release = await fetchReleaseByVersion(version);
      setNotes(el.currentNotes, release.notes);
      currentNotesLoaded = true;
      logger.debug("Updater", `Release notes loaded for v${version}`);
    } catch (e) {
      logger.warn("Updater", `Could not load current release notes: ${e}`);
      el.currentNotes.textContent = t("updater.notesUnavailable");
    }
  }

  return {
    // se llama cada vez que el usuario entra en la pestaña
    onShow() {
      logger.debug("Updater", "Updater tab opened");
      checkForUpdates({ trigger: "tab-open" });
      loadCurrentNotes();
    },
    destroy() {
      unsubscribe();
    },
  };
}
