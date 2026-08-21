import type { LogLevel, LogSeverityLevel } from "../../modules/types.ts";

export const LOG_SEVERITY_LEVELS: LogSeverityLevel[] = ["error", "warn", "info", "log", "debug"];

export function isLogSeverityLevel(level: unknown): level is LogSeverityLevel {
  return typeof level === "string" && LOG_SEVERITY_LEVELS.includes(level as LogSeverityLevel);
}

export function normalizeLogSeverity(level: LogLevel | string): LogSeverityLevel {
  if (level === "success") {
    return "info";
  }

  return isLogSeverityLevel(level) ? level : "log";
}

export function formatLogSeverity(level: LogLevel | string): string {
  switch (normalizeLogSeverity(level)) {
    case "error":
      return "Error";
    case "warn":
      return "Warn";
    case "info":
      return "Info";
    case "debug":
      return "Debug";
    default:
      return "Log";
  }
}

export function parseLogMessageParts(message: unknown): { source: string; body: string } {
  const normalized = String(message ?? "");
  const match = normalized.match(/^([^:]+):\s+(.*)$/);
  if (!match) {
    return {
      source: "Simulator",
      body: normalized,
    };
  }

  return {
    source: match[1],
    body: match[2],
  };
}
