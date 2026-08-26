import type {
  SchemaRoots,
  XapiKind,
  XapiPayloadField,
  XapiSchemaNode,
  XapiValuespace,
} from "../xapi/schema.ts";

const ROOT_INTERFACE: Record<XapiKind, string> = {
  Command: "XCommand",
  Status: "XStatus",
  Config: "XConfig",
  Event: "XEvent",
};

/**
 * Allocates unique, syntactically valid interface names. Path segments are
 * already identifier-safe for commands and events, but statuses and configs
 * can collide once indexed brackets are stripped.
 */
function createNameAllocator() {
  const used = new Set<string>();

  return function allocate(parent: string, segment: string): string {
    const base = `${parent}_${segment.replace(/[^\w$]/g, "_")}`;
    if (!used.has(base)) {
      used.add(base);
      return base;
    }

    let suffix = 2;
    while (used.has(`${base}$${suffix}`)) {
      suffix += 1;
    }
    const unique = `${base}$${suffix}`;
    used.add(unique);
    return unique;
  };
}

function propertyKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function jsDoc(lines: string[], indent: string): string {
  const cleaned = lines
    .flatMap((line) => String(line ?? "").split("\n"))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\*\//g, "*\u2044"));

  if (!cleaned.length) {
    return "";
  }

  return `${indent}/**\n${cleaned.map((line) => `${indent} * ${line}`).join("\n")}\n${indent} */\n`;
}

function literalUnion(values: string[]): string {
  return [...new Set(values)].map((value) => JSON.stringify(value)).join(" | ");
}

/** Maps a normalized valuespace onto a TypeScript type expression. */
export function valuespaceToType(valuespace: XapiValuespace | null | undefined): string {
  if (!valuespace) {
    return "unknown";
  }

  const type = valuespace.type.trim();
  const isArray = /array$/i.test(type);
  const base = isArray ? type.slice(0, -"array".length) : type;

  let rendered: string;
  if (valuespace.Values?.length) {
    rendered = literalUnion(valuespace.Values);
  } else if (/^(integer|int|float|number)$/i.test(base)) {
    rendered = "number";
  } else if (/^(string|literal)$/i.test(base)) {
    rendered = "string";
  } else if (/^(boolean|bool)$/i.test(base)) {
    rendered = "boolean";
  } else {
    rendered = "unknown";
  }

  if (!isArray) {
    return rendered;
  }

  return rendered.includes("|") ? `(${rendered})[]` : `${rendered}[]`;
}

function renderPayloadType(
  fields: Record<string, XapiPayloadField> | undefined,
  indent: string,
): string {
  if (!fields || !Object.keys(fields).length) {
    return "Record<string, unknown>";
  }

  const inner = `${indent}  `;
  const lines = Object.entries(fields).map(([name, field]) => {
    const base = field.children
      ? renderPayloadType(field.children, inner)
      : valuespaceToType(field.valuespace);
    const type = field.multiple ? (base.includes("|") ? `(${base})[]` : `${base}[]`) : base;
    return `${inner}${propertyKey(name)}${field.required ? "" : "?"}: ${type};`;
  });

  return `{\n${lines.join("\n")}\n${indent}}`;
}

interface EmitContext {
  kind: XapiKind;
  interfaces: string[];
  allocate: ReturnType<typeof createNameAllocator>;
}

function describeNode(node: XapiSchemaNode): string[] {
  const lines: string[] = [];
  if (node.description) {
    lines.push(node.description);
  }
  if (node.defaultValue !== undefined) {
    lines.push(`@default ${node.defaultValue}`);
  }
  return lines;
}

function renderCommandSignature(node: XapiSchemaNode, argsTypeName: string | null): string {
  if (!argsTypeName) {
    return "    (args?: Record<string, unknown>, body?: string, ...rest: unknown[]): Promise<any>;";
  }
  const required = Object.values(node.params ?? {}).some((param) => param.required);
  return `    (args${required ? "" : "?"}: ${argsTypeName}, body?: string, ...rest: unknown[]): Promise<any>;`;
}

function emitCommandArgs(node: XapiSchemaNode, name: string, context: EmitContext): string | null {
  const params = Object.values(node.params ?? {});
  if (!params.length) {
    return null;
  }

  const typeName = `${name}Args`;
  const lines = params.map((param) => {
    const doc = jsDoc(param.description ? [param.description] : [], "    ");
    return `${doc}    ${propertyKey(param.name)}${param.required ? "" : "?"}: ${valuespaceToType(param.valuespace)};`;
  });

  context.interfaces.push(`  interface ${typeName} {\n${lines.join("\n")}\n  }`);
  return typeName;
}

/**
 * Accessors a node exposes itself, as opposed to its child paths.
 *
 * Only commands are restricted to leaves: invoking a branch is meaningless,
 * whereas RoomOS genuinely supports reading or subscribing to a branch — for
 * example `xapi.Status.Call.get()` returns every active call.
 */
function ownMembers(node: XapiSchemaNode, name: string, context: EmitContext): string[] {
  const isLeaf = node.leaf;
  const valueType = isLeaf ? valuespaceToType(node.valuespace) : "any";
  const reserved = (member: string) => !(member in node.children);

  switch (context.kind) {
    case "Command":
      return isLeaf ? [renderCommandSignature(node, emitCommandArgs(node, name, context))] : [];
    case "Status":
      return [
        reserved("get") ? `    get(): Promise<${valueType}>;` : "",
        reserved("on") ? `    on(handler: (value: ${valueType}) => void): () => void;` : "",
        reserved("off") ? `    off(): void;` : "",
      ].filter(Boolean);
    case "Config":
      return [
        reserved("get") ? `    get(): Promise<${valueType}>;` : "",
        reserved("set") ? `    set(value: ${valueType}): Promise<any>;` : "",
        reserved("on") ? `    on(handler: (value: ${valueType}) => void): () => void;` : "",
      ].filter(Boolean);
    case "Event": {
      const payload = isLeaf ? renderPayloadType(node.payload, "    ") : "any";
      return [
        reserved("on") ? `    on(handler: (payload: ${payload}) => void): () => void;` : "",
        reserved("once") ? `    once(handler: (payload: ${payload}) => void): () => void;` : "",
      ].filter(Boolean);
    }
  }
}

/**
 * Emits one named interface per node and returns its name. Flat named
 * interfaces keep the type checker fast; a single deeply nested intersection
 * of this size is pathological for it.
 */
function emitNode(node: XapiSchemaNode, name: string, context: EmitContext): string {
  const members = [...ownMembers(node, name, context)];

  Object.entries(node.children).forEach(([segment, child]) => {
    const childName = context.allocate(name, segment);
    const childType = emitNode(child, childName, context);
    const rendered = child.indexed ? `XapiIndexed<${childType}>` : childType;
    members.push(`${jsDoc(describeNode(child), "    ")}    ${propertyKey(segment)}: ${rendered};`);
  });

  context.interfaces.push(
    members.length ? `  interface ${name} {\n${members.join("\n")}\n  }` : `  interface ${name} {}`,
  );

  return name;
}

function emitRoot(
  kind: XapiKind,
  root: XapiSchemaNode | null,
  interfaces: string[],
  allocate: ReturnType<typeof createNameAllocator>,
): string {
  const name = ROOT_INTERFACE[kind];
  if (!root) {
    interfaces.push(`  interface ${name} {}`);
    return name;
  }
  return emitNode(root, name, { kind, interfaces, allocate });
}

/**
 * Builds the ambient declaration text registered with Monaco.
 *
 * The result must stay a global script: a single top-level `import` or
 * `export` would re-scope the file as a module and silently drop the global
 * `xapi` binding, which is what macros rely on when they omit the
 * `import xapi from 'xapi'` line that the runtime strips anyway.
 */
export function buildXapiDeclarations(roots: SchemaRoots, schemaName: string): string {
  const interfaces: string[] = [];
  const allocate = createNameAllocator();

  const command = emitRoot("Command", roots.commandRoot, interfaces, allocate);
  const status = emitRoot("Status", roots.statusRoot, interfaces, allocate);
  const config = emitRoot("Config", roots.configRoot, interfaces, allocate);
  const event = emitRoot("Event", roots.eventRoot, interfaces, allocate);

  return `// Generated from the RoomOS xAPI schema "${schemaName}".
declare namespace XapiSchema {
  /** Indexed xAPI nodes such as \`Connector[n]\` accept a numeric index. */
  type XapiIndexed<T> = { [index: number]: T } & T;

${interfaces.join("\n")}

  interface Xapi {
    Command: ${command};
    Status: ${status} & {
      /** Reads a status by dotted or space separated path. */
      get(path: string): Promise<any>;
    };
    Config: ${config} & {
      /** Reads a configuration by dotted or space separated path. */
      get(path: string): Promise<any>;
      /** Writes a configuration by dotted or space separated path. */
      set(path: string, value: unknown): Promise<any>;
    };
    Event: ${event};
    /** Invokes a command by dotted or space separated path. */
    command(path: string, args?: Record<string, unknown>, body?: string): Promise<any>;
    /** Emits an event into the simulator. */
    emit(path: string, payload?: unknown): void;
  }
}

declare const xapi: XapiSchema.Xapi;

declare module "xapi" {
  const instance: XapiSchema.Xapi;
  export default instance;
}
`;
}
