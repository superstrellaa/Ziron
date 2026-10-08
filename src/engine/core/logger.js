import { invoke } from "@tauri-apps/api/core";

const MAX_ATTEMPTS = 3;
const queue = [];
let seq = 0;
let flushing = false;
let initPromise = null;

function ensureInit() {
  initPromise ??= invoke("init_logger").catch((e) => {
    initPromise = null; // permite reintentar en el siguiente log
    throw e;
  });
  return initPromise;
}

async function flush() {
  if (flushing) return;
  flushing = true;

  try {
    await ensureInit();

    while (queue.length > 0) {
      const item = queue[0];
      try {
        await invoke("log", item.args);
        queue.shift();
        item.resolve();
      } catch (e) {
        item.attempts++;
        if (item.attempts >= MAX_ATTEMPTS) {
          console.error(
            "[logger] log descartado tras reintentos:",
            item.args,
            e,
          );
          queue.shift();
          item.resolve();
        } else {
          await new Promise((r) => setTimeout(r, 50 * item.attempts));
        }
      }
    }
  } catch (e) {
    console.error("[logger] init_logger falló, se reintentará:", e);
  } finally {
    flushing = false;
  }
}

function enqueue(level, module, message) {
  return new Promise((resolve) => {
    queue.push({
      args: {
        level,
        module,
        message: String(message),
        ts: new Date().toISOString(),
        seq: ++seq,
      },
      attempts: 0,
      resolve,
    });
    flush();
  });
}

export const logger = {
  async init() {
    await ensureInit();
    await flush();
  },
  info: (module, msg) => enqueue("INFO", module, msg),
  warn: (module, msg) => enqueue("WARN", module, msg),
  error: (module, msg) => enqueue("ERROR", module, msg),
  debug: (module, msg) => enqueue("DEBUG", module, msg),
};
