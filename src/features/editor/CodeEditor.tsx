import { useEffect, useRef, useState } from "react";
import type { MonacoEditorInstance } from "../../modules/editor/monacoEditor.ts";
import { useAppStore } from "../app/AppProvider.tsx";
import { getMonacoThemeName } from "../theme/themeUtils.ts";
import {
  registerMonacoHost,
  registerXapiSchemaReady,
  updateXapiSchemaBundle,
} from "../../legacy/monacoHost.ts";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function CodeEditor() {
  const { state, dispatch } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const isApplyingEditorState = useRef(false);
  const activeEditorFileId = useRef<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  const activeFile = state.files.find((file) => file.id === state.activeFileId) ?? null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let disposed = false;

    void (async () => {
      try {
        const [{ initializeMonacoEditor, monacoApi }, { installXapiIntellisense }] = await Promise.all([
          import("../../modules/editor/monacoEditor.ts"),
          import("../../modules/editor/xapiIntellisense.ts"),
        ]);

        if (disposed) {
          return;
        }

        const editor = await initializeMonacoEditor({
          container,
          theme: getMonacoThemeName(state.themePreference),
          onChange: () => {
            if (isApplyingEditorState.current) {
              return;
            }

            const currentFile = editorRef.current ? activeEditorFileId.current : null;
            if (!currentFile || !editorRef.current) {
              return;
            }

            dispatch({
              type: "UPDATE_FILE",
              fileId: currentFile,
              patch: { content: editorRef.current.getValue() },
            });
          },
          onBlur: () => {},
        });

        if (disposed) {
          return;
        }

        editorRef.current = editor;
        registerMonacoHost(editor, monacoApi);

        const schemaReady = installXapiIntellisense({
          monaco: monacoApi,
          onSchemaRefresh: updateXapiSchemaBundle,
          addLog: (message, level = "info") => {
            dispatch({
              type: "ADD_LOG",
              log: {
                id: crypto.randomUUID(),
                level: level === "success" || level === "error" || level === "warn" ? level : "info",
                message,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
              },
            });
          },
        });
        registerXapiSchemaReady(schemaReady.catch((error: unknown) => {
          dispatch({
            type: "ADD_LOG",
            log: {
              id: crypto.randomUUID(),
              level: "error",
              message: `Failed to load xapi schema: ${getErrorMessage(error)}`,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
            },
          });
          return null;
        }));
        setEditorReady(true);
      } catch (error) {
        dispatch({
          type: "ADD_LOG",
          log: {
            id: crypto.randomUUID(),
            level: "error",
            message: `Failed to initialize Monaco Editor: ${getErrorMessage(error)}`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
        });
      }
    })();

    return () => {
      disposed = true;
    };
  }, [dispatch]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !editorReady) {
      return;
    }

    const nextEditorFileId = activeFile?.id ?? null;
    const nextEditorValue = activeFile?.content ?? "";
    const shouldSyncEditorValue =
      activeEditorFileId.current !== nextEditorFileId ||
      editor.getValue() !== nextEditorValue;

    isApplyingEditorState.current = true;
    editor.updateOptions({ readOnly: !activeFile });
    if (shouldSyncEditorValue) {
      editor.setValue(nextEditorValue);
    }
    isApplyingEditorState.current = false;
    activeEditorFileId.current = nextEditorFileId;

    requestAnimationFrame(() => {
      editor.layout();
    });
  }, [activeFile, editorReady]);

  return (
    <div
      id="code-editor"
      ref={containerRef}
      className="code-editor"
      aria-label="Macro code editor"
    />
  );
}
