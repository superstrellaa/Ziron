import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../engine/core/logger.js";
import { Toast } from "../../../engine/ui/toasts/toastTypes.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";

let _config = null;
let _usedFallback = false;

function describeError(e) {
  return typeof e === "string" ? e : (e?.message ?? String(e));
}

export function usedFallbackConfig() {
  return _usedFallback;
}

export async function loadConfig() {
  try {
    _config = await invoke("load_config");
    _usedFallback = false;
    logger.info("Config", "Config loaded");
    return _config;
  } catch (e) {
    _usedFallback = true;
    logger.error(
      "Config",
      `Failed to load config, falling back to defaults | Error: ${describeError(e)}`,
    );
    try {
      _config = await invoke("get_default_config");
      logger.info("Config", "Default config loaded as fallback");
    } catch (fallbackErr) {
      _config = null;
      logger.error(
        "Config",
        `Failed to load default config | Error: ${describeError(fallbackErr)}`,
      );
    }
    return _config;
  }
}

export async function saveConfig() {
  if (!_config) {
    logger.error("Config", "Cannot save config: no config is loaded");
    Toast.failedToSaveConfig();
    return false;
  }
  try {
    await invoke("save_config", { config: _config });
    logger.info("Config", "Config saved");
    return true;
  } catch (e) {
    logger.error(
      "Config",
      `Failed to save config | Error: ${describeError(e)}`,
    );
    Toast.failedToSaveConfig();
    Popup.error("Failed to save config: " + describeError(e));
    return false;
  }
}

export function set(path, value) {
  setValue(path, value);
  return saveConfig();
}

export function getConfig() {
  return _config;
}

export function get(path) {
  if (!_config) return undefined;
  return path.split(".").reduce((obj, key) => obj?.[key], _config);
}

export function setNoSave(path, value) {
  setValue(path, value);
}

// funcion para reemplazar codigo repetido en set y setNoSave
function setValue(path, value) {
  if (!_config) return;
  const keys = path.split(".");
  let obj = _config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys.at(-1)] = value;
}
