export const SCHEMAS_INDEX_URL =
  "https://raw.githubusercontent.com/cisco-ce/roomos.cisco.com/master/schemas/schemas.json";
export const SCHEMA_BASE_URL =
  "https://raw.githubusercontent.com/cisco-ce/roomos.cisco.com/master/schemas";

export type XapiKind = "Command" | "Status" | "Config" | "Event";
export type SchemaPath = string | Array<string | number | null | undefined>;

type SchemaRecord = Record<string, any>;

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

/** Canonical valuespace, normalized from the several shapes the upstream schema uses. */
export interface XapiValuespace {
  type: string;
  Values?: string[];
  Min?: number;
  Max?: number;
  MinLength?: number;
  MaxLength?: number;
}

/** A single command argument. */
export interface XapiParam {
  name: string;
  required: boolean;
  description?: string;
  valuespace: XapiValuespace | null;
}

/** A field on an event payload. Payload fields nest and may repeat. */
export interface XapiPayloadField {
  required: boolean;
  multiple: boolean;
  valuespace: XapiValuespace | null;
  children?: Record<string, XapiPayloadField>;
}

/**
 * One node in a kind tree. Children live under `children` so that schema
 * metadata can never be mistaken for a path segment.
 */
export interface XapiSchemaNode {
  children: Record<string, XapiSchemaNode>;
  /** True when the upstream segment was indexed, e.g. `Connector[n]` or `ARC[1..3]`. */
  indexed: boolean;
  /** True when a command/status/config/event actually terminates here. */
  leaf: boolean;
  description?: string;
  products?: string[];
  /** Value type for Status and Config leaves. */
  valuespace?: XapiValuespace | null;
  /** Default value for Config leaves. */
  defaultValue?: string;
  /** Arguments for Command leaves. */
  params?: Record<string, XapiParam>;
  /** Payload shape for Event leaves. */
  payload?: Record<string, XapiPayloadField>;
}

export interface SchemaRoots {
  commandRoot: XapiSchemaNode | null;
  statusRoot: XapiSchemaNode | null;
  configRoot: XapiSchemaNode | null;
  eventRoot: XapiSchemaNode | null;
}

export interface XapiSchemaBundle {
  schemaName: string;
  roots: SchemaRoots;
}

/** Normalized schema object, the common currency between all three sources. */
interface XapiSchemaObject {
  kind: XapiKind;
  path: string;
  products?: string[];
  description?: string;
  valuespace?: XapiValuespace | null;
  defaultValue?: string;
  params?: XapiParam[];
  payload?: Record<string, XapiPayloadField>;
}

const KIND_BY_UPSTREAM_TYPE: Record<string, XapiKind> = {
  Command: "Command",
  Status: "Status",
  Configuration: "Config",
  Config: "Config",
  Event: "Event",
};

const INDEXED_SEGMENT = /^(.+?)\[[^\]]*\]$/;

export function isPlainObject(value: unknown): value is SchemaRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return undefined;
  }
  return [...new Set(value.map(String))];
}

/**
 * Upstream expresses valuespaces two ways: an object (commands, statuses,
 * configurations) and a bare type string with a sibling `values` array
 * (event payload fields).
 */
export function normalizeValuespace(raw: unknown, siblingValues?: unknown): XapiValuespace | null {
  if (typeof raw === "string") {
    const values = toStringArray(siblingValues);
    return { type: raw, ...(values ? { Values: values } : {}) };
  }

  if (!isPlainObject(raw)) {
    return null;
  }

  const type = String(raw.type ?? "").trim();
  const values = toStringArray(raw.Values ?? raw.values ?? siblingValues);

  return {
    type,
    ...(values ? { Values: values } : {}),
    ...(toOptionalNumber(raw.Min ?? raw.minimum) !== undefined
      ? { Min: toOptionalNumber(raw.Min ?? raw.minimum) }
      : {}),
    ...(toOptionalNumber(raw.Max ?? raw.maximum) !== undefined
      ? { Max: toOptionalNumber(raw.Max ?? raw.maximum) }
      : {}),
    ...(toOptionalNumber(raw.MinLength) !== undefined
      ? { MinLength: toOptionalNumber(raw.MinLength) }
      : {}),
    ...(toOptionalNumber(raw.MaxLength) !== undefined
      ? { MaxLength: toOptionalNumber(raw.MaxLength) }
      : {}),
  };
}

function normalizePayloadFields(raw: unknown): Record<string, XapiPayloadField> | undefined {
  if (!isPlainObject(raw)) {
    return undefined;
  }

  const fields: Record<string, XapiPayloadField> = {};
  Object.entries(raw).forEach(([name, value]) => {
    if (!isPlainObject(value)) {
      return;
    }

    const children = normalizePayloadFields(value.children);
    fields[name] = {
      required: value.required === true,
      multiple: value.multiple === true,
      valuespace: children ? null : normalizeValuespace(value.valuespace, value.values),
      ...(children ? { children } : {}),
    };
  });

  return Object.keys(fields).length ? fields : undefined;
}

function normalizeParams(raw: unknown): XapiParam[] | undefined {
  if (!Array.isArray(raw) || !raw.length) {
    return undefined;
  }

  const params = raw
    .filter((param) => isPlainObject(param) && param.name)
    .map((param) => ({
      name: String(param.name),
      required: param.required === true,
      ...(param.description ? { description: String(param.description) } : {}),
      valuespace: normalizeValuespace(param.valuespace),
    }));

  return params.length ? params : undefined;
}

function firstParagraph(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  if (!text) {
    return undefined;
  }
  return text.split(/\n\s*\n/)[0].trim() || undefined;
}

/**
 * Accepts either the upstream Cisco format (`{ objects: [{ type, path,
 * products, attributes }] }`) or the compact vendored format written by
 * `scripts/update-xapi-schema.mts`.
 */
export function normalizeSchemaObjects(payload: unknown): XapiSchemaObject[] {
  if (!isPlainObject(payload) || !Array.isArray(payload.objects)) {
    return [];
  }

  const productDictionary = Array.isArray(payload.products) ? payload.products.map(String) : null;
  const objects: XapiSchemaObject[] = [];

  payload.objects.forEach((entry: unknown) => {
    if (!isPlainObject(entry)) {
      return;
    }

    const kind = KIND_BY_UPSTREAM_TYPE[String(entry.type ?? entry.t ?? "")];
    const path = String(entry.path ?? entry.p ?? entry.normPath ?? "").trim();
    if (!kind || !path) {
      return;
    }

    const attributes = isPlainObject(entry.attributes) ? entry.attributes : {};

    const rawProducts = entry.products ?? entry.r;
    let products: string[] | undefined;
    if (Array.isArray(rawProducts)) {
      products = productDictionary
        ? rawProducts
            .map((index: unknown) =>
              typeof index === "number" ? productDictionary[index] : String(index),
            )
            .filter(Boolean)
        : rawProducts.map(String);
    }

    objects.push({
      kind,
      path,
      ...(products?.length ? { products } : {}),
      ...(firstParagraph(attributes.description ?? entry.d)
        ? { description: firstParagraph(attributes.description ?? entry.d) }
        : {}),
      valuespace: normalizeValuespace(attributes.valuespace ?? entry.v),
      ...(attributes.default ?? entry.x
        ? { defaultValue: String(attributes.default ?? entry.x) }
        : {}),
      ...(normalizeParams(attributes.params ?? entry.a)
        ? { params: normalizeParams(attributes.params ?? entry.a) }
        : {}),
      ...(normalizePayloadFields(attributes.children ?? entry.c)
        ? { payload: normalizePayloadFields(attributes.children ?? entry.c) }
        : {}),
    });
  });

  return objects;
}

function createNode(): XapiSchemaNode {
  return { children: {}, indexed: false, leaf: false };
}

export function splitSchemaPath(path: unknown): string[] {
  return String(path ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function splitXapiPath(path: SchemaPath): string[] {
  if (Array.isArray(path)) {
    return path.filter((segment) => segment !== null && segment !== undefined && segment !== "").map(String);
  }

  return String(path ?? "")
    .trim()
    .split(/[.\s]+/)
    .filter(Boolean);
}

/** Splits `Connector[n]` into its dot-addressable name plus an indexed marker. */
export function parseSegment(segment: string): { name: string; indexed: boolean } {
  const match = INDEXED_SEGMENT.exec(segment);
  return match ? { name: match[1], indexed: true } : { name: segment, indexed: false };
}

function ensureNode(root: XapiSchemaNode, segments: string[]): XapiSchemaNode {
  let current = root;

  segments.forEach((segment) => {
    const { name, indexed } = parseSegment(segment);
    if (!current.children[name]) {
      current.children[name] = createNode();
    }
    current = current.children[name];
    if (indexed) {
      current.indexed = true;
    }
  });

  return current;
}

function applyObjectToNode(node: XapiSchemaNode, object: XapiSchemaObject): void {
  node.leaf = true;

  if (object.description && object.description.length > (node.description?.length ?? 0)) {
    node.description = object.description;
  }
  if (object.products?.length) {
    node.products = object.products;
  }
  if (object.valuespace) {
    node.valuespace = object.valuespace;
  }
  if (object.defaultValue !== undefined) {
    node.defaultValue = object.defaultValue;
  }
  if (object.payload) {
    node.payload = { ...node.payload, ...object.payload };
  }
  if (object.params) {
    node.params = node.params ?? {};
    object.params.forEach((param) => {
      node.params![param.name] = param;
    });
  }
}

export function buildSchemaRoots(payload: unknown): SchemaRoots {
  const trees: Record<XapiKind, XapiSchemaNode> = {
    Command: createNode(),
    Status: createNode(),
    Config: createNode(),
    Event: createNode(),
  };

  normalizeSchemaObjects(payload).forEach((object) => {
    const segments = splitSchemaPath(object.path);
    if (!segments.length) {
      return;
    }
    applyObjectToNode(ensureNode(trees[object.kind], segments), object);
  });

  const used = (node: XapiSchemaNode) => (Object.keys(node.children).length ? node : null);

  return {
    commandRoot: used(trees.Command),
    statusRoot: used(trees.Status),
    configRoot: used(trees.Config),
    eventRoot: used(trees.Event),
  };
}

/** Kept as the public name used across the app and tests. */
export const resolveSchemaRoots = buildSchemaRoots;

/**
 * Walks a kind tree. Numeric segments are consumed by indexed nodes so that a
 * runtime path such as `Audio.Input.Connectors.Ethernet.1.Mute` — produced when
 * a macro writes `Ethernet[1]` — resolves against `Ethernet[n]` in the schema.
 */
export function findNodeByPath(
  root: XapiSchemaNode | null | undefined,
  path: SchemaPath,
): XapiSchemaNode | null {
  let current = root ?? null;

  for (const segment of splitXapiPath(path)) {
    if (!current) {
      return null;
    }

    if (current.indexed && /^\d+$/.test(segment)) {
      continue;
    }

    current = current.children[segment] ?? null;
  }

  return current;
}

export function getCommandParams(node: XapiSchemaNode | null | undefined): XapiParam[] {
  return node?.params ? Object.values(node.params) : [];
}

export function getChildEntries(
  node: XapiSchemaNode | null | undefined,
): [string, XapiSchemaNode][] {
  return node ? Object.entries(node.children) : [];
}

export function normalizeSchemaEntries(payload: unknown): SchemaManifestEntry[] {
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
    return Object.entries(payload).map(([name, value]) =>
      isPlainObject(value) ? { name, ...value } : { name, value },
    );
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
      schemaName: entry.name ?? entry.schemaName ?? entry.schema ?? entry.version ?? entry.title,
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

/** Resolves the newest schema name from the Cisco index, then fetches it. */
export async function fetchLatestXapiSchema(): Promise<{ schemaName: string; payload: unknown }> {
  const manifestResponse = await fetch(SCHEMAS_INDEX_URL);
  if (!manifestResponse.ok) {
    throw new Error(`Unable to load Cisco schemas index (${manifestResponse.status})`);
  }

  const schemaName = resolveLatestSchemaName(normalizeSchemaEntries(await manifestResponse.json()));
  if (!schemaName) {
    throw new Error("Unable to resolve latest Cisco schema name from schemas index");
  }

  const schemaResponse = await fetch(getSchemaUrl(schemaName));
  if (!schemaResponse.ok) {
    throw new Error(`Unable to load Cisco schema "${schemaName}" (${schemaResponse.status})`);
  }

  return { schemaName, payload: await schemaResponse.json() };
}
