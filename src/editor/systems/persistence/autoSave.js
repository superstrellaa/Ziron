import { get } from "./config.js";
import { logger } from "../../../engine/core/logger.js";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";

export function createAutoSave(triggerSave) {
  let _intervalId = null;
  let _version = 0;

  function start() {
    if (_intervalId !== null) {
      logger.warn("AutoSave", "start() called but already running — ignoring");
      return;
    }

    const enabled = get("editor.auto_save");
    if (!enabled) {
      logger.info("AutoSave", "Config Disabled — not starting");
      return;
    }

    const minutes = get("editor.auto_save_interval") ?? 5;
    const ms = minutes * 60 * 1000;
    const myVersion = ++_version;

    _intervalId = setInterval(async () => {
      if (myVersion !== _version) return;
      logger.info("AutoSave", `Auto-saving... (every ${minutes}m)`);
      await triggerSave(false);
      Toast.autoSaveProject();
    }, ms);

    logger.info("AutoSave", `Started — interval: ${minutes}m`);
  }

  function stop() {
    if (_intervalId === null) return;
    _version++;
    clearInterval(_intervalId);
    _intervalId = null;
    logger.info("AutoSave", "Stopped");
  }

  function restart() {
    logger.info("AutoSave", "Restarting with new config");
    stop();
    start();
  }

  return { start, stop, restart };
}
