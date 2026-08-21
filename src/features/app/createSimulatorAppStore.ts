import type { Dispatch } from "react";
import { appReducer } from "./appReducer.ts";
import { createInitialSimulatorAppState } from "./createInitialAppState.ts";
import { initialDeviceState } from "./simulatorDevice.ts";
import type { AppStoreBridge } from "./appStoreBridge.ts";
import type { AppAction } from "./types.ts";

export function createSimulatorAppStore(): AppStoreBridge {
  let state = createInitialSimulatorAppState(initialDeviceState);
  const listeners = new Set<() => void>();

  const dispatch: Dispatch<AppAction> = (action) => {
    state = appReducer(state, action);
    listeners.forEach((listener) => {
      listener();
    });
  };

  return {
    getState: () => state,
    dispatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
