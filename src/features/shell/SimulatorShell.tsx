import { useAppStore } from "../app/AppProvider.tsx";
import { DeviceSimulator } from "../device/DeviceSimulator.tsx";
import { CodeEditor } from "../editor/CodeEditor.tsx";
import { RuntimeConsole } from "../console/RuntimeConsole.tsx";
import { MacroFilesPanel } from "../files/MacroFilesPanel.tsx";
import { HelpOverlay } from "../help/HelpOverlay.tsx";
import { useAppKeyboardShortcuts } from "../keyboard/useAppKeyboardShortcuts.ts";
import { useDesktopLayout } from "../layout/useDesktopLayout.ts";
import { usePanelLayout } from "../layout/usePanelLayout.ts";
import { TopBar } from "../topbar/TopBar.tsx";
import { useThemeEffect } from "../theme/useThemeEffect.ts";

function panelClassName(baseClass: string, hidden: boolean): string {
  return hidden ? `${baseClass} hidden-panel` : baseClass;
}

export function SimulatorShell() {
  const { state } = useAppStore();
  const isDesktop = useDesktopLayout();

  useThemeEffect();
  useAppKeyboardShortcuts();
  usePanelLayout();

  return (
    <>
      <div className="app-shell">
        <TopBar />
        <main
          id="workspace"
          className={state.macroSidebarVisible ? "workspace" : "workspace macro-sidebar-hidden"}
        >
          <MacroFilesPanel hidden={!state.macroSidebarVisible} />

          <div
            id="files-editor-resizer"
            className={panelClassName("panel-resizer panel-resizer-horizontal", !state.macroSidebarVisible || !isDesktop)}
            role="separator"
            aria-label="Resize macros and editor panels"
            aria-orientation="vertical"
          />

          <section id="editor-panel" className="panel editor-panel">
            <div className="panel-header slim">
              <div>
                <p className="panel-kicker">Macro Editor</p>
              </div>
            </div>
            <div id="editor-surface" className="editor-surface">
              <CodeEditor />
            </div>
            <div
              id="editor-console-resizer"
              className={panelClassName("panel-resizer panel-resizer-vertical", !state.logVisible)}
              role="separator"
              aria-label="Resize editor and runtime log"
              aria-orientation="horizontal"
            />
            <RuntimeConsole hidden={!state.logVisible} />
          </section>

          <div
            id="editor-simulator-resizer"
            className="panel-resizer panel-resizer-horizontal"
            role="separator"
            aria-label="Resize editor and simulator panels"
            aria-orientation="vertical"
          />

          <section id="simulator-panel" className="panel simulator-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Simulator</p>
              </div>
            </div>
            <DeviceSimulator />
          </section>
        </main>
      </div>
      <HelpOverlay />
    </>
  );
}
