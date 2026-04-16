import { invoke } from "@tauri-apps/api/core";

let initialized = false;

export const logger = {
  async init() {
    if (initialized) return;

    await invoke("init_logger");
    initialized = true;
  },

  info(module, msg) {
    return invoke("log", {
      level: "INFO",
      module,
      message: msg,
    });
  },

  warn(module, msg) {
    return invoke("log", {
      level: "WARN",
      module,
      message: msg,
    });
  },

  error(module, msg) {
    return invoke("log", {
      level: "ERROR",
      module,
      message: msg,
    });
  },

  debug(module, msg) {
    return invoke("log", {
      level: "DEBUG",
      module,
      message: msg,
    });
  },
};
