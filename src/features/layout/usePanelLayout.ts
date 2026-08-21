import { useEffect, useRef } from "react";
import { useAppStore } from "../app/AppProvider.tsx";
import { layoutMonacoEditor } from "../../legacy/monacoHost.ts";
import { registerLayoutSync } from "../../legacy/layoutHost.ts";
import { useDesktopLayout } from "./useDesktopLayout.ts";
import {
  clamp,
  HORIZONTAL_RESIZER_SIZE,
  PANEL_DEFAULT_HEIGHTS,
  PANEL_DEFAULT_WIDTHS,
  PANEL_MAX_WIDTHS,
  PANEL_MIN_HEIGHTS,
  PANEL_MIN_WIDTHS,
  VERTICAL_RESIZER_SIZE,
} from "./panelLayout.ts";

interface PointerResizeOptions {
  axis: "x" | "y";
  element: HTMLElement;
  onMove(delta: number): void;
}

function startPointerResize(event: PointerEvent, { axis, element, onMove }: PointerResizeOptions): () => void {
  if (event.button !== 0) {
    return () => {};
  }

  event.preventDefault();
  document.body.classList.add("is-resizing");
  element.classList.add("dragging");

  const moveHandler = (moveEvent: PointerEvent) => {
    const delta = axis === "x" ? moveEvent.clientX - event.clientX : moveEvent.clientY - event.clientY;
    onMove(delta);
  };

  const cleanup = () => {
    document.body.classList.remove("is-resizing");
    element.classList.remove("dragging");
    window.removeEventListener("pointermove", moveHandler);
    window.removeEventListener("pointerup", cleanup);
    window.removeEventListener("pointercancel", cleanup);
  };

  window.addEventListener("pointermove", moveHandler);
  window.addEventListener("pointerup", cleanup);
  window.addEventListener("pointercancel", cleanup);
  return cleanup;
}

export function usePanelLayout(): void {
  const { state } = useAppStore();
  const isDesktop = useDesktopLayout();
  const layoutState = useRef({
    filesWidth: PANEL_DEFAULT_WIDTHS.files,
    simulatorWidth: PANEL_DEFAULT_WIDTHS.simulator,
    runtimeHeight: PANEL_DEFAULT_HEIGHTS.runtime,
  });
  const activeResizeCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    const workspace = document.getElementById("workspace");
    const filesEditorResizer = document.getElementById("files-editor-resizer");
    const editorSimulatorResizer = document.getElementById("editor-simulator-resizer");
    const editorConsoleResizer = document.getElementById("editor-console-resizer");
    const editorPanel = document.getElementById("editor-panel");
    const editorSurface = document.getElementById("editor-surface");
    const runtimeConsole = document.getElementById("runtime-console");

    if (
      !workspace ||
      !filesEditorResizer ||
      !editorSimulatorResizer ||
      !editorConsoleResizer ||
      !editorPanel ||
      !editorSurface ||
      !runtimeConsole
    ) {
      return;
    }

    const getWorkspaceAvailableWidth = () => {
      const activeResizers = state.macroSidebarVisible ? 2 : 1;
      return Math.max(0, workspace.clientWidth - activeResizers * HORIZONTAL_RESIZER_SIZE);
    };

    const getEditorPanelAvailableHeight = () => {
      const header = editorPanel.querySelector<HTMLElement>(".panel-header");
      const headerHeight = header?.offsetHeight ?? 0;
      return Math.max(0, editorPanel.clientHeight - headerHeight);
    };

    const getClampedHorizontalWidths = () => {
      const availableWidth = getWorkspaceAvailableWidth();
      if (!state.macroSidebarVisible) {
        const maxSimulatorWidth = Math.max(PANEL_MIN_WIDTHS.simulator, availableWidth - PANEL_MIN_WIDTHS.editor);
        const simulatorWidth = clamp(
          layoutState.current.simulatorWidth,
          PANEL_MIN_WIDTHS.simulator,
          maxSimulatorWidth,
        );
        return {
          filesWidth: 0,
          simulatorWidth,
          editorWidth: Math.max(PANEL_MIN_WIDTHS.editor, availableWidth - simulatorWidth),
        };
      }

      const filesMax = Math.max(
        PANEL_MIN_WIDTHS.files,
        Math.min(
          PANEL_MAX_WIDTHS.files,
          availableWidth - PANEL_MIN_WIDTHS.editor - PANEL_MIN_WIDTHS.simulator,
        ),
      );
      const filesWidth = clamp(layoutState.current.filesWidth, PANEL_MIN_WIDTHS.files, filesMax);
      const simulatorMax = Math.max(
        PANEL_MIN_WIDTHS.simulator,
        availableWidth - filesWidth - PANEL_MIN_WIDTHS.editor,
      );
      const simulatorWidth = clamp(layoutState.current.simulatorWidth, PANEL_MIN_WIDTHS.simulator, simulatorMax);
      const editorWidth = availableWidth - filesWidth - simulatorWidth;

      return { filesWidth, simulatorWidth, editorWidth };
    };

    const getClampedRuntimeHeight = () => {
      if (!state.logVisible) {
        return 0;
      }

      const availableHeight = getEditorPanelAvailableHeight();
      const maxRuntimeHeight = Math.max(
        PANEL_MIN_HEIGHTS.runtime,
        availableHeight - VERTICAL_RESIZER_SIZE - PANEL_MIN_HEIGHTS.editor,
      );

      return clamp(layoutState.current.runtimeHeight, PANEL_MIN_HEIGHTS.runtime, maxRuntimeHeight);
    };

    const applyWorkspaceLayout = () => {
      if (!isDesktop) {
        workspace.style.gridTemplateColumns = "";
        filesEditorResizer.classList.add("hidden-panel");
        editorSimulatorResizer.classList.add("hidden-panel");
        filesEditorResizer.style.display = "none";
        editorSimulatorResizer.style.display = "none";
        workspace.classList.toggle("macro-sidebar-hidden", !state.macroSidebarVisible);
        return;
      }

      const { filesWidth, simulatorWidth, editorWidth } = getClampedHorizontalWidths();
      layoutState.current.filesWidth = filesWidth || layoutState.current.filesWidth;
      layoutState.current.simulatorWidth = simulatorWidth;

      filesEditorResizer.classList.toggle("hidden-panel", !state.macroSidebarVisible);
      editorSimulatorResizer.classList.remove("hidden-panel");
      filesEditorResizer.style.display = state.macroSidebarVisible ? "" : "none";
      editorSimulatorResizer.style.display = "";

      if (state.macroSidebarVisible) {
        workspace.style.gridTemplateColumns = `${filesWidth}px ${HORIZONTAL_RESIZER_SIZE}px ${editorWidth}px ${HORIZONTAL_RESIZER_SIZE}px ${simulatorWidth}px`;
      } else {
        workspace.style.gridTemplateColumns = `${editorWidth}px ${HORIZONTAL_RESIZER_SIZE}px ${simulatorWidth}px`;
      }
    };

    const applyEditorLayout = () => {
      if (!state.logVisible) {
        editorSurface.style.height = "";
        editorSurface.style.flex = "1 1 auto";
        runtimeConsole.style.height = "";
        layoutMonacoEditor();
        return;
      }

      const availableHeight = getEditorPanelAvailableHeight();
      const runtimeHeight = getClampedRuntimeHeight();
      const editorHeight = Math.max(
        PANEL_MIN_HEIGHTS.editor,
        availableHeight - VERTICAL_RESIZER_SIZE - runtimeHeight,
      );

      layoutState.current.runtimeHeight = runtimeHeight;
      editorSurface.style.flex = "0 0 auto";
      editorSurface.style.height = `${editorHeight}px`;
      runtimeConsole.style.height = `${runtimeHeight}px`;
      layoutMonacoEditor();
    };

    const updateLayout = () => {
      applyWorkspaceLayout();
      applyEditorLayout();
    };

    registerLayoutSync(updateLayout);
    updateLayout();

    const onFilesEditorResize = (event: PointerEvent) => {
      if (!isDesktop || !state.macroSidebarVisible) {
        return;
      }

      const startFilesWidth = getClampedHorizontalWidths().filesWidth;
      activeResizeCleanup.current?.();
      activeResizeCleanup.current = startPointerResize(event, {
        axis: "x",
        element: filesEditorResizer,
        onMove: (delta) => {
          layoutState.current.filesWidth = startFilesWidth + delta;
          applyWorkspaceLayout();
        },
      });
    };

    const onEditorSimulatorResize = (event: PointerEvent) => {
      if (!isDesktop) {
        return;
      }

      const startSimulatorWidth = getClampedHorizontalWidths().simulatorWidth;
      activeResizeCleanup.current?.();
      activeResizeCleanup.current = startPointerResize(event, {
        axis: "x",
        element: editorSimulatorResizer,
        onMove: (delta) => {
          layoutState.current.simulatorWidth = startSimulatorWidth - delta;
          applyWorkspaceLayout();
        },
      });
    };

    const onEditorConsoleResize = (event: PointerEvent) => {
      if (!state.logVisible) {
        return;
      }

      const startRuntimeHeight = getClampedRuntimeHeight();
      activeResizeCleanup.current?.();
      activeResizeCleanup.current = startPointerResize(event, {
        axis: "y",
        element: editorConsoleResizer,
        onMove: (delta) => {
          layoutState.current.runtimeHeight = startRuntimeHeight - delta;
          applyEditorLayout();
        },
      });
    };

    filesEditorResizer.addEventListener("pointerdown", onFilesEditorResize);
    editorSimulatorResizer.addEventListener("pointerdown", onEditorSimulatorResize);
    editorConsoleResizer.addEventListener("pointerdown", onEditorConsoleResize);
    window.addEventListener("resize", updateLayout);

    return () => {
      activeResizeCleanup.current?.();
      filesEditorResizer.removeEventListener("pointerdown", onFilesEditorResize);
      editorSimulatorResizer.removeEventListener("pointerdown", onEditorSimulatorResize);
      editorConsoleResizer.removeEventListener("pointerdown", onEditorConsoleResize);
      window.removeEventListener("resize", updateLayout);
    };
  }, [isDesktop, state.logVisible, state.macroSidebarVisible]);
}
