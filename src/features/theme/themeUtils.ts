import type { ThemePreference } from "../app/themePreference.ts";

export type ResolvedTheme = "light" | "dark";

export const MOMENTUM_THEME_CLASS_BY_THEME: Record<ResolvedTheme, string> = {
  light: "mds-theme-stable-lightWebex",
  dark: "mds-theme-stable-darkWebex",
};

export const THEME_ICON_CLASS_BY_PREFERENCE: Record<ThemePreference, string> = {
  system: "icon-laptop-regular",
  light: "icon-brightness-high-filled",
  dark: "icon-quiet-hours-presence-filled",
};

export function formatThemePreference(preference: ThemePreference): string {
  switch (preference) {
    case "system":
      return "System";
    case "light":
      return "Light";
    case "dark":
      return "Dark";
  }
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveThemePreference(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

export function getMonacoThemeName(preference: ThemePreference): string {
  return resolveThemePreference(preference) === "dark" ? "vs-dark" : "vs";
}
