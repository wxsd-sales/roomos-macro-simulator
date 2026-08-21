import { runMacros as executeMacros } from "../modules/runMacros.ts";
import type { AppFile, LogLevel } from "../modules/types.ts";
import { sampleMacros } from "../samples/index.ts";
import type { AppStoreBridge } from "../features/app/appStoreBridge.ts";
import type { AppAction } from "../features/app/types.ts";
import { createMacroFile, isFileDirty } from "../features/files/fileUtils.ts";
import { isLogSeverityLevel } from "../features/console/logUtils.ts";
import { getMonacoThemeName } from "../features/theme/themeUtils.ts";
import { registerDeviceHost } from "./deviceHost.ts";
import { syncLegacyLayout } from "./layoutHost.ts";
import { registerLegacyActions } from "./legacyActions.ts";
import { applyMonacoTheme, waitForXapiSchema } from "./monacoHost.ts";

let appStore: AppStoreBridge;

function getState() {
  return appStore.getState();
}

function dispatchApp(action: AppAction): void {
  appStore.dispatch(action);
}

function normalizeLogLevel(level: string): LogLevel {
  if (level === "success" || isLogSeverityLevel(level)) {
    return level;
  }
  return "info";
}

function addLog(message: string, level = "info"): void {
  dispatchApp({
    type: "ADD_LOG",
    log: {
      id: crypto.randomUUID(),
      level: normalizeLogLevel(level),
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    },
  });
}

function getActiveFile(): AppFile | null {
  return getState().files.find((file) => file.id === getState().activeFileId) ?? null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function saveFileToDevice(file: AppFile): void {
  dispatchApp({ type: "UPDATE_FILE", fileId: file.id, patch: { deviceContent: file.content } });
  addLog(`Saved ${file.name} to simulated device.`, "success");
}

function saveActiveFileToDeviceAndRestart(): void {
  const activeFile = getActiveFile();
  if (!activeFile) {
    addLog("No active macro selected.", "error");
    return;
  }

  if (isFileDirty(activeFile)) {
    saveFileToDevice(activeFile);
  } else {
    addLog(`${activeFile.name} is already saved to the simulated device.`, "info");
  }

  void runMacros();
}

function exportActiveFile(): void {
  const activeFile = getActiveFile();
  if (!activeFile) {
    addLog("No active macro selected for export.", "error");
    return;
  }

  const blob = new Blob([activeFile.content], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = activeFile.name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  addLog(`Saved ${activeFile.name} to file.`, "success");
}

function openFromFile(): void {
  document.querySelector<HTMLInputElement>("#file-input")?.click();
}

function createNewFile(): void {
  const file = createMacroFile(
    `macro-${getState().files.length + 1}.js`,
    `import xapi from 'xapi';\n\n// Start building your RoomOS macro here.\n`,
  );
  dispatchApp({ type: "PREPEND_FILE", file });
}

function loadSampleMacro(): void {
  try {
    const imported = sampleMacros.map((sample) => {
      const file = createMacroFile(sample.name, sample.content);
      return { ...file, enabled: sample.enabled };
    });

    dispatchApp({
      type: "ADD_FILES",
      files: imported,
      activeFileId: imported[0]?.id ?? getState().activeFileId,
    });
    addLog(`Loaded ${imported.length} sample macro${imported.length === 1 ? "" : "s"} into workspace.`, "success");
  } catch (error) {
    addLog(`Failed to load sample macros: ${getErrorMessage(error)}`, "error");
  }
}

async function runMacros(): Promise<void> {
  const schemaBundle = await waitForXapiSchema();
  registerDeviceHost.clearXapiFacade();

  const deviceRuntime = registerDeviceHost.getRuntime();
  dispatchApp({ type: "SET_DEVICE", device: deviceRuntime.reset() });

  await executeMacros({
    files: getState().files,
    addLog,
    createXapiFacade: () =>
      registerDeviceHost.createXapiFacade(
        addLog,
        () => registerDeviceHost.renderFromRuntime(),
        schemaBundle,
      ),
  });
}

function resetSimulator(): void {
  registerDeviceHost.clearXapiFacade();
  registerDeviceHost.reset();
}

function updateMonacoTheme(): void {
  applyMonacoTheme(getMonacoThemeName(getState().themePreference));
}

let legacyAppBootstrapped = false;

export function bootstrapApp(store: AppStoreBridge): void {
  if (legacyAppBootstrapped) {
    return;
  }
  legacyAppBootstrapped = true;
  appStore = store;

  registerLegacyActions({
    runMacros,
    resetSimulator,
    loadSampleMacro,
    createNewFile,
    saveActiveFileToDeviceAndRestart,
    exportActiveFile,
    openFromFile,
    syncLegacyLayout,
    applyMonacoTheme: updateMonacoTheme,
  });

  loadSampleMacro();
}
