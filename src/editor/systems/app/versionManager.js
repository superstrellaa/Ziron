import { getVersion } from "@tauri-apps/api/app";
import { logger } from "../../../engine/core/logger.js";

export const EDITOR_VERSION = await getVersion();
logger.info("Main", `ZIRON Studio - Editor v${EDITOR_VERSION} starting...`);
