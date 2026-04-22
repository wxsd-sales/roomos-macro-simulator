const monacoCdnBase = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min";

function createEditor(container, onChange) {
  const editor = window.monaco.editor.create(container, {
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
    theme: "vs-dark",
  });

  editor.onDidChangeModelContent(onChange);
  return editor;
}

export function initializeMonacoEditor({ container, onChange, onBlur }) {
  return new Promise((resolve, reject) => {
    const loader = window.require;
    if (!loader) {
      reject(new Error("Monaco loader is unavailable."));
      return;
    }

    loader.config({
      paths: {
        vs: `${monacoCdnBase}/vs`,
      },
    });

    window.MonacoEnvironment = {
      getWorkerUrl() {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = { baseUrl: "${monacoCdnBase}/" };
          importScripts("${monacoCdnBase}/vs/base/worker/workerMain.js");
        `)}`;
      },
    };

    loader(
      ["vs/editor/editor.main"],
      () => {
        const editor = createEditor(container, onChange);
        editor.onDidBlurEditorText(onBlur);
        resolve(editor);
      },
      (error) => {
        reject(new Error(`Monaco loader failed: ${String(error?.message ?? error?.type ?? error)}`));
      },
    );
  });
}
