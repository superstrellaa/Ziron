function send(level, module, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.padEnd(5)}] [${module}] ${message}`;

  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);

  window.ziron?.log(level, module, message);
}

export const logger = {
  info: (module, msg) => send("INFO", module, msg),
  warn: (module, msg) => send("WARN", module, msg),
  error: (module, msg) => send("ERROR", module, msg),
  debug: (module, msg) => send("DEBUG", module, msg),
};
