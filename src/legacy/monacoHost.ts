import type { MonacoEditorInstance, monacoApi as MonacoApiType } from "../modules/editor/monacoEditor.ts";

type MonacoApi = typeof MonacoApiType;
type XapiSchemaBundle = Awaited<
  ReturnType<typeof import("../modules/editor/xapiIntellisense.ts")["installXapiIntellisense"]>
>;

let monacoEditor: MonacoEditorInstance | null = null;
let loadedMonacoApi: MonacoApi | null = null;
let xapiSchemaBundle: XapiSchemaBundle | null = null;
let xapiSchemaReady: Promise<XapiSchemaBundle | null> | null = null;

export function registerMonacoHost(editor: MonacoEditorInstance, monacoApi: MonacoApi): void {
  monacoEditor = editor;
  loadedMonacoApi = monacoApi;
}

export function registerXapiSchemaReady(ready: Promise<XapiSchemaBundle | null>): void {
  xapiSchemaReady = ready.then((schemaBundle) => {
    xapiSchemaBundle = schemaBundle;
    return schemaBundle;
  });
}

export async function waitForXapiSchema(): Promise<XapiSchemaBundle | null> {
  if (xapiSchemaReady) {
    return xapiSchemaReady;
  }
  return xapiSchemaBundle;
}

export function layoutMonacoEditor(): void {
  requestAnimationFrame(() => {
    monacoEditor?.layout();
  });
}

export function applyMonacoTheme(themeName: string): void {
  loadedMonacoApi?.editor.setTheme(themeName);
}
