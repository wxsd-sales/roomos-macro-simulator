import type { LogSeverityLevel } from "../../modules/types.ts";
import type { AppFile } from "../../modules/types.ts";
import type { AppAction, SimulatorAppState } from "./types.ts";

const DEFAULT_LOG_SEVERITY_LEVELS: LogSeverityLevel[] = ["error", "warn", "info", "log", "debug"];

type FilePatch = Partial<Pick<AppFile, "name" | "content" | "deviceContent" | "enabled">>;

function updateFile(state: SimulatorAppState, fileId: string, patch: FilePatch): SimulatorAppState {
  return {
    ...state,
    files: state.files.map((file) => (file.id === fileId ? { ...file, ...patch } : file)),
  };
}

export function appReducer(state: SimulatorAppState, action: AppAction): SimulatorAppState {
  switch (action.type) {
    case "SET_ACTIVE_FILE":
      return { ...state, activeFileId: action.fileId };
    case "SET_OPEN_FILE_MENU":
      return { ...state, openFileMenuId: action.fileId };
    case "SET_HELP_VISIBLE":
      return { ...state, helpVisible: action.visible };
    case "TOGGLE_HELP":
      return { ...state, helpVisible: !state.helpVisible };
    case "SET_LOG_VISIBLE":
      return { ...state, logVisible: action.visible };
    case "TOGGLE_LOG":
      return { ...state, logVisible: !state.logVisible };
    case "SET_MACRO_SIDEBAR_VISIBLE":
      return { ...state, macroSidebarVisible: action.visible };
    case "TOGGLE_MACRO_SIDEBAR":
      return { ...state, macroSidebarVisible: !state.macroSidebarVisible };
    case "ADD_LOG":
      return { ...state, logs: [action.log, ...state.logs] };
    case "SET_LOG_FILTER":
      return { ...state, logFilterText: action.text };
    case "SET_LOG_SEVERITY_MENU_OPEN":
      return { ...state, logSeverityMenuOpen: action.open };
    case "TOGGLE_LOG_SEVERITY_MENU":
      return { ...state, logSeverityMenuOpen: !state.logSeverityMenuOpen };
    case "RESET_LOG_SEVERITY_FILTERS":
      return { ...state, logSeverityLevels: new Set(DEFAULT_LOG_SEVERITY_LEVELS) };
    case "TOGGLE_LOG_SEVERITY_LEVEL": {
      const nextLevels = new Set(state.logSeverityLevels);
      if (nextLevels.has(action.level)) {
        nextLevels.delete(action.level);
      } else {
        nextLevels.add(action.level);
      }
      return { ...state, logSeverityLevels: nextLevels };
    }
    case "SET_DEVICE":
      return { ...state, device: action.device };
    case "SET_THEME_PREFERENCE":
      return { ...state, themePreference: action.preference };
    case "SET_FILES":
      return {
        ...state,
        files: action.files,
        activeFileId: action.activeFileId ?? state.activeFileId,
        openFileMenuId: action.openFileMenuId ?? state.openFileMenuId,
      };
    case "ADD_FILES":
      return {
        ...state,
        files: [...action.files, ...state.files],
        activeFileId: action.activeFileId ?? state.activeFileId,
      };
    case "PREPEND_FILE":
      return {
        ...state,
        files: [action.file, ...state.files],
        activeFileId: action.file.id,
      };
    case "REMOVE_FILE": {
      const files = state.files.filter((file) => file.id !== action.fileId);
      return {
        ...state,
        files,
        activeFileId: state.activeFileId === action.fileId ? files[0]?.id ?? null : state.activeFileId,
        openFileMenuId: state.openFileMenuId === action.fileId ? null : state.openFileMenuId,
      };
    }
    case "UPDATE_FILE":
      return updateFile(state, action.fileId, action.patch);
    default:
      return state;
  }
}
