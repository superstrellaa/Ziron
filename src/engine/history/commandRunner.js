import { logger } from "../core/logger.js";
import { Toast } from "../ui/toasts/toastTypes.js";

const LOG = "History";

export function createCommandRunner(history) {
  async function run(label, build) {
    let cmd;
    try {
      cmd = build();
      await cmd.execute();
    } catch (e) {
      logger.error(LOG, `${label} failed | Error: ${e}`);
      Toast.generalError();
      return null;
    }
    history.push(cmd);
    return cmd;
  }

  async function step(label, fn) {
    try {
      await fn();
      return true;
    } catch (e) {
      logger.error(LOG, `${label} failed | Error: ${e}`);
      Toast.generalError();
      return false;
    }
  }

  return { run, step };
}
