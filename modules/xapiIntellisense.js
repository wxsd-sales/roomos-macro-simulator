const SCHEMAS_INDEX_URL =
  "https://raw.githubusercontent.com/cisco-ce/roomos.cisco.com/master/schemas/schemas.json";
const SCHEMA_BASE_URL =
  "https://raw.githubusercontent.com/cisco-ce/roomos.cisco.com/master/schemas";

const METADATA_KEYS = new Set([
  "description",
  "docs",
  "documentation",
  "example",
  "examples",
  "id",
  "name",
  "title",
  "type",
  "format",
  "default",
  "required",
  "deprecated",
  "enum",
  "values",
  "minimum",
  "maximum",
  "min",
  "max",
  "readOnly",
  "writeOnly",
  "optional",
  "kind",
  "lastUpdate",
  "lastUpdated",
  "version",
  "path",
  "xpath",
  "url",
  "$schema",
  "$id",
  "$ref",
]);

function normalizeSchemaEntries(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.schemas)) {
    return payload.schemas;
  }

  if (Array.isArray(payload?.versions)) {
    return payload.versions;
  }

  if (payload && typeof payload === "object") {
    return Object.entries(payload).map(([name, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return { name, ...value };
      }
      return { name, value };
    });
  }

  return [];
}

function parseTimestamp(value) {
  if (!value) {
    return 0;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return numeric;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function resolveLatestSchemaName(entries) {
  const enriched = entries
    .map((entry) => ({
      ...entry,
      schemaName:
        entry.name ??
        entry.schemaName ??
        entry.schema ??
        entry.version ??
        entry.title,
      timestamp: parseTimestamp(entry.lastUpdate ?? entry.lastUpdated ?? entry.date),
    }))
    .filter((entry) => entry.schemaName);

  enriched.sort((a, b) => {
    if (b.timestamp !== a.timestamp) {
      return b.timestamp - a.timestamp;
    }
    return String(b.schemaName).localeCompare(String(a.schemaName));
  });

  return enriched[0]?.schemaName ?? null;
}

function getSchemaUrl(schemaName) {
  return `${SCHEMA_BASE_URL}/${encodeURIComponent(schemaName)}.json`;
}

function safeIdentifier(key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectChildEntries(node) {
  if (!isPlainObject(node)) {
    return [];
  }

  return Object.entries(node).filter(([key, value]) => {
    if (METADATA_KEYS.has(key)) {
      return false;
    }

    if (key.startsWith("_")) {
      return false;
    }

    if (value == null) {
      return false;
    }

    return typeof value === "object";
  });
}

function findLikelyRootNode(schema, matcher) {
  const queue = [{ key: "root", value: schema }];

  while (queue.length) {
    const current = queue.shift();
    if (!isPlainObject(current.value)) {
      continue;
    }

    if (matcher(current.key, current.value)) {
      return current.value;
    }

    collectChildEntries(current.value).forEach(([key, value]) => {
      queue.push({ key, value });
    });
  }

  return null;
}

function findNodeByPath(root, path) {
  let current = root;

  for (const segment of path) {
    if (!isPlainObject(current)) {
      return null;
    }
    current = current[segment];
  }

  return current ?? null;
}

function mergeDescription(target, incoming) {
  const next = String(incoming ?? "").trim();
  if (!next) {
    return target ?? "";
  }

  if (!target) {
    return next;
  }

  return next.length > target.length ? next : target;
}

function splitSchemaPath(path) {
  return String(path ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function ensureTreePath(root, path) {
  let current = root;

  path.forEach((segment) => {
    if (!isPlainObject(current[segment])) {
      current[segment] = {};
    }
    current = current[segment];
  });

  return current;
}

function mergeValuespace(existing, incoming) {
  if (!isPlainObject(incoming)) {
    return existing ?? null;
  }

  if (!isPlainObject(existing)) {
    return { ...incoming };
  }

  const merged = { ...existing, ...incoming };
  const existingValues = Array.isArray(existing.Values) ? existing.Values : [];
  const incomingValues = Array.isArray(incoming.Values) ? incoming.Values : [];

  if (existingValues.length || incomingValues.length) {
    merged.Values = [...new Set([...existingValues, ...incomingValues])];
  }

  return merged;
}

function mergeParamNode(existing, param) {
  const next = isPlainObject(existing) ? existing : {};

  next.description = mergeDescription(next.description, param?.description);
  next.required =
    next.required === undefined ? param?.required === true : next.required && param?.required === true;
  next.valuespace = mergeValuespace(next.valuespace, param?.valuespace);

  return next;
}

function addFlatObjectToTree(root, object) {
  const path = splitSchemaPath(object?.path ?? object?.normPath);
  if (!path.length) {
    return;
  }

  const leaf = ensureTreePath(root, path);
  leaf.description = mergeDescription(leaf.description, object?.attributes?.description);

  const params = Array.isArray(object?.attributes?.params) ? object.attributes.params : [];
  if (!params.length) {
    return;
  }

  if (!isPlainObject(leaf.Params)) {
    leaf.Params = {};
  }

  params.forEach((param) => {
    if (!param?.name) {
      return;
    }
    leaf.Params[param.name] = mergeParamNode(leaf.Params[param.name], param);
  });
}

function buildRootsFromFlatSchema(schema) {
  const commandRoot = {};
  const statusRoot = {};
  const eventRoot = {};
  const objects = Array.isArray(schema?.objects) ? schema.objects : [];

  objects.forEach((object) => {
    switch (object?.type) {
      case "Command":
        addFlatObjectToTree(commandRoot, object);
        break;
      case "Status":
        addFlatObjectToTree(statusRoot, object);
        break;
      case "Event":
        addFlatObjectToTree(eventRoot, object);
        break;
      default:
        break;
    }
  });

  return {
    commandRoot: Object.keys(commandRoot).length ? commandRoot : null,
    statusRoot: Object.keys(statusRoot).length ? statusRoot : null,
    eventRoot: Object.keys(eventRoot).length ? eventRoot : null,
  };
}

function resolveSchemaRoots(schema) {
  if (Array.isArray(schema?.objects)) {
    return buildRootsFromFlatSchema(schema);
  }

  return {
    commandRoot:
      findLikelyRootNode(schema, (key) => /^(x)?command$/i.test(key)) ??
      findLikelyRootNode(schema, (key) => key === "Commands"),
    statusRoot:
      findLikelyRootNode(schema, (key) => /^(x)?status$/i.test(key)) ??
      findLikelyRootNode(schema, (key) => key === "Status"),
    eventRoot:
      findLikelyRootNode(schema, (key) => /^(x)?event$/i.test(key) || /^(x)?feedback$/i.test(key)) ??
      findLikelyRootNode(schema, (key) => key === "Events"),
  };
}

function buildArgsTypeName(path) {
  const suffix = path.length ? path.join("") : "Root";
  return `${suffix}Args`;
}

function pickDescription(node) {
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

function toJsDoc(text, indent = "  ") {
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

function collectPayloadShape(node) {
  if (!isPlainObject(node)) {
    return [];
  }

  const candidateKeys = ["Params", "Parameters", "Arguments", "Args", "Input", "Payload"];
  for (const key of candidateKeys) {
    const value = node[key];
    if (isPlainObject(value)) {
      return collectChildEntries(value);
    }
  }

  const children = collectChildEntries(node);
  return children.filter(([key]) => /^[a-z]/.test(key));
}

function collectBranchEntries(node) {
  const payloadContainers = new Set(["Params", "Parameters", "Arguments", "Args", "Input", "Payload"]);
  return collectChildEntries(node).filter(([key]) => !payloadContainers.has(key));
}

function renderSchemaValueType(node) {
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

function renderObjectType(entries, fallback = "Record<string, unknown>") {
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

function hasRequiredEntries(entries) {
  return entries.some(([, value]) => value?.required === true);
}

function renderCommandMethodSignatures(name, node, path, declarations) {
  const payloadEntries = collectPayloadShape(node);
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

function createCommandBranchType(node, path = [], declarations = []) {
  const children = collectBranchEntries(node);
  const payloadEntries = collectPayloadShape(node);
  const payloadTypeName = buildArgsTypeName(path);

  declarations.push(`  export interface ${payloadTypeName} ${renderObjectType(payloadEntries, "{}")}`);

  if (!children.length) {
    return `XapiCommandNode<${payloadTypeName}>`;
  }

  const childLines = children.map(([key, value]) => {
    const childChildren = collectBranchEntries(value);
    if (!childChildren.length) {
      return renderCommandMethodSignatures(key, value, [...path, key], declarations);
    }

    const description = toJsDoc(pickDescription(value), "    ");
    return `${description}    ${safeIdentifier(key)}: ${createCommandBranchType(value, [...path, key], declarations)};`;
  });

  return `XapiCommandNode<${payloadTypeName}> & {\n${childLines.join("\n")}\n  }`;
}

function createEventBranchType(node, path = [], declarations = []) {
  const children = collectBranchEntries(node);
  const payloadEntries = collectPayloadShape(node);
  const payloadTypeName = `${buildArgsTypeName(path)}Event`;

  declarations.push(`  export interface ${payloadTypeName} ${renderObjectType(payloadEntries, "{}")}`);

  if (!children.length) {
    return `XapiEventNode<${payloadTypeName}>`;
  }

  const childLines = children.map(([key, value]) => {
    const description = toJsDoc(pickDescription(value), "    ");
    return `${description}    ${safeIdentifier(key)}: ${createEventBranchType(value, [...path, key], declarations)};`;
  });

  return `XapiEventNode<${payloadTypeName}> & {\n${childLines.join("\n")}\n  }`;
}

function createStatusBranchType(node) {
  const children = collectBranchEntries(node);

  if (!children.length) {
    return `XapiStatusNode<${renderSchemaValueType(node)}>`;
  }

  const childLines = children.map(([key, value]) => {
    const description = toJsDoc(pickDescription(value), "    ");
    return `${description}    ${safeIdentifier(key)}: ${createStatusBranchType(value)};`;
  });

  return `XapiStatusNode<unknown> & {\n${childLines.join("\n")}\n  }`;
}

function buildDeclarationSource(schema, schemaName) {
  const declarations = [];
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

function configureJavaScriptDefaults(monaco) {
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

export async function installXapiIntellisense({ monaco, addLog }) {
  configureJavaScriptDefaults(monaco);

  const manifestResponse = await fetch(SCHEMAS_INDEX_URL);
  if (!manifestResponse.ok) {
    throw new Error(`Unable to load Cisco schemas index (${manifestResponse.status})`);
  }

  const manifestPayload = await manifestResponse.json();
  const latestSchemaName = resolveLatestSchemaName(normalizeSchemaEntries(manifestPayload));
  if (!latestSchemaName) {
    throw new Error("Unable to resolve latest Cisco schema name from schemas index");
  }

  const schemaResponse = await fetch(getSchemaUrl(latestSchemaName));
  if (!schemaResponse.ok) {
    throw new Error(`Unable to load Cisco schema "${latestSchemaName}" (${schemaResponse.status})`);
  }

  const schemaPayload = await schemaResponse.json();
  const { commandRoot, statusRoot, eventRoot } = resolveSchemaRoots(schemaPayload);
  const audioVolumeSetNode = commandRoot
    ? findNodeByPath(commandRoot, ["Audio", "Volume", "Set"])
    : null;

  window.__roomosSchemaDebug = {
    latestSchemaName,
    commandRoot,
    statusRoot,
    eventRoot,
    audioVolumeSetNode,
  };

  console.groupCollapsed(`[xapi schema debug] ${latestSchemaName}`);
  console.log("Resolved latest schema:", latestSchemaName);
  console.log("Command root:", commandRoot);
  console.log("Audio.Volume.Set node:", audioVolumeSetNode);
  console.groupEnd();

  const declarationSource = buildDeclarationSource(schemaPayload, latestSchemaName);
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    declarationSource,
    "file:///node_modules/@types/xapi/index.d.ts",
  );

  addLog(`Loaded xapi IntelliSense schema: ${latestSchemaName}`, "success");
  return {
    latestSchemaName,
    schema: schemaPayload,
  };
}
