import { isPlainObject } from "./schema.ts";

/**
 * Compact on-disk form of the Cisco schema.
 *
 * The upstream document is ~2.8 MB, most of it repeated product-name arrays
 * and prose. Dictionary-encoding the products and keeping only the first
 * description paragraph brings it to a size that is reasonable to vendor and
 * to keep in `localStorage`. `normalizeSchemaObjects` in `schema.ts` reads
 * this shape and the upstream shape interchangeably.
 */
export interface CompactSchema {
  version: string;
  products: string[];
  objects: CompactSchemaObject[];
}

export interface CompactSchemaObject {
  /** Upstream type: `Command`, `Status`, `Configuration` or `Event`. */
  t: string;
  /** Space separated xAPI path. */
  p: string;
  /** Indices into the shared `products` dictionary. */
  r?: number[];
  /** First paragraph of the description. */
  d?: string;
  /** Valuespace for statuses and configurations. */
  v?: unknown;
  /** Default value for configurations. */
  x?: string;
  /** Command parameters, in upstream shape. */
  a?: unknown[];
  /** Event payload children, in upstream shape. */
  c?: unknown;
}

const KEPT_TYPES = new Set(["Command", "Status", "Configuration", "Event"]);

function firstParagraph(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  if (!text) {
    return undefined;
  }
  return text.split(/\n\s*\n/)[0].trim() || undefined;
}

function compactParams(raw: unknown): unknown[] | undefined {
  if (!Array.isArray(raw) || !raw.length) {
    return undefined;
  }

  const params = raw.filter(isPlainObject).map((param) => ({
    name: String(param.name ?? ""),
    ...(param.required === true ? { required: true } : {}),
    ...(param.valuespace ? { valuespace: param.valuespace } : {}),
    ...(firstParagraph(param.description) ? { description: firstParagraph(param.description) } : {}),
  }));

  return params.length ? params : undefined;
}

export function compactSchemaPayload(payload: unknown, version: string): CompactSchema {
  const source = isPlainObject(payload) && Array.isArray(payload.objects) ? payload.objects : [];
  const products: string[] = [];
  const productIndex = new Map<string, number>();

  function indexOfProduct(name: string): number {
    const existing = productIndex.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const next = products.length;
    products.push(name);
    productIndex.set(name, next);
    return next;
  }

  const objects: CompactSchemaObject[] = [];

  source.forEach((entry: unknown) => {
    if (!isPlainObject(entry) || !KEPT_TYPES.has(String(entry.type))) {
      return;
    }

    const path = String(entry.path ?? entry.normPath ?? "").trim();
    if (!path) {
      return;
    }

    const attributes = isPlainObject(entry.attributes) ? entry.attributes : {};
    const description = firstParagraph(attributes.description);

    objects.push({
      t: String(entry.type),
      p: path,
      ...(Array.isArray(entry.products) && entry.products.length
        ? { r: entry.products.map((product: unknown) => indexOfProduct(String(product))) }
        : {}),
      ...(description ? { d: description } : {}),
      ...(attributes.valuespace ? { v: attributes.valuespace } : {}),
      ...(attributes.default !== undefined && attributes.default !== null
        ? { x: String(attributes.default) }
        : {}),
      ...(compactParams(attributes.params) ? { a: compactParams(attributes.params) } : {}),
      ...(isPlainObject(attributes.children) ? { c: attributes.children } : {}),
    });
  });

  return { version, products, objects };
}
