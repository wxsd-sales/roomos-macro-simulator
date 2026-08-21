import { useEffect, useMemo, useRef } from "react";
import { Icon } from "../../components/Icon.tsx";
import { useAppStore } from "../app/AppProvider.tsx";
import type { LogSeverityLevel } from "../../modules/types.ts";
import {
  formatLogSeverity,
  LOG_SEVERITY_LEVELS,
  normalizeLogSeverity,
  parseLogMessageParts,
} from "./logUtils.ts";

const SEVERITY_LABELS: Record<LogSeverityLevel, string> = {
  error: "Error",
  warn: "Warn",
  info: "Info",
  log: "Log",
  debug: "Debug",
};

export function RuntimeConsole({ hidden = false }: { hidden?: boolean }) {
  const { state, dispatch } = useAppStore();
  const severityShellRef = useRef<HTMLDivElement>(null);

  const visibleLogs = useMemo(() => {
    const filterText = state.logFilterText.trim().toLowerCase();

    return state.logs.filter((log) => {
      const severity = normalizeLogSeverity(log.level);
      if (!state.logSeverityLevels.has(severity)) {
        return false;
      }

      if (!filterText) {
        return true;
      }

      const haystack = `${log.timestamp} ${formatLogSeverity(log.level)} ${log.message}`.toLowerCase();
      return haystack.includes(filterText);
    });
  }, [state.logFilterText, state.logSeverityLevels, state.logs]);

  useEffect(() => {
    if (!state.logSeverityMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!severityShellRef.current?.contains(event.target as Node)) {
        dispatch({ type: "SET_LOG_SEVERITY_MENU_OPEN", open: false });
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [dispatch, state.logSeverityMenuOpen]);

  return (
    <section
      id="runtime-console"
      className={hidden ? "runtime-console hidden-panel" : "runtime-console"}
    >
      <div className="console-header">
        <div className="log-toolbar">
          <div className="log-filter-group">
            <div className="severity-menu-shell" ref={severityShellRef}>
              <button
                id="log-severity-button"
                className="log-toolbar-button"
                type="button"
                aria-haspopup="menu"
                aria-expanded={state.logSeverityMenuOpen}
                onClick={() => dispatch({ type: "TOGGLE_LOG_SEVERITY_MENU" })}
              >
                Severity
                <Icon name="icon-arrow-triangle-down-filled" />
              </button>
              {state.logSeverityMenuOpen ? (
                <div id="log-severity-menu" className="severity-menu" role="menu">
                  <button
                    type="button"
                    className="severity-menu-item reset"
                    data-log-level-reset="true"
                    role="menuitem"
                    onClick={() => {
                      dispatch({ type: "RESET_LOG_SEVERITY_FILTERS" });
                      dispatch({ type: "SET_LOG_SEVERITY_MENU_OPEN", open: false });
                    }}
                  >
                    Default
                  </button>
                  <div className="severity-menu-divider" />
                  {LOG_SEVERITY_LEVELS.map((level) => {
                    const checked = state.logSeverityLevels.has(level);
                    return (
                      <button
                        key={level}
                        type="button"
                        className={`severity-menu-item${checked ? " selected" : ""}`}
                        data-log-level={level}
                        role="menuitemcheckbox"
                        aria-checked={checked}
                        onClick={() => dispatch({ type: "TOGGLE_LOG_SEVERITY_LEVEL", level })}
                      >
                        <span>{SEVERITY_LABELS[level]}</span>
                        <Icon name="icon-check-regular" />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <label className="log-filter-input-shell" htmlFor="log-filter-input">
              <span className="sr-only">Filter log output</span>
              <input
                id="log-filter-input"
                className="log-filter-input"
                type="text"
                placeholder="Enter filter"
                autoComplete="off"
                value={state.logFilterText}
                onChange={(event) => dispatch({ type: "SET_LOG_FILTER", text: event.target.value })}
              />
            </label>
          </div>
        </div>
      </div>
      <div id="log-output" className="log-output">
        {visibleLogs.length === 0 ? (
          <div className="log-empty-state">
            {state.logs.length
              ? "No log entries match the current filters."
              : "Macro activity will appear here."}
          </div>
        ) : (
          visibleLogs.map((log) => {
            const parts = parseLogMessageParts(log.message);
            const severity = normalizeLogSeverity(log.level);
            return (
              <div
                key={log.id}
                className={`log-line ${severity}${log.level === "success" ? " success" : ""}`}
              >
                <span className="log-time">{log.timestamp}</span>
                <span className="log-source">{parts.source}</span>
                <span className="log-chevron" aria-hidden="true">&#8250;</span>
                <span className="log-severity">[{formatLogSeverity(log.level).toLowerCase()}]</span>
                <span className="log-message">{parts.body}</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
