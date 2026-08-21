import type {
  AppFile,
  AppState,
  DeviceState,
  LogSeverityLevel,
  RuntimeLog,
} from "../../modules/types.ts";
import type { ThemePreference } from "./themePreference.ts";

export interface SimulatorAppState extends AppState {
  themePreference: ThemePreference;
}

export type AppAction =
  | { type: "SET_ACTIVE_FILE"; fileId: string | null }
  | { type: "SET_OPEN_FILE_MENU"; fileId: string | null }
  | { type: "SET_HELP_VISIBLE"; visible: boolean }
  | { type: "TOGGLE_HELP" }
  | { type: "SET_LOG_VISIBLE"; visible: boolean }
  | { type: "TOGGLE_LOG" }
  | { type: "SET_MACRO_SIDEBAR_VISIBLE"; visible: boolean }
  | { type: "TOGGLE_MACRO_SIDEBAR" }
  | { type: "ADD_LOG"; log: RuntimeLog }
  | { type: "SET_LOG_FILTER"; text: string }
  | { type: "SET_LOG_SEVERITY_MENU_OPEN"; open: boolean }
  | { type: "TOGGLE_LOG_SEVERITY_MENU" }
  | { type: "RESET_LOG_SEVERITY_FILTERS" }
  | { type: "TOGGLE_LOG_SEVERITY_LEVEL"; level: LogSeverityLevel }
  | { type: "SET_DEVICE"; device: DeviceState }
  | { type: "SET_THEME_PREFERENCE"; preference: ThemePreference }
  | { type: "SET_FILES"; files: AppFile[]; activeFileId?: string | null; openFileMenuId?: string | null }
  | { type: "ADD_FILES"; files: AppFile[]; activeFileId?: string | null }
  | { type: "PREPEND_FILE"; file: AppFile }
  | { type: "REMOVE_FILE"; fileId: string }
  | { type: "UPDATE_FILE"; fileId: string; patch: Partial<Pick<AppFile, "name" | "content" | "deviceContent" | "enabled">> };
