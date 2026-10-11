import { logger } from "../../../../engine/core/logger.js";
import { Popup } from "../../../../engine/ui/popup/popupTypes.js";
import { get, set } from "../../persistence/config.js";
import { sleep, errorMessage } from "./retry.js";
import {
  checkForUpdates,
  ensureVersion,
  getState,
  isNewer,
} from "./updaterService.js";
import { openSettings } from "../../../ui/panels/settingsPanel.js";

const LOG = "Updater";
const CONFIG_KEY = "versions_discarded";
const STARTUP_WAIT_MS = 8000;

const tag = (version) => `v${String(version).replace(/^(app-)?v/, "")}`;

function getDiscarded() {
  const list = get(CONFIG_KEY);
  return Array.isArray(list) ? list : [];
}

function isDiscarded(version) {
  return getDiscarded().includes(tag(version));
}

async function discardVersion(version) {
  const list = new Set(getDiscarded());
  list.add(tag(version));
  await set(CONFIG_KEY, [...list]);
  logger.info(
    LOG,
    `Update ${tag(version)} discarded by user (won't prompt again)`,
  );
}

async function pruneDiscardedVersions(currentVersion) {
  const list = getDiscarded();
  if (list.length === 0) return;

  const kept = list.filter(
    (v) => typeof v === "string" && isNewer(v, currentVersion),
  );
  if (kept.length === list.length) return;

  await set(CONFIG_KEY, kept);
  const removed = list.filter((v) => !kept.includes(v));
  logger.info(
    LOG,
    `Pruned discarded versions: ${removed.join(", ")} (installed: v${currentVersion})`,
  );
}

export function startStartupUpdateCheck() {
  const ready = (async () => {
    const current = await ensureVersion();
    await pruneDiscardedVersions(current);
    await checkForUpdates({ trigger: "startup", silent: true });
  })().catch((e) =>
    logger.warn(LOG, `Startup update check failed: ${errorMessage(e)}`),
  );

  return {
    async promptIfAvailable() {
      const timedOut = await Promise.race([
        ready.then(() => false),
        sleep(STARTUP_WAIT_MS).then(() => true),
      ]);
      if (timedOut) {
        logger.info(
          LOG,
          "Startup update check took too long; skipping popup for this session",
        );
        return;
      }

      const { phase, info } = getState();
      if (phase !== "available" || !info) {
        logger.debug(LOG, "Startup check: nothing to announce");
        return;
      }

      if (isDiscarded(info.version)) {
        logger.info(
          LOG,
          `Update ${tag(info.version)} is available but was discarded by the user — skipping popup`,
        );
        return;
      }

      logger.info(LOG, `Announcing update ${tag(info.version)} at startup`);
      const result = await Popup.updateAvailable(tag(info.version));
      logger.info(LOG, `Startup update popup → ${result}`);

      if (result === "update") {
        openSettings({ section: "updater", skipAutoCheck: true });
      } else if (result === "dismiss") {
        await discardVersion(info.version);
      }
    },
  };
}
