import { logger } from "../../../../engine/core/logger.js";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function errorMessage(e) {
  return typeof e === "string" ? e : (e?.message ?? String(e));
}

export async function withRetry(
  fn,
  {
    attempts = 3,
    baseDelay = 800,
    label = "operation",
    shouldRetry = () => true,
  } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastError = e;
      const willRetry = attempt < attempts && shouldRetry(e);
      logger.warn(
        "Updater",
        `${label} failed (attempt ${attempt}/${attempts}): ${errorMessage(e)}${willRetry ? " — retrying" : ""}`,
      );
      if (!willRetry) break;
      await sleep(baseDelay * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
