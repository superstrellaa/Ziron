import { logger } from "../core/logger.js";
import en from "./locales/en.js";
import es from "./locales/es.js";

const LOCALES = { en, es };
const FALLBACK = "en";

let current = en;

export function setLocale(lang) {
  if (!LOCALES[lang]) {
    logger.warn(`Locale "${lang}" not found, using fallback "${FALLBACK}"`);
    current = LOCALES[FALLBACK];
    return;
  }
  current = LOCALES[lang];
}

export function getLocale() {
  return current;
}

export function t(key) {
  const parts = key.split(".");
  let result = current;

  for (const part of parts) {
    result = result?.[part];
    if (result === undefined) {
      logger.warn("i18n", `Missing key "${key}"`);
      return key;
    }
  }

  return result;
}
