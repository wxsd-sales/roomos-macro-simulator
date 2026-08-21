import { createAppState } from "../../modules/app/createAppState.ts";
import type { DeviceState } from "../../modules/types.ts";
import { readStoredThemePreference } from "./themePreference.ts";
import type { SimulatorAppState } from "./types.ts";

export function createInitialSimulatorAppState(device: DeviceState): SimulatorAppState {
  return {
    ...createAppState({ device }),
    themePreference: readStoredThemePreference(),
  };
}
