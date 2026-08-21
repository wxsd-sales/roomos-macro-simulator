import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
} from "react";
import type { AppStoreBridge } from "./appStoreBridge.ts";
import type { AppAction, SimulatorAppState } from "./types.ts";

interface AppStoreContextValue {
  state: SimulatorAppState;
  dispatch: Dispatch<AppAction>;
  store: AppStoreBridge;
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null);

export function AppProvider({
  children,
  store,
}: {
  children: ReactNode;
  store: AppStoreBridge;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  const value = useMemo(
    () => ({ state, dispatch: store.dispatch, store }),
    [state, store],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreContextValue {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore must be used within AppProvider.");
  }
  return context;
}
