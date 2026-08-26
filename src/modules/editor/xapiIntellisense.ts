import { loadXapiSchema } from "../xapi/schemaLoader.ts";
import type { XapiSchemaBundle } from "../xapi/schema.ts";
import { buildXapiDeclarations } from "./xapiDeclarations.ts";

/**
 * Registered as a plain global script rather than under `@types/xapi`, so the
 * ambient `xapi` binding is visible to macros that omit the `import xapi from
 * 'xapi'` line.
 */
const XAPI_LIB_PATH = "file:///xapi-globals.d.ts";

type AddLog = (message: string, level?: string) => void;

interface MonacoDisposable {
  dispose(): void;
}

interface MonacoJavaScriptDefaults {
  setCompilerOptions(options: Record<string, unknown>): void;
  setEagerModelSync(enabled: boolean): void;
  addExtraLib(content: string, filePath?: string): MonacoDisposable;
}

interface MonacoTypeScriptLanguage {
  javascriptDefaults: MonacoJavaScriptDefaults;
  ModuleResolutionKind: { NodeJs: unknown };
  ScriptTarget: { ES2020: unknown };
}

export interface MonacoIntellisenseApi {
  languages: {
    typescript: MonacoTypeScriptLanguage;
  };
}

interface InstallXapiIntellisenseOptions {
  monaco: MonacoIntellisenseApi;
  addLog: AddLog;
  /** Called when a newer schema arrives, so the runtime can validate against it too. */
  onSchemaRefresh?: (bundle: XapiSchemaBundle) => void;
}

function configureJavaScriptDefaults(monaco: MonacoIntellisenseApi): void {
  const defaults = monaco.languages.typescript.javascriptDefaults;
  defaults.setCompilerOptions({
    allowNonTsExtensions: true,
    checkJs: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowSyntheticDefaultImports: true,
    noLib: false,
  });
  defaults.setEagerModelSync(true);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function installXapiIntellisense({
  monaco,
  addLog,
  onSchemaRefresh,
}: InstallXapiIntellisenseOptions): Promise<XapiSchemaBundle> {
  configureJavaScriptDefaults(monaco);

  let registration: MonacoDisposable | null = null;

  function registerDeclarations(bundle: XapiSchemaBundle): void {
    registration?.dispose();
    registration = monaco.languages.typescript.javascriptDefaults.addExtraLib(
      buildXapiDeclarations(bundle.roots, bundle.schemaName),
      XAPI_LIB_PATH,
    );
  }

  const bundle = await loadXapiSchema({
    onRefresh: (refreshed) => {
      registerDeclarations(refreshed);
      onSchemaRefresh?.(refreshed);
      addLog(`Updated xapi IntelliSense schema: ${refreshed.schemaName}`, "success");
    },
    onError: (error) => {
      addLog(`Could not refresh the xapi schema from Cisco: ${getErrorMessage(error)}`, "warn");
    },
  });

  registerDeclarations(bundle);
  addLog(`Loaded xapi IntelliSense schema: ${bundle.schemaName}`, "success");

  return bundle;
}
