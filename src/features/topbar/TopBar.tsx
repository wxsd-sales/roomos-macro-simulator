import { Icon } from "../../components/Icon.tsx";
import { useAppStore } from "../app/AppProvider.tsx";
import { getLegacyActions } from "../../legacy/legacyActions.ts";
import { ProductSelect } from "./ProductSelect.tsx";
import { ThemeSelect } from "../theme/ThemeSelect.tsx";

export function TopBar() {
  const { state, dispatch } = useAppStore();

  return (
    <header className="topbar">
      <button
        id="macro-sidebar-toggle-button"
        className="topbar-menu-button"
        type="button"
        aria-label="Toggle macros panel"
        aria-controls="files-panel"
        aria-pressed={state.macroSidebarVisible}
        title={state.macroSidebarVisible ? "Hide macros panel" : "Show macros panel"}
        onClick={() => {
          dispatch({ type: "TOGGLE_MACRO_SIDEBAR" });
          getLegacyActions().syncLegacyLayout();
        }}
      >
        <Icon name="icon-list-menu-regular" />
      </button>
      <div className="topbar-title">
        <h1>RoomOS Macro Simulator</h1>
      </div>
      <div className="topbar-actions">
        <ThemeSelect />
        <button
          id="load-sample-button"
          className="ghost-button"
          type="button"
          onClick={() => getLegacyActions().loadSampleMacro()}
        >
          Load Sample Macro
        </button>
        <button
          id="run-button"
          className="primary-button"
          type="button"
          onClick={() => {
            void getLegacyActions().runMacros();
          }}
        >
          Run Enabled Macros
        </button>
        <button
          id="reset-button"
          className="panel-action"
          type="button"
          onClick={() => getLegacyActions().resetSimulator()}
        >
          Reset Device State
        </button>
        <ProductSelect />
      </div>
    </header>
  );
}
