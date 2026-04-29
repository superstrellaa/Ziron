import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../engine/core/logger.js";

let _config = null;

export async function loadConfig() {
  try {
    _config = await invoke("load_config");
    logger.info("Config", "Config loaded");
    return _config;
  } catch (e) {
    logger.warn("Config", `Failed to load config: ${e}`);
    return null;
  }
}

export async function saveConfig() {
  if (!_config) return;
  try {
    await invoke("save_config", { config: _config });
    logger.info("Config", "Config saved");
  } catch (e) {
    logger.warn("Config", `Failed to save config: ${e}`);
  }
}

export function getConfig() {
  return _config;
}

export function get(path) {
  if (!_config) return undefined;
  return path.split(".").reduce((obj, key) => obj?.[key], _config);
}

export async function set(path, value) {
  if (!_config) return;
  const keys = path.split(".");
  let obj = _config;
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
  }
  obj[keys.at(-1)] = value;
  await saveConfig();
}
