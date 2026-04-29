import { collectPayloadShape, findNodeByPath, splitXapiPath } from "./schema.ts";

type XapiKind = "Command" | "Status" | "Event";
type SchemaNode = Record<string, any>;
type XapiPayload = Record<string, unknown>;

interface XapiSchemaRoots {
  commandRoot?: SchemaNode | null;
  statusRoot?: SchemaNode | null;
  eventRoot?: SchemaNode | null;
}

interface XapiSchemaBundle {
  schemaName?: string;
  roots?: XapiSchemaRoots;
}

interface CreateXapiValidatorOptions {
  schemaBundle?: XapiSchemaBundle | null;
  productId?: string | null;
  productName?: string | null;
  localCommandPaths?: Iterable<string>;
  localStatusPaths?: Iterable<string>;
  localEventPaths?: Iterable<string>;
}

export interface XapiValidationResult {
  ok: boolean;
  node: SchemaNode | null;
  errors: string[];
}

export interface XapiValidator {
  validateCommand(path: string, payload?: unknown): XapiValidationResult;
  validateStatus(path: string): XapiValidationResult;
  validateEvent(path: string): XapiValidationResult;
}

function formatPath(kind: XapiKind, path: string): string {
  return `xapi.${kind}.${path}`;
}

function getAvailableProducts(node: SchemaNode | null): string[] {
  return Array.isArray(node?.products) ? node.products.map(String) : [];
}

function validateProductSupport(
  node: SchemaNode,
  productId: string | null | undefined,
  productName: string | null | undefined,
  kind: XapiKind,
  path: string,
): string[] {
  const products = getAvailableProducts(node);
  if (!products.length || !productId || products.includes(productId)) {
    return [];
  }

  return [
    `${formatPath(kind, path)} is not available on ${productName ?? productId} (${productId}).`,
  ];
}

function validatePayloadType(name: string, value: unknown, schemaNode: SchemaNode): string[] {
  const valuespace = schemaNode?.valuespace;
  const type = String(valuespace?.type ?? schemaNode?.type ?? "").toLowerCase();
  const errors: string[] = [];

  if (Array.isArray(valuespace?.Values) && valuespace.Values.length) {
    const allowed = new Set(valuespace.Values.map(String));
    if (!allowed.has(String(value))) {
      errors.push(`${name} must be one of: ${valuespace.Values.join(", ")}.`);
    }
    return errors;
  }

  if (type.includes("integer") || type.includes("float") || type.includes("number")) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      errors.push(`${name} must be a number.`);
      return errors;
    }

    const min = Number(valuespace?.Min ?? valuespace?.minimum ?? schemaNode?.minimum);
    const max = Number(valuespace?.Max ?? valuespace?.maximum ?? schemaNode?.maximum);
    if (!Number.isNaN(min) && numeric < min) {
      errors.push(`${name} must be greater than or equal to ${min}.`);
    }
    if (!Number.isNaN(max) && numeric > max) {
      errors.push(`${name} must be less than or equal to ${max}.`);
    }
    return errors;
  }

  if (type.includes("boolean") && typeof value !== "boolean") {
    errors.push(`${name} must be a boolean.`);
  }

  return errors;
}

function toPayloadObject(payload: unknown): XapiPayload {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as XapiPayload : {};
}

function validatePayload(node: SchemaNode, payload: unknown, kind: XapiKind, path: string): string[] {
  const payloadEntries = collectPayloadShape(node);
  if (!payloadEntries.length) {
    return [];
  }

  const errors: string[] = [];
  const payloadObject = toPayloadObject(payload);
  const params = new Map(payloadEntries);

  payloadEntries.forEach(([name, schemaNode]) => {
    if (schemaNode?.required === true && payloadObject[name] === undefined) {
      errors.push(`${formatPath(kind, path)} requires ${name}.`);
    }
  });

  Object.entries(payloadObject).forEach(([name, value]) => {
    const schemaNode = params.get(name);
    if (!schemaNode) {
      errors.push(`${formatPath(kind, path)} does not support argument ${name}.`);
      return;
    }
    errors.push(...validatePayloadType(name, value, schemaNode));
  });

  return errors;
}

export function createXapiValidator({
  schemaBundle,
  productId,
  productName,
  localCommandPaths = [],
  localStatusPaths = [],
  localEventPaths = [],
}: CreateXapiValidatorOptions = {}): XapiValidator {
  const roots = schemaBundle?.roots ?? {};
  const localCommands = new Set(localCommandPaths);
  const localStatuses = new Set(localStatusPaths);
  const localEvents = new Set(localEventPaths);

  function validatePath(kind: XapiKind, root: SchemaNode | null | undefined, path: string, payload?: unknown): XapiValidationResult {
    if (!root) {
      return { ok: true, node: null, errors: [] };
    }

    const node = findNodeByPath(root, splitXapiPath(path));
    if (!node) {
      if (kind === "Command" && localCommands.has(path)) {
        return { ok: true, node: null, errors: [] };
      }
      if (kind === "Status" && localStatuses.has(path)) {
        return { ok: true, node: null, errors: [] };
      }
      if (kind === "Event" && localEvents.has(path)) {
        return { ok: true, node: null, errors: [] };
      }
      return {
        ok: false,
        node: null,
        errors: [`${formatPath(kind, path)} is not available in schema ${schemaBundle?.schemaName ?? ""}.`],
      };
    }

    const errors = [
      ...validateProductSupport(node, productId, productName, kind, path),
      ...(kind === "Command" ? validatePayload(node, payload, kind, path) : []),
    ];

    return {
      ok: errors.length === 0,
      node,
      errors,
    };
  }

  return {
    validateCommand(path, payload) {
      return validatePath("Command", roots.commandRoot, path, payload);
    },
    validateStatus(path) {
      return validatePath("Status", roots.statusRoot, path);
    },
    validateEvent(path) {
      return validatePath("Event", roots.eventRoot, path);
    },
  };
}
