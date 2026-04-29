import type { AppState, DeviceState, LogSeverityLevel } from "../types.ts";

export function createAppState({ device }: { device: DeviceState }): AppState {
  return {
    files: [],
    activeFileId: null,
    openFileMenuId: null,
    helpVisible: false,
    logVisible: true,
    macroSidebarVisible: true,
    logs: [],
    logFilterText: "",
    logSeverityMenuOpen: false,
    logSeverityLevels: new Set<LogSeverityLevel>(["error", "warn", "info", "log", "debug"]),
    device,
  };
}
