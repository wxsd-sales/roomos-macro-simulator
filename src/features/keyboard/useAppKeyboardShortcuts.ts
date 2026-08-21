import { useEffect } from "react";
import { useAppStore } from "../app/AppProvider.tsx";
import { getLegacyActions } from "../../legacy/legacyActions.ts";

export function useAppKeyboardShortcuts(): void {
  const { state, dispatch } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const metaKeyPressed = event.metaKey || event.ctrlKey;
      if (!metaKeyPressed) {
        if (event.key === "Escape" && state.helpVisible) {
          dispatch({ type: "SET_HELP_VISIBLE", visible: false });
        }
        return;
      }

      const key = event.key.toLowerCase();
      const actions = getLegacyActions();

      if ((key === "s" && !event.shiftKey) || (key === "enter" && !event.shiftKey)) {
        event.preventDefault();
        actions.saveActiveFileToDeviceAndRestart();
        return;
      }

      if (key === "e" && !event.shiftKey) {
        event.preventDefault();
        actions.exportActiveFile();
        return;
      }

      if (key === "o" && !event.shiftKey) {
        event.preventDefault();
        actions.openFromFile();
        return;
      }

      if (event.shiftKey && key === "n") {
        event.preventDefault();
        actions.createNewFile();
        return;
      }

      if (event.shiftKey && key === "h") {
        event.preventDefault();
        dispatch({ type: "TOGGLE_HELP" });
        return;
      }

      if (event.shiftKey && key === "g") {
        event.preventDefault();
        dispatch({ type: "TOGGLE_LOG" });
        actions.syncLegacyLayout();
        return;
      }

      if (event.shiftKey && key === "m") {
        event.preventDefault();
        dispatch({ type: "TOGGLE_MACRO_SIDEBAR" });
        actions.syncLegacyLayout();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, state.helpVisible]);
}
