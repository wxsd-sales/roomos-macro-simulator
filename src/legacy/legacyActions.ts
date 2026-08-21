export interface LegacyActions {
  runMacros(): Promise<void>;
  resetSimulator(): void;
  loadSampleMacro(): void;
  createNewFile(): void;
  saveActiveFileToDeviceAndRestart(): void;
  exportActiveFile(): void;
  openFromFile(): void;
  syncLegacyLayout(): void;
  applyMonacoTheme(): void;
}

let legacyActions: LegacyActions | null = null;

export function registerLegacyActions(actions: LegacyActions): void {
  legacyActions = actions;
}

export function getLegacyActions(): LegacyActions {
  if (!legacyActions) {
    throw new Error("Legacy actions are not registered yet.");
  }
  return legacyActions;
}
