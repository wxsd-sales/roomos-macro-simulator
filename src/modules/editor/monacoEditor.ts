import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/edcore.main";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";
import "monaco-editor/min/vs/editor/editor.main.css";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

export interface MonacoEditorInstance {
  getValue(): string;
  setValue(value: string): void;
  updateOptions(options: Record<string, unknown>): void;
  layout(): void;
  onDidChangeModelContent(listener: () => void): void;
  onDidBlurEditorText(listener: () => void): void;
}

interface InitializeMonacoEditorOptions {
  container: HTMLElement;
  onChange: () => void;
  onBlur: () => void;
  theme?: string;
}

export const monacoApi = monaco;

window.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (label === "typescript" || label === "javascript") {
      return new TypeScriptWorker();
    }

    return new EditorWorker();
  },
};

function createEditor(container: HTMLElement, onChange: () => void, theme: string): MonacoEditorInstance {
  const editor = monaco.editor.create(container, {
    value: "",
    language: "javascript",
    automaticLayout: true,
    minimap: { enabled: false },
    roundedSelection: false,
    scrollBeyondLastLine: false,
    fontFamily: 'Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: 14,
    lineHeight: 24,
    tabSize: 2,
    insertSpaces: true,
    theme,
  });

  editor.onDidChangeModelContent(onChange);
  return editor as unknown as MonacoEditorInstance;
}

export function initializeMonacoEditor({
  container,
  onChange,
  onBlur,
  theme = "vs-dark",
}: InitializeMonacoEditorOptions): Promise<MonacoEditorInstance> {
  const editor = createEditor(container, onChange, theme);
  editor.onDidBlurEditorText(onBlur);
  return Promise.resolve(editor);
}
