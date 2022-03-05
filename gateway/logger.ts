import { pino, Logger as PinoLogger, stdTimeFunctions } from "pino";

export function Logger(name: string): PinoLogger {
  return pino({
    name: name,
    level: "info",
    formatters: {
      level(label: string) {
        return { level: label };
      },
      bindings(bindings: any) {
        return { name: bindings.name };
      },
    },
    timestamp: stdTimeFunctions.isoTime,
  });
}
