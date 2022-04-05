import { pino, Logger as PinoLogger, stdTimeFunctions } from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

export function Logger(name: string): PinoLogger {
  return pino({
    name: name,
    level: isDevelopment ? "debug" : "info",
    formatters: {
      level(label: string) {
        return { level: label };
      },
      bindings(bindings: any) {
        return { name: bindings.name };
      },
    },
    timestamp: isDevelopment
      ? () => `,"time":"${new Date().toLocaleString()}"`
      : stdTimeFunctions.isoTime,
  });
}
