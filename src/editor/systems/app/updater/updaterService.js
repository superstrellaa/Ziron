import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../../engine/core/logger.js";
import { Toast } from "../../../../engine/ui/toasts/toastTypes.js";
import { withRetry, errorMessage } from "./retry.js";
import { fetchLatestRelease } from "./releaseNotes.js";

const CHECK_TIMEOUT = 15000;
const LOCKED_PHASES = ["downloading", "downloaded", "installing"];

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

let checking = null;

export function checkForUpdates() {
  checking ??= runCheck().finally(() => {
    checking = null;
  });
  return checking;
}

async function runCheck() {
  // no pisar una descarga/instalación en curso
  if (LOCKED_PHASES.includes(state.phase)) return;

  setState({ phase: "checking", error: null });
  const currentVersion = await ensureVersion();

  try {
    const update = await withRetry(() => check({ timeout: CHECK_TIMEOUT }), {
      attempts: 3,
      label: "update check",
    });

    if (update) {
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
      setState({ phase: "up-to-date", update: null, info: null });
      Toast.updateUpToDate();
    }
    return;
  } catch (e) {
    logger.warn(
      "Updater",
      `Updater plugin check failed, trying GitHub API: ${errorMessage(e)}`,
    );
  }

  try {
    const latest = await fetchLatestRelease({ fresh: true });
    if (isNewer(latest.version, currentVersion)) {
      setState({
        phase: "available",
        update: null,
        info: { ...latest, source: "github" },
      });
      Toast.updateAvailable();
    } else {
      setState({ phase: "up-to-date", update: null, info: null });
      Toast.updateUpToDate();
    }
  } catch (e) {
    logger.error("Updater", `Update check failed: ${errorMessage(e)}`);
    setState({ phase: "error", error: errorMessage(e) });
    Toast.updateCheckFailed();
  }
}

let lastProgressEmit = 0;

function onDownloadEvent(event) {
  switch (event.event) {
    case "Started":
      state.progress = { downloaded: 0, total: event.data.contentLength ?? 0 };
      emit();
      break;
    case "Progress": {
      state.progress.downloaded += event.data.chunkLength;
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
  if (state.phase !== "available") return;

  setState({ phase: "downloading", progress: { downloaded: 0, total: 0 } });

  try {
    let update = state.update;

    // la info vino de GitHub: hay que conseguir el objeto Update del plugin
    if (!update) {
      update = await withRetry(() => check({ timeout: CHECK_TIMEOUT }), {
        attempts: 3,
        label: "update re-check",
      });
      if (!update) throw new Error("Updater endpoint reports no update");
      state.update = update;
    }

    await withRetry(
      () => {
        state.progress = { downloaded: 0, total: 0 };
        return update.download(onDownloadEvent);
      },
      { attempts: 3, label: "update download" },
    );

    setState({ phase: "downloaded" });
    Toast.updateDownloaded();
  } catch (e) {
    logger.error("Updater", `Download failed: ${errorMessage(e)}`);
    setState({ phase: "available", error: errorMessage(e) });
    Toast.updateDownloadFailed();
  }
}

export async function installUpdate() {
  if (state.phase !== "downloaded" || !state.update) return;

  setState({ phase: "installing" });
  try {
    await invoke("save_window_state").catch(() => {});
    await state.update.install();
    await relaunch(); // en Windows el instalador ya cierra la app antes de llegar aquí
  } catch (e) {
    logger.error("Updater", `Install failed: ${errorMessage(e)}`);
    setState({ phase: "downloaded", error: errorMessage(e) });
    Toast.updateInstallFailed();
  }
}
