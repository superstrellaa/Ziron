import fs from "fs";
import path from "path";
import { app } from "electron";

let logStream = null;
let runId = null;

function generateRunId() {
  return Math.random().toString(16).slice(2, 10).toUpperCase();
}

function getLogPath() {
  const base = app.isPackaged
    ? path.join(path.dirname(app.getAppPath()), "logs")
    : path.join(process.cwd(), "logs");

  return base;
}

export function initLogger() {
  runId = generateRunId();

  if (!app.isPackaged) {
    // En dev solo usar consola, no escribir mierda
    return;
  }

  const logsDir = getLogPath();
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `ziron-engine_${date}.${runId}.log`;
  const filepath = path.join(logsDir, filename);

  logStream = fs.createWriteStream(filepath, { flags: "a" });

  log("INFO", "Logger", `Session started — Run ID: ${runId}`);
  log("INFO", "Logger", `App version: ${app.getVersion()}`);
  log("INFO", "Logger", `Platform: ${process.platform} ${process.arch}`);
  log("INFO", "Logger", `Packaged: ${app.isPackaged}`);
}

export function closeLogger() {
  if (!logStream) return;
  log("INFO", "Logger", "Session ended");
  logStream.end();
  logStream = null;
}

// Niveles: INFO | WARN | ERROR | DEBUG
export function log(level, module, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.padEnd(5)}] [${module}] ${message}`;

  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);

  if (logStream) logStream.write(line + "\n");
}

export function getRunId() {
  return runId;
}
