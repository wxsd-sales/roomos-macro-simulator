import type { Dispatch } from "react";
import type { AppAction, SimulatorAppState } from "./types.ts";

export interface AppStoreBridge {
  getState(): SimulatorAppState;
  dispatch: Dispatch<AppAction>;
  subscribe(listener: () => void): () => void;
}
