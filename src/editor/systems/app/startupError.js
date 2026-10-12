import { getCurrentWindow } from "@tauri-apps/api/window";
import { logger } from "../../../engine/core/logger.js";
import { initPopupSystem } from "../../../engine/ui/popup/popup.js";
import { Popup } from "../../../engine/ui/popup/popupTypes.js";

let popupReady = false;

export function markPopupReady() {
  popupReady = true;
}

export async function handleFatalStartupError(err) {
  const summary = typeof err === "string" ? err : (err?.message ?? String(err));
  const fullText = err?.stack ?? summary;

  logger.error("startup", `Fatal error during startup | Error: ${fullText}`);

  try {
    if (!popupReady) {
      initPopupSystem();
      popupReady = true;
    }
    await Popup.fatalStartupError(summary, fullText);
    await getCurrentWindow().close();
  } catch (popupErr) {
    logger.error(
      "startup",
      `Could not show startup error popup | Error: ${popupErr}`,
    );
  }
}
