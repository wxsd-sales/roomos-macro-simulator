import { useEffect } from "react";
import { useAppStore } from "../app/AppProvider.tsx";
import { getLegacyActions } from "../../legacy/legacyActions.ts";
import {
  MOMENTUM_THEME_CLASS_BY_THEME,
  resolveThemePreference,
} from "./themeUtils.ts";

export function useThemeEffect(): void {
  const { state } = useAppStore();

  useEffect(() => {
    const applyTheme = () => {
      const resolvedTheme = resolveThemePreference(state.themePreference);
      document.documentElement.classList.toggle(
        MOMENTUM_THEME_CLASS_BY_THEME.light,
        resolvedTheme === "light",
      );
      document.documentElement.classList.toggle(
        MOMENTUM_THEME_CLASS_BY_THEME.dark,
        resolvedTheme === "dark",
      );
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themePreference = state.themePreference;
      document.documentElement.style.colorScheme = resolvedTheme;

      try {
        getLegacyActions().applyMonacoTheme();
      } catch {
        // Monaco is initialized after the first legacy bootstrap pass.
      }
    };

    applyTheme();

    if (state.themePreference !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [state.themePreference]);
}
