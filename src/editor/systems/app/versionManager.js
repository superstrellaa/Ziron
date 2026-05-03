import { getVersion } from "@tauri-apps/api/app";
import { logger } from "../../../engine/core/logger.js";

export const ENGINE_VERSION = await getVersion();
logger.info("Main", `ZIRON Editor v${ENGINE_VERSION} starting...`);
