import { useAppStore } from "../app/AppProvider.tsx";
import { HELP_SHORTCUTS } from "./helpShortcuts.ts";

export function HelpOverlay() {
  const { state, dispatch } = useAppStore();

  if (!state.helpVisible) {
    return null;
  }

  return (
    <div className="help-overlay" aria-hidden="false">
      <div
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <div className="help-header">
          <div>
            <p className="panel-kicker">Keyboard Shortcuts</p>
            <h2 id="help-title">Macro Editor Shortcuts</h2>
          </div>
          <button
            className="panel-action"
            type="button"
            onClick={() => dispatch({ type: "SET_HELP_VISIBLE", visible: false })}
          >
            Close
          </button>
        </div>
        <div className="help-grid">
          {HELP_SHORTCUTS.map((shortcut) => (
            <div className="help-row" key={shortcut.keys}>
              <span>{shortcut.keys}</span>
              <span>{shortcut.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
