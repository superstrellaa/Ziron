import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../../engine/core/logger.js";
import { Toast } from "../../../../engine/ui/toasts/toastTypes.js";
import { withRetry, errorMessage } from "./retry.js";
import { fetchLatestRelease } from "./releaseNotes.js";

const LOG = "Updater";
const CHECK_TIMEOUT = 15000;
const LOCKED_PHASES = ["downloading", "downloaded", "installing"];
const PROGRESS_MILESTONES = [25, 50, 75];

const state = {
  phase: "idle", // idle | checking | up-to-date | available | downloading | downloaded | installing | error
  info: null, // { version, notes, date, source: "updater" | "github" }
  update: null, // objeto Update del plugin (null si solo lo conocemos por GitHub)
  progress: { downloaded: 0, total: 0 },
  error: null,
};

const listeners = new Set();

function snapshot() {
  return { ...state, progress: { ...state.progress } };
}

function emit() {
  const s = snapshot();
  listeners.forEach((cb) => cb(s));
}

function setState(patch) {
  Object.assign(state, patch);
  emit();
}

export function subscribe(cb) {
  listeners.add(cb);
  cb(snapshot());
  return () => listeners.delete(cb);
}

export const getState = snapshot;

let versionPromise = null;
export function ensureVersion() {
  versionPromise ??= getVersion().catch(() => "0.0.0");
  return versionPromise;
}

function parseVersion(v) {
  return String(v)
    .replace(/^(app-)?v/, "")
    .split(/[.+-]/)
    .map((n) => parseInt(n, 10) || 0);
}

function isNewer(a, b) {
  const A = parseVersion(a);
  const B = parseVersion(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const diff = (A[i] ?? 0) - (B[i] ?? 0);
    if (diff) return diff > 0;
  }
  return false;
}

function formatBytes(n) {
  return n >= 1048576
    ? `${(n / 1048576).toFixed(1)} MB`
    : `${Math.round(n / 1024)} KB`;
}

let checking = null;

export function checkForUpdates({ trigger = "manual" } = {}) {
  if (checking) {
    logger.debug(
      LOG,
      `Check requested (${trigger}) while another is running — joining it`,
    );
    return checking;
  }
  checking = runCheck(trigger).finally(() => {
    checking = null;
  });
  return checking;
}

async function runCheck(trigger) {
  // no pisar una descarga/instalación en curso
  if (LOCKED_PHASES.includes(state.phase)) {
    logger.debug(
      LOG,
      `Check (${trigger}) skipped: update is already ${state.phase}`,
    );
    return;
  }

  const startedAt = performance.now();
  const took = () => `${Math.round(performance.now() - startedAt)}ms`;

  setState({ phase: "checking", error: null });
  const currentVersion = await ensureVersion();
  logger.info(
    LOG,
    `Checking for updates (trigger: ${trigger}, current: v${currentVersion})`,
  );

  // Fuente 1: el plugin (la única que permite instalar)
  try {
    const update = await withRetry(() => check({ timeout: CHECK_TIMEOUT }), {
      attempts: 3,
      label: "update check",
    });

    if (update) {
      logger.info(
        LOG,
        `Update available via updater plugin: v${update.version} (current: v${currentVersion}, took ${took()})`,
      );
      setState({
        phase: "available",
        update,
        info: {
          version: update.version,
          notes: update.body ?? "",
          date: update.date ?? null,
          source: "updater",
        },
      });
      Toast.updateAvailable();
    } else {
      logger.info(
        LOG,
        `No update available via updater plugin (current: v${currentVersion}, took ${took()})`,
      );
      setState({ phase: "up-to-date", update: null, info: null });
      Toast.updateUpToDate();
    }
    return;
  } catch (e) {
    logger.warn(
      LOG,
      `Updater plugin check failed, trying GitHub API: ${errorMessage(e)}`,
    );
  }

  // Fuente 2: la API de GitHub (solo informa; para instalar se pedirá otra vez al plugin)
  try {
    const latest = await fetchLatestRelease({ fresh: true });
    if (isNewer(latest.version, currentVersion)) {
      logger.info(
        LOG,
        `Update available via GitHub API: v${latest.version} (current: v${currentVersion}, took ${took()}) — installing it will require the updater plugin`,
      );
      setState({
        phase: "available",
        update: null,
        info: { ...latest, source: "github" },
      });
      Toast.updateAvailable();
    } else {
      logger.info(
        LOG,
        `Up to date according to GitHub API (latest: v${latest.version}, current: v${currentVersion}, took ${took()})`,
      );
      setState({ phase: "up-to-date", update: null, info: null });
      Toast.updateUpToDate();
    }
  } catch (e) {
    logger.error(LOG, `Update check failed: ${errorMessage(e)}`);
    setState({ phase: "error", error: errorMessage(e) });
    Toast.updateCheckFailed();
  }
}

let lastProgressEmit = 0;
const downloadMilestones = new Set();

function resetDownloadTracking() {
  state.progress = { downloaded: 0, total: 0 };
  downloadMilestones.clear();
}

function onDownloadEvent(event) {
  switch (event.event) {
    case "Started":
      state.progress = { downloaded: 0, total: event.data.contentLength ?? 0 };
      logger.debug(
        LOG,
        `Download stream opened (size: ${state.progress.total ? formatBytes(state.progress.total) : "unknown"})`,
      );
      emit();
      break;

    case "Progress": {
      state.progress.downloaded += event.data.chunkLength;

      // un log por hito, nunca por chunk
      const { downloaded, total } = state.progress;
      if (total > 0) {
        const pct = (downloaded / total) * 100;
        for (const m of PROGRESS_MILESTONES) {
          if (pct >= m && !downloadMilestones.has(m)) {
            downloadMilestones.add(m);
            logger.debug(LOG, `Download ${m}% (${formatBytes(downloaded)})`);
          }
        }
      }

      const now = performance.now();
      if (now - lastProgressEmit > 100) {
        lastProgressEmit = now;
        emit();
      }
      break;
    }

    case "Finished":
      emit();
      break;
  }
}

export async function downloadUpdate() {
  if (state.phase !== "available") {
    logger.debug(LOG, `Download ignored: phase is "${state.phase}"`);
    return;
  }

  const version = state.info?.version;
  logger.info(
    LOG,
    `Download started: v${version} (source: ${state.info?.source})`,
  );
  setState({ phase: "downloading", progress: { downloaded: 0, total: 0 } });
  const startedAt = performance.now();

  try {
    let update = state.update;

    // la info vino de GitHub: hay que conseguir el objeto Update del plugin
    if (!update) {
      logger.info(
        LOG,
        "Update was found via GitHub API; requesting it from the updater plugin before downloading",
      );
      update = await withRetry(() => check({ timeout: CHECK_TIMEOUT }), {
        attempts: 3,
        label: "update re-check",
      });
      if (!update) throw new Error("Updater endpoint reports no update");
      state.update = update;
      logger.debug(LOG, `Updater plugin confirmed update v${update.version}`);
    }

    await withRetry(
      (attempt) => {
        if (attempt > 1) {
          logger.info(LOG, `Retrying download (attempt ${attempt})`);
        }
        resetDownloadTracking();
        return update.download(onDownloadEvent);
      },
      { attempts: 3, label: "update download" },
    );

    const { downloaded, total } = state.progress;
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    logger.info(
      LOG,
      `Download finished: v${version} (${formatBytes(total || downloaded)} in ${seconds}s) — ready to install`,
    );
    setState({ phase: "downloaded" });
    Toast.updateDownloaded();
  } catch (e) {
    logger.error(LOG, `Download failed: ${errorMessage(e)}`);
    setState({ phase: "available", error: errorMessage(e) });
    Toast.updateDownloadFailed();
  }
}

export async function installUpdate() {
  if (state.phase !== "downloaded" || !state.update) {
    logger.debug(LOG, `Install ignored: phase is "${state.phase}"`);
    return;
  }

  logger.info(
    LOG,
    `Installing update v${state.info?.version}; the app will restart`,
  );
  setState({ phase: "installing" });

  try {
    await invoke("save_window_state").catch(() => {});
    logger.debug(LOG, "Window state saved before install");

    await state.update.install();

    // En Windows el instalador cierra la app durante install(): estas dos
    // líneas pueden no llegar a escribirse, y es normal.
    logger.info(LOG, "Update installed; relaunching");
    await relaunch();
  } catch (e) {
    logger.error(LOG, `Install failed: ${errorMessage(e)}`);
    setState({ phase: "downloaded", error: errorMessage(e) });
    Toast.updateInstallFailed();
  }
}
