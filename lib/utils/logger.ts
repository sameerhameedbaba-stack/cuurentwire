/**
 * Minimal structured logger. Never log secrets or user data.
 * Swappable for a real telemetry sink later without touching call sites.
 */

type LogFields = Record<string, string | number | boolean | undefined>;

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  const line = {
    level,
    event,
    time: new Date().toISOString(),
    ...fields,
  };
  const output = JSON.stringify(line);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
