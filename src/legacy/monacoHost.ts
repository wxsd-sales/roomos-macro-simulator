import type { MonacoEditorInstance, monacoApi as MonacoApiType } from "../modules/editor/monacoEditor.ts";
import type { XapiSchemaBundle } from "../modules/xapi/schema.ts";

type MonacoApi = typeof MonacoApiType;

let monacoEditor: MonacoEditorInstance | null = null;
let loadedMonacoApi: MonacoApi | null = null;
let xapiSchemaBundle: XapiSchemaBundle | null = null;
let xapiSchemaReady: Promise<XapiSchemaBundle | null> | null = null;

export function registerMonacoHost(editor: MonacoEditorInstance, monacoApi: MonacoApi): void {
  monacoEditor = editor;
  loadedMonacoApi = monacoApi;
}

type XapiSchemaListener = (schemaBundle: XapiSchemaBundle) => void;

const schemaListeners = new Set<XapiSchemaListener>();

function publishXapiSchema(schemaBundle: XapiSchemaBundle | null): void {
  xapiSchemaBundle = schemaBundle;
  if (schemaBundle) {
    schemaListeners.forEach((listener) => listener(schemaBundle));
  }
}

/**
 * Subscribes to the schema becoming available, including a schema that arrived
 * before this call. Lets the device host seed configuration defaults without
 * racing the editor, which is what registers the schema in the first place.
 */
export function onXapiSchemaReady(listener: XapiSchemaListener): () => void {
  schemaListeners.add(listener);
  if (xapiSchemaBundle) {
    listener(xapiSchemaBundle);
  }
  return () => schemaListeners.delete(listener);
}

export function registerXapiSchemaReady(ready: Promise<XapiSchemaBundle | null>): void {
  xapiSchemaReady = ready.then((schemaBundle) => {
    publishXapiSchema(schemaBundle);
    return schemaBundle;
  });
}

/** Adopts a newer schema fetched in the background so macro runs validate against it. */
export function updateXapiSchemaBundle(schemaBundle: XapiSchemaBundle): void {
  publishXapiSchema(schemaBundle);
  xapiSchemaReady = Promise.resolve(schemaBundle);
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
