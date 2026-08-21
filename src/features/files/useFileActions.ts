import { useCallback } from "react";
import type { AppFile } from "../../modules/types.ts";
import { useAppStore } from "../app/AppProvider.tsx";
import { createMacroFile } from "./fileUtils.ts";
import { sampleMacros } from "../../samples/index.ts";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createLogTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function useFileActions() {
  const { state, dispatch } = useAppStore();

  const addLog = useCallback(
    (message: string, level: "info" | "success" | "error" | "warn" = "info") => {
      dispatch({
        type: "ADD_LOG",
        log: {
          id: crypto.randomUUID(),
          level,
          message,
          timestamp: createLogTimestamp(),
        },
      });
    },
    [dispatch],
  );

  const saveFileToDisk = useCallback(
    (file: AppFile) => {
      const blob = new Blob([file.content], { type: "text/javascript;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      dispatch({ type: "SET_OPEN_FILE_MENU", fileId: null });
      addLog(`Saved ${file.name} to file.`, "success");
    },
    [addLog, dispatch],
  );

  const saveFileToDevice = useCallback(
    (file: AppFile) => {
      dispatch({ type: "UPDATE_FILE", fileId: file.id, patch: { deviceContent: file.content } });
      addLog(`Saved ${file.name} to simulated device.`, "success");
    },
    [addLog, dispatch],
  );

  const toggleFileEnabled = useCallback(
    (file: AppFile) => {
      const enabled = !file.enabled;
      dispatch({ type: "UPDATE_FILE", fileId: file.id, patch: { enabled } });
      addLog(`${enabled ? "Enabled" : "Disabled"} ${file.name}`, "success");
    },
    [addLog, dispatch],
  );

  const renameFile = useCallback(
    (file: AppFile) => {
      const nextName = window.prompt("Rename macro file", file.name);
      if (!nextName) {
        return;
      }

      const name = nextName.trim() || file.name;
      dispatch({ type: "UPDATE_FILE", fileId: file.id, patch: { name } });
      dispatch({ type: "SET_OPEN_FILE_MENU", fileId: null });
    },
    [dispatch],
  );

  const removeFile = useCallback(
    (file: AppFile) => {
      dispatch({ type: "REMOVE_FILE", fileId: file.id });
      dispatch({ type: "SET_OPEN_FILE_MENU", fileId: null });
      addLog(`Deleted ${file.name}`, "success");
    },
    [addLog, dispatch],
  );

  const createNewFile = useCallback(() => {
    const file = createMacroFile(
      `macro-${state.files.length + 1}.js`,
      `import xapi from 'xapi';\n\n// Start building your RoomOS macro here.\n`,
    );
    dispatch({ type: "PREPEND_FILE", file });
  }, [dispatch, state.files.length]);

  const loadSampleMacro = useCallback(() => {
    try {
      const imported = sampleMacros.map((sample) => {
        const file = createMacroFile(sample.name, sample.content);
        return { ...file, enabled: sample.enabled };
      });

      dispatch({
        type: "ADD_FILES",
        files: imported,
        activeFileId: imported[0]?.id ?? state.activeFileId,
      });
      addLog(`Loaded ${imported.length} sample macro${imported.length === 1 ? "" : "s"} into workspace.`, "success");
    } catch (error) {
      addLog(`Failed to load sample macros: ${getErrorMessage(error)}`, "error");
    }
  }, [addLog, dispatch, state.activeFileId]);

  const handleFileUpload = useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      if (!files.length) {
        return;
      }

      const imported = await Promise.all(
        files.map(async (file) => createMacroFile(file.name, await file.text())),
      );

      dispatch({
        type: "ADD_FILES",
        files: imported,
        activeFileId: imported[0].id,
      });
      addLog(`Imported ${imported.length} macro file${imported.length === 1 ? "" : "s"}.`, "success");
    },
    [addLog, dispatch],
  );

  return {
    saveFileToDisk,
    saveFileToDevice,
    toggleFileEnabled,
    renameFile,
    removeFile,
    createNewFile,
    loadSampleMacro,
    handleFileUpload,
  };
}
