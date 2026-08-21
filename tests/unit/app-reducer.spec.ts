import { describe, expect, it } from "vitest";
import { appReducer } from "../../src/features/app/appReducer.ts";
import { createInitialSimulatorAppState } from "../../src/features/app/createInitialAppState.ts";
import { initialDeviceState } from "../../src/features/app/simulatorDevice.ts";
import type { AppFile } from "../../src/modules/types.ts";

function createTestFile(overrides: Partial<AppFile> = {}): AppFile {
  return {
    id: "file-1",
    name: "macro.js",
    content: "console.log('hello');",
    deviceContent: "console.log('hello');",
    enabled: true,
    ...overrides,
  };
}

describe("appReducer", () => {
  it("adds logs to the front of the list", () => {
    const initialState = createInitialSimulatorAppState(initialDeviceState);
    const nextState = appReducer(initialState, {
      type: "ADD_LOG",
      log: {
        id: "log-1",
        level: "info",
        message: "Ready",
        timestamp: "12:00:00",
      },
    });

    expect(nextState.logs).toHaveLength(1);
    expect(nextState.logs[0]?.message).toBe("Ready");
  });

  it("prepends a new macro file and selects it", () => {
    const initialState = createInitialSimulatorAppState(initialDeviceState);
    const file = createTestFile({ id: "file-2", name: "macro-2.js" });
    const nextState = appReducer(initialState, { type: "PREPEND_FILE", file });

    expect(nextState.files).toHaveLength(1);
    expect(nextState.activeFileId).toBe("file-2");
  });

  it("removes a file and falls back to the next active file", () => {
    const firstFile = createTestFile({ id: "file-1" });
    const secondFile = createTestFile({ id: "file-2", name: "macro-2.js" });
    const initialState = {
      ...createInitialSimulatorAppState(initialDeviceState),
      files: [firstFile, secondFile],
      activeFileId: "file-1",
    };

    const nextState = appReducer(initialState, { type: "REMOVE_FILE", fileId: "file-1" });

    expect(nextState.files).toHaveLength(1);
    expect(nextState.activeFileId).toBe("file-2");
  });

  it("stores theme preference in app state", () => {
    const initialState = createInitialSimulatorAppState(initialDeviceState);
    const nextState = appReducer(initialState, { type: "SET_THEME_PREFERENCE", preference: "dark" });

    expect(nextState.themePreference).toBe("dark");
  });
});
