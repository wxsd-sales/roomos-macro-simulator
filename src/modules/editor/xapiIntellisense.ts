import {
  collectBranchEntries,
  collectPayloadShape,
  findNodeByPath,
  isPlainObject,
  loadLatestXapiSchema,
  resolveSchemaRoots,
} from "../xapi/schema.ts";

type SchemaNode = Record<string, any>;
type SchemaEntry = [string, SchemaNode];
type XapiSchemaBundle = Awaited<ReturnType<typeof loadLatestXapiSchema>>;
type AddLog = (message: string, level?: string) => void;

interface MonacoJavaScriptDefaults {
  setCompilerOptions(options: Record<string, unknown>): void;
  setEagerModelSync(enabled: boolean): void;
  addExtraLib(content: string, filePath?: string): unknown;
}

interface MonacoTypeScriptLanguage {
  javascriptDefaults: MonacoJavaScriptDefaults;
  ModuleResolutionKind: {
    NodeJs: unknown;
  };
  ScriptTarget: {
    ES2020: unknown;
  };
}

interface MonacoIntellisenseApi {
  languages: {
    typescript: MonacoTypeScriptLanguage;
  };
}

interface InstallXapiIntellisenseOptions {
  monaco: MonacoIntellisenseApi;
  addLog: AddLog;
}

interface RoomosSchemaDebug {
  latestSchemaName: string;
  commandRoot: SchemaNode | null;
  statusRoot: SchemaNode | null;
  eventRoot: SchemaNode | null;
  audioVolumeSetNode: SchemaNode | null;
}

declare global {
  interface Window {
    __roomosSchemaDebug?: RoomosSchemaDebug;
  }
}

function safeIdentifier(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function buildArgsTypeName(path: string[]): string {
  const suffix = path.length ? path.join("") : "Root";
  return `${suffix}Args`;
}

function pickDescription(node: unknown): string {
  if (!isPlainObject(node)) {
    return "";
  }

  return (
    node.description ??
    node.documentation ??
    node.docs ??
    node.help ??
    node.summary ??
    node.overview ??
    ""
  );
}

function toJsDoc(text: unknown, indent = "  "): string {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    return "";
  }

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    return "";
  }

  return `${indent}/**\n${lines.map((line) => `${indent} * ${line}`).join("\n")}\n${indent} */\n`;
}

function renderSchemaValueType(node: SchemaNode | null | undefined): string {
  const valuespace = isPlainObject(node?.valuespace) ? node.valuespace : null;
  const declaredType = String(valuespace?.type ?? node?.type ?? "").trim();

  if (Array.isArray(valuespace?.Values) && valuespace.Values.length) {
    const literalType = [...new Set(valuespace.Values.map((value) => JSON.stringify(String(value))))].join(" | ");
    if (declaredType.endsWith("Array")) {
      return `(${literalType})[]`;
    }
    return literalType;
  }

  if (/^(integer|float|number)$/i.test(declaredType)) {
    return "number";
  }

  if (/^(integerarray|floatarray|numberarray)$/i.test(declaredType)) {
    return "number[]";
  }

  if (/^string$/i.test(declaredType)) {
    return "string";
  }

  if (/^stringarray$/i.test(declaredType)) {
    return "string[]";
  }

  if (/^boolean$/i.test(declaredType)) {
    return "boolean";
  }

  return "unknown";
}

function renderObjectType(entries: SchemaEntry[], fallback = "Record<string, unknown>"): string {
  if (!entries.length) {
    return fallback;
  }

  const lines = entries.map(([key, value]) => {
    const description = toJsDoc(pickDescription(value), "    ");
    const optionalMarker = value?.required === true ? "" : "?";
    return `${description}    ${safeIdentifier(key)}${optionalMarker}: ${renderSchemaValueType(value)};`;
  });
  return `{\n${lines.join("\n")}\n  }`;
}

function hasRequiredEntries(entries: SchemaEntry[]): boolean {
  return entries.some(([, value]) => value?.required === true);
}

function renderCommandMethodSignatures(
  name: string,
  node: SchemaNode,
  path: string[],
  declarations: string[],
): string {
  const payloadEntries = collectPayloadShape(node) as SchemaEntry[];
  const payloadTypeName = buildArgsTypeName(path);
  const description = toJsDoc(pickDescription(node), "    ");

  declarations.push(`  export interface ${payloadTypeName} ${renderObjectType(payloadEntries, "{}")}`);

  if (!payloadEntries.length) {
    return `${description}    ${safeIdentifier(name)}(): Promise<any>;`;
  }

  if (hasRequiredEntries(payloadEntries)) {
    return `${description}    ${safeIdentifier(name)}(args: ${payloadTypeName}): Promise<any>;`;
  }

  return `${description}    ${safeIdentifier(name)}(args?: ${payloadTypeName}): Promise<any>;`;
}

function createCommandBranchType(
  node: SchemaNode,
  path: string[] = [],
  declarations: string[] = [],
): string {
  const children = collectBranchEntries(node) as SchemaEntry[];
  const payloadEntries = collectPayloadShape(node) as SchemaEntry[];
  const payloadTypeName = buildArgsTypeName(path);

  declarations.push(`  export interface ${payloadTypeName} ${renderObjectType(payloadEntries, "{}")}`);

  if (!children.length) {
    return `XapiCommandNode<${payloadTypeName}>`;
  }

  const childLines: string[] = children.map(([key, value]): string => {
    const childChildren = collectBranchEntries(value) as SchemaEntry[];
    if (!childChildren.length) {
      return renderCommandMethodSignatures(key, value, [...path, key], declarations);
    }

    const description = toJsDoc(pickDescription(value), "    ");
    return `${description}    ${safeIdentifier(key)}: ${createCommandBranchType(value, [...path, key], declarations)};`;
  });

  return `XapiCommandNode<${payloadTypeName}> & {\n${childLines.join("\n")}\n  }`;
}

function createEventBranchType(
  node: SchemaNode,
  path: string[] = [],
  declarations: string[] = [],
): string {
  const children = collectBranchEntries(node) as SchemaEntry[];
  const payloadEntries = collectPayloadShape(node) as SchemaEntry[];
  const payloadTypeName = `${buildArgsTypeName(path)}Event`;

  declarations.push(`  export interface ${payloadTypeName} ${renderObjectType(payloadEntries, "{}")}`);

  if (!children.length) {
    return `XapiEventNode<${payloadTypeName}>`;
  }

  const childLines: string[] = children.map(([key, value]): string => {
    const description = toJsDoc(pickDescription(value), "    ");
    return `${description}    ${safeIdentifier(key)}: ${createEventBranchType(value, [...path, key], declarations)};`;
  });

  return `XapiEventNode<${payloadTypeName}> & {\n${childLines.join("\n")}\n  }`;
}

function createStatusBranchType(node: SchemaNode): string {
  const children = collectBranchEntries(node) as SchemaEntry[];

  if (!children.length) {
    return `XapiStatusNode<${renderSchemaValueType(node)}>`;
  }

  const childLines: string[] = children.map(([key, value]): string => {
    const description = toJsDoc(pickDescription(value), "    ");
    return `${description}    ${safeIdentifier(key)}: ${createStatusBranchType(value)};`;
  });

  return `XapiStatusNode<unknown> & {\n${childLines.join("\n")}\n  }`;
}

function buildDeclarationSource(schema: unknown, schemaName: string): string {
  const declarations: string[] = [];
  const { commandRoot, statusRoot, eventRoot } = resolveSchemaRoots(schema);

  const commandType = commandRoot
    ? createCommandBranchType(commandRoot, ["Command"], declarations)
    : "XapiCommandNode<Record<string, unknown>>";
  const statusType = statusRoot ? createStatusBranchType(statusRoot) : "XapiStatusNode<unknown>";
  const eventType = eventRoot
    ? createEventBranchType(eventRoot, ["Event"], declarations)
    : "XapiEventNode<unknown>";

  return `declare module "xapi" {
  export interface XapiCommandNode<TArgs = Record<string, unknown>> {
    (args: TArgs): Promise<any>;
    (args?: TArgs): Promise<any>;
  }

  export interface XapiStatusNode<TValue = unknown> {
    get(): Promise<TValue>;
  }

  export interface XapiEventNode<TPayload = unknown> {
    on(callback: (payload: TPayload) => void): void;
  }

${declarations.join("\n")}

  export interface Xapi {
    Command: ${commandType};
    Event: ${eventType};
    Status: {
      get(path: string): Promise<unknown>;
    } & ${statusType};
    command(path: string, payload?: Record<string, unknown>): Promise<{ ok: true }>;
    emit(path: string, payload?: unknown): void;
  }

  const xapi: Xapi;
  export default xapi;
}

declare const __roomosSchemaVersion: ${JSON.stringify(schemaName)};`;
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

export async function installXapiIntellisense({
  monaco,
  addLog,
}: InstallXapiIntellisenseOptions): Promise<XapiSchemaBundle> {
  configureJavaScriptDefaults(monaco);

  const schemaBundle = await loadLatestXapiSchema();
  const { schemaName, schema, roots } = schemaBundle;
  const audioVolumeSetNode = roots.commandRoot
    ? findNodeByPath(roots.commandRoot, ["Audio", "Volume", "Set"])
    : null;

  window.__roomosSchemaDebug = {
    latestSchemaName: schemaName,
    commandRoot: roots.commandRoot,
    statusRoot: roots.statusRoot,
    eventRoot: roots.eventRoot,
    audioVolumeSetNode,
  };

  console.groupCollapsed(`[xapi schema debug] ${schemaName}`);
  console.log("Resolved latest schema:", schemaName);
  console.log("Command root:", roots.commandRoot);
  console.log("Audio.Volume.Set node:", audioVolumeSetNode);
  console.groupEnd();

  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    buildDeclarationSource(schema, schemaName),
    "file:///node_modules/@types/xapi/index.d.ts",
  );

  addLog(`Loaded xapi IntelliSense schema: ${schemaName}`, "success");
  return schemaBundle;
}
