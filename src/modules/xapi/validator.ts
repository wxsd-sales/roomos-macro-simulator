import { findNodeByPath, getCommandParams } from "./schema.ts";
import type {
  SchemaRoots,
  XapiKind,
  XapiParam,
  XapiSchemaBundle,
  XapiSchemaNode,
  XapiValuespace,
} from "./schema.ts";

type XapiPayload = Record<string, unknown>;

interface CreateXapiValidatorOptions {
  schemaBundle?: { schemaName?: string; roots?: Partial<SchemaRoots> } | null;
  productId?: string | null;
  productName?: string | null;
  localCommandPaths?: Iterable<string>;
  localStatusPaths?: Iterable<string>;
  localEventPaths?: Iterable<string>;
  localConfigPaths?: Iterable<string>;
}

export interface XapiValidationResult {
  ok: boolean;
  node: XapiSchemaNode | null;
  errors: string[];
}

export interface XapiValidator {
  validateCommand(path: string, payload?: unknown): XapiValidationResult;
  validateStatus(path: string): XapiValidationResult;
  validateEvent(path: string): XapiValidationResult;
  validateConfig(path: string, value?: unknown): XapiValidationResult;
}

function formatPath(kind: XapiKind, path: string): string {
  return `xapi.${kind}.${path}`;
}

function validateProductSupport(
  node: XapiSchemaNode,
  productId: string | null | undefined,
  productName: string | null | undefined,
  kind: XapiKind,
  path: string,
): string[] {
  const products = node.products ?? [];
  if (!products.length || !productId || products.includes(productId)) {
    return [];
  }

  return [`${formatPath(kind, path)} is not available on ${productName ?? productId} (${productId}).`];
}

function validateValue(name: string, value: unknown, valuespace: XapiValuespace | null): string[] {
  if (!valuespace) {
    return [];
  }

  const errors: string[] = [];
  const type = valuespace.type.toLowerCase();

  if (valuespace.Values?.length) {
    const allowed = new Set(valuespace.Values.map(String));
    if (!allowed.has(String(value))) {
      errors.push(`${name} must be one of: ${valuespace.Values.join(", ")}.`);
    }
    return errors;
  }

  if (/int|float|number/.test(type)) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      errors.push(`${name} must be a number.`);
      return errors;
    }
    if (valuespace.Min !== undefined && numeric < valuespace.Min) {
      errors.push(`${name} must be greater than or equal to ${valuespace.Min}.`);
    }
    if (valuespace.Max !== undefined && numeric > valuespace.Max) {
      errors.push(`${name} must be less than or equal to ${valuespace.Max}.`);
    }
    return errors;
  }

  if (/bool/.test(type) && typeof value !== "boolean") {
    errors.push(`${name} must be a boolean.`);
  }

  return errors;
}

function toPayloadObject(payload: unknown): XapiPayload {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as XapiPayload)
    : {};
}

function validateCommandPayload(node: XapiSchemaNode, payload: unknown, path: string): string[] {
  const params = getCommandParams(node);
  if (!params.length) {
    return [];
  }

  const errors: string[] = [];
  const payloadObject = toPayloadObject(payload);
  const byName = new Map<string, XapiParam>(params.map((param) => [param.name, param]));

  params.forEach((param) => {
    if (param.required && payloadObject[param.name] === undefined) {
      errors.push(`${formatPath("Command", path)} requires ${param.name}.`);
    }
  });

  Object.entries(payloadObject).forEach(([name, value]) => {
    const param = byName.get(name);
    if (!param) {
      errors.push(`${formatPath("Command", path)} does not support argument ${name}.`);
      return;
    }
    errors.push(...validateValue(name, value, param.valuespace));
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
  localConfigPaths = [],
}: CreateXapiValidatorOptions = {}): XapiValidator {
  const roots = schemaBundle?.roots ?? {};
  const localPaths: Record<XapiKind, Set<string>> = {
    Command: new Set(localCommandPaths),
    Status: new Set(localStatusPaths),
    Event: new Set(localEventPaths),
    Config: new Set(localConfigPaths),
  };

  function validatePath(
    kind: XapiKind,
    root: XapiSchemaNode | null | undefined,
    path: string,
    validateNode: (node: XapiSchemaNode) => string[],
  ): XapiValidationResult {
    if (!root) {
      return { ok: true, node: null, errors: [] };
    }

    const node = findNodeByPath(root, path);
    if (!node) {
      if (localPaths[kind].has(path)) {
        return { ok: true, node: null, errors: [] };
      }
      return {
        ok: false,
        node: null,
        errors: [
          `${formatPath(kind, path)} is not available in schema ${schemaBundle?.schemaName ?? ""}.`,
        ],
      };
    }

    const errors = [
      ...validateProductSupport(node, productId, productName, kind, path),
      ...validateNode(node),
    ];

    return { ok: errors.length === 0, node, errors };
  }

  return {
    validateCommand(path, payload) {
      return validatePath("Command", roots.commandRoot, path, (node) =>
        validateCommandPayload(node, payload, path),
      );
    },
    validateStatus(path) {
      return validatePath("Status", roots.statusRoot, path, () => []);
    },
    validateEvent(path) {
      return validatePath("Event", roots.eventRoot, path, () => []);
    },
    validateConfig(path, value) {
      return validatePath("Config", roots.configRoot, path, (node) =>
        value === undefined ? [] : validateValue(formatPath("Config", path), value, node.valuespace ?? null),
      );
    },
  };
}

export type { XapiSchemaBundle };
