import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon.tsx";
import { useAppStore } from "../app/AppProvider.tsx";
import { persistThemePreference, type ThemePreference } from "../app/themePreference.ts";
import {
  formatThemePreference,
  resolveThemePreference,
  THEME_ICON_CLASS_BY_PREFERENCE,
} from "./themeUtils.ts";

const THEME_OPTIONS: Array<{ preference: ThemePreference; label: string; icon: string }> = [
  { preference: "system", label: "System", icon: "icon-laptop-regular" },
  { preference: "light", label: "Light", icon: "icon-brightness-high-filled" },
  { preference: "dark", label: "Dark", icon: "icon-quiet-hours-presence-filled" },
];

export function ThemeSelect() {
  const { state, dispatch } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const themePreference = state.themePreference;
  const resolvedTheme = resolveThemePreference(themePreference);
  const preferenceLabel = formatThemePreference(themePreference);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const chooseTheme = (preference: ThemePreference) => {
    dispatch({ type: "SET_THEME_PREFERENCE", preference });
    persistThemePreference(preference);
    setMenuOpen(false);
  };

  return (
    <div id="theme-select-shell" className="theme-select-shell" ref={shellRef}>
      <button
        id="theme-select-button"
        ref={buttonRef}
        className="theme-select-button"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-label={`Theme: ${preferenceLabel}. Active theme: ${resolvedTheme}. Open theme menu.`}
        title={`Theme: ${preferenceLabel}`}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span id="theme-select-current-icon" className="theme-select-current-icon" aria-hidden="true">
          <Icon name={THEME_ICON_CLASS_BY_PREFERENCE[themePreference]} />
        </span>
        <span id="theme-select-label">{preferenceLabel}</span>
        <Icon name="icon-arrow-triangle-down-filled" />
      </button>
      {!menuOpen ? null : (
        <div id="theme-select-menu" className="theme-select-menu" role="listbox">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.preference}
              className={`theme-select-option${option.preference === themePreference ? " selected" : ""}`}
              type="button"
              role="option"
              data-theme-choice={option.preference}
              aria-selected={option.preference === themePreference}
              onClick={() => chooseTheme(option.preference)}
            >
              <Icon name={option.icon} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
