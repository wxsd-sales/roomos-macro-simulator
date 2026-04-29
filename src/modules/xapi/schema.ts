export const SCHEMAS_INDEX_URL =
  "https://raw.githubusercontent.com/cisco-ce/roomos.cisco.com/master/schemas/schemas.json";
export const SCHEMA_BASE_URL =
  "https://raw.githubusercontent.com/cisco-ce/roomos.cisco.com/master/schemas";

type SchemaValue = unknown;
type SchemaRecord = Record<string, any>;
type SchemaPath = string | Array<string | number | null | undefined>;

interface SchemaManifestEntry extends SchemaRecord {
  name?: string;
  schemaName?: string;
  schema?: string;
  version?: string;
  title?: string;
  lastUpdate?: string | number;
  lastUpdated?: string | number;
  date?: string | number;
}

interface SchemaRoots {
  commandRoot: SchemaRecord | null;
  statusRoot: SchemaRecord | null;
  eventRoot: SchemaRecord | null;
}

interface FlatSchemaObject extends SchemaRecord {
  type?: string;
  path?: string;
  normPath?: string;
  products?: string[];
  attributes?: {
    description?: string;
    include_for_extension?: unknown;
    params?: Array<SchemaRecord & { name?: string }>;
  };
}

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
  "products",
  "includeForExtension",
  "$schema",
  "$id",
  "$ref",
]);

export function isPlainObject(value: SchemaValue): value is SchemaRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeSchemaEntries(payload: SchemaValue): SchemaManifestEntry[] {
  if (Array.isArray(payload)) {
    return payload.filter(isPlainObject);
  }

  if (isPlainObject(payload) && Array.isArray(payload.schemas)) {
    return payload.schemas;
  }

  if (isPlainObject(payload) && Array.isArray(payload.versions)) {
    return payload.versions;
  }

  if (isPlainObject(payload)) {
    return Object.entries(payload).map(([name, value]) => {
      if (isPlainObject(value)) {
        return { name, ...value };
      }
      return { name, value };
    });
  }

  return [];
}

function parseTimestamp(value: unknown): number {
  if (!value) {
    return 0;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return numeric;
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function resolveLatestSchemaName(entries: SchemaManifestEntry[]): string | null {
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

export function getSchemaUrl(schemaName: string): string {
  return `${SCHEMA_BASE_URL}/${encodeURIComponent(schemaName)}.json`;
}

export function collectChildEntries(node: SchemaValue): [string, SchemaRecord][] {
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
  }) as [string, SchemaRecord][];
}

function findLikelyRootNode(
  schema: SchemaValue,
  matcher: (key: string, value: SchemaRecord) => boolean,
): SchemaRecord | null {
  const queue = [{ key: "root", value: schema }];

  while (queue.length) {
    const current = queue.shift();
    if (!current || !isPlainObject(current.value)) {
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

export function findNodeByPath(root: SchemaValue, path: SchemaPath): SchemaRecord | null {
  let current = root;

  for (const segment of splitXapiPath(path)) {
    if (!isPlainObject(current)) {
      return null;
    }
    current = current[segment];
  }

  return current ?? null;
}

export function splitXapiPath(path: SchemaPath): string[] {
  if (Array.isArray(path)) {
    return path.filter(Boolean).map(String);
  }

  return String(path ?? "")
    .trim()
    .split(/[.\s]+/)
    .filter(Boolean);
}

function splitSchemaPath(path: unknown): string[] {
  return String(path ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function ensureTreePath(root: SchemaRecord, path: string[]): SchemaRecord {
  let current = root;

  path.forEach((segment) => {
    if (!isPlainObject(current[segment])) {
      current[segment] = {};
    }
    current = current[segment];
  });

  return current;
}

function mergeDescription(target: unknown, incoming: unknown): string {
  const next = String(incoming ?? "").trim();
  if (!next) {
    return String(target ?? "");
  }

  if (!target) {
    return next;
  }

  const current = String(target);
  return next.length > current.length ? next : current;
}

function mergeValuespace(existing: unknown, incoming: unknown): SchemaRecord | null {
  if (!isPlainObject(incoming)) {
    return isPlainObject(existing) ? existing : null;
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

function mergeParamNode(existing: unknown, param: SchemaRecord): SchemaRecord {
  const next = isPlainObject(existing) ? existing : {};

  next.description = mergeDescription(next.description, param?.description);
  next.required =
    next.required === undefined ? param?.required === true : next.required && param?.required === true;
  next.valuespace = mergeValuespace(next.valuespace, param?.valuespace);

  return next;
}

function addFlatObjectToTree(root: SchemaRecord, object: FlatSchemaObject): void {
  const path = splitSchemaPath(object?.path ?? object?.normPath);
  if (!path.length) {
    return;
  }

  const leaf = ensureTreePath(root, path);
  leaf.description = mergeDescription(leaf.description, object?.attributes?.description);
  leaf.products = Array.isArray(object?.products) ? object.products : leaf.products;
  leaf.includeForExtension = object?.attributes?.include_for_extension ?? leaf.includeForExtension;

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

function buildRootsFromFlatSchema(schema: SchemaRecord): SchemaRoots {
  const commandRoot = {};
  const statusRoot = {};
  const eventRoot = {};
  const objects = Array.isArray(schema?.objects) ? schema.objects as FlatSchemaObject[] : [];

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

export function resolveSchemaRoots(schema: SchemaValue): SchemaRoots {
  if (isPlainObject(schema) && Array.isArray(schema.objects)) {
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

export function collectPayloadShape(node: SchemaValue): [string, SchemaRecord][] {
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

export function collectBranchEntries(node: SchemaValue): [string, SchemaRecord][] {
  const payloadContainers = new Set(["Params", "Parameters", "Arguments", "Args", "Input", "Payload"]);
  return collectChildEntries(node).filter(([key]) => !payloadContainers.has(key));
}

export async function loadLatestXapiSchema(): Promise<{
  schemaName: string;
  schema: SchemaValue;
  roots: SchemaRoots;
}> {
  const manifestResponse = await fetch(SCHEMAS_INDEX_URL);
  if (!manifestResponse.ok) {
    throw new Error(`Unable to load Cisco schemas index (${manifestResponse.status})`);
  }

  const manifestPayload = await manifestResponse.json();
  const schemaName = resolveLatestSchemaName(normalizeSchemaEntries(manifestPayload));
  if (!schemaName) {
    throw new Error("Unable to resolve latest Cisco schema name from schemas index");
  }

  const schemaResponse = await fetch(getSchemaUrl(schemaName));
  if (!schemaResponse.ok) {
    throw new Error(`Unable to load Cisco schema "${schemaName}" (${schemaResponse.status})`);
  }

  const schema = await schemaResponse.json();
  const roots = resolveSchemaRoots(schema);

  return {
    schemaName,
    schema,
    roots,
  };
}
