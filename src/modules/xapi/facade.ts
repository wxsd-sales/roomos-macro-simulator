import { applyUiFeatureDefaults, toConfigKey } from "../devices/uiFeatures.ts";
import type { AddLog, DeviceState, RenderDevice } from "../types.ts";
import { createBookingsCommandHandler } from "./commands/bookings.ts";
import { createCallCommandHandler } from "./commands/call.ts";
import {
  PANEL_COMMAND_PATHS,
  PANEL_EVENT_PATHS,
  createPanelCommandHandler,
} from "./commands/userInterface/extensions/panel.ts";
import { findNodeByPath } from "./schema.ts";
import type { SchemaRoots } from "./schema.ts";
import { createXapiValidator } from "./validator.ts";

type XapiCallback = (payload: unknown) => void;
type Unsubscribe = () => void;
type XapiPayload = Record<string, any>;
type XapiProxy = any;

interface XapiSchemaBundle {
  schemaName?: string;
  roots?: Partial<SchemaRoots>;
}

interface CreateXapiFacadeOptions {
  device: DeviceState;
  addLog: AddLog;
  renderDevice: RenderDevice;
  schemaBundle?: XapiSchemaBundle | null;
  productId?: string | null;
  productName?: string | null;
}

interface XapiCommandHandler {
  canHandle(path: string): boolean;
  handle(path: string, args: unknown[]): unknown;
  getStatus?(path: string): unknown;
}

export interface XapiFacade {
  Command: XapiProxy;
  Event: XapiProxy;
  Status: XapiProxy;
  Config: XapiProxy;
  command(path: string, ...args: unknown[]): Promise<unknown>;
  emit(path: string, payload: unknown): void;
}

const SIMULATOR_COMMAND_PATHS = new Set([...PANEL_COMMAND_PATHS]);
const SIMULATOR_EVENT_PATHS = new Set([...PANEL_EVENT_PATHS]);
const SIMULATOR_STATUS_PATHS = new Set([
  "RoomScheduler.State",
  "UserInterface.Extensions.ActivePanel",
]);

function toPayload(value: unknown): XapiPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as XapiPayload : {};
}

function createCommandProxy(
  pathParts: string[],
  executor: (path: string, args: unknown[]) => Promise<unknown>,
): XapiProxy {
  return new Proxy(() => {}, {
    get(_, property) {
      if (typeof property === "symbol") {
        return undefined;
      }
      return createCommandProxy([...pathParts, property], executor);
    },
    apply(_, __, args) {
      const path = pathParts.join(".");
      return executor(path, args);
    },
  });
}

function createEventProxy(
  pathParts: string[],
  register: (path: string, callback: XapiCallback) => Unsubscribe,
): XapiProxy {
  return new Proxy(
    {},
    {
      get(_, property) {
        if (typeof property === "symbol") {
          return undefined;
        }
        if (property === "on") {
          return (callback: XapiCallback) => register(pathParts.join("."), callback);
        }
        return createEventProxy([...pathParts, property], register);
      },
    },
  );
}

function createStatusProxy(
  pathParts: string[],
  getter: (path: string) => Promise<unknown>,
  register: (path: string, callback: XapiCallback) => Unsubscribe,
): XapiProxy {
  return new Proxy(
    {},
    {
      get(_, property) {
        if (typeof property === "symbol") {
          return undefined;
        }
        if (property === "get") {
          return pathParts.length
            ? () => getter(pathParts.join("."))
            : (path: string) => getter(path);
        }
        if (property === "on") {
          return (callback: XapiCallback) => register(pathParts.join("."), callback);
        }
        return createStatusProxy([...pathParts, property], getter, register);
      },
    },
  );
}

function createConfigProxy(
  pathParts: string[],
  getter: (path: string) => Promise<unknown>,
  setter: (path: string, value: unknown) => Promise<unknown>,
  register: (path: string, callback: XapiCallback) => Unsubscribe,
): XapiProxy {
  return new Proxy(
    {},
    {
      get(_, property) {
        if (typeof property === "symbol") {
          return undefined;
        }
        if (property === "get") {
          return pathParts.length
            ? () => getter(pathParts.join("."))
            : (path: string) => getter(path);
        }
        if (property === "set") {
          return pathParts.length
            ? (value: unknown) => setter(pathParts.join("."), value)
            : (path: string, value: unknown) => setter(path, value);
        }
        if (property === "on") {
          return (callback: XapiCallback) => register(pathParts.join("."), callback);
        }
        return createConfigProxy([...pathParts, property], getter, setter, register);
      },
    },
  );
}

export function createXapiFacade({
  device,
  addLog,
  renderDevice,
  schemaBundle,
  productId,
  productName,
}: CreateXapiFacadeOptions): XapiFacade {
  const eventHandlers = new Map<string, XapiCallback[]>();
  const statusHandlers = new Map<string, XapiCallback[]>();
  const configHandlers = new Map<string, XapiCallback[]>();
  const configRoot = schemaBundle?.roots?.configRoot ?? null;

  // Configuration lives on the device so the surfaces can react to it, and it
  // starts from the schema defaults just like a factory RoomOS device.
  applyUiFeatureDefaults(device, configRoot);
  const validator = createXapiValidator({
    schemaBundle,
    productId,
    productName,
    localCommandPaths: SIMULATOR_COMMAND_PATHS,
    localStatusPaths: SIMULATOR_STATUS_PATHS,
    localEventPaths: SIMULATOR_EVENT_PATHS,
  });

  function logValidationErrors(errors: string[]): void {
    errors.forEach((error) => addLog(error, "error"));
  }

  function register(path: string, callback: XapiCallback): Unsubscribe {
    const validation = validator.validateEvent(path);
    if (!validation.ok) {
      logValidationErrors(validation.errors);
      return () => {};
    }

    if (!eventHandlers.has(path)) {
      eventHandlers.set(path, []);
    }
    eventHandlers.get(path)?.push(callback);
    addLog(`Registered handler for ${path}`, "success");

    return () => {
      const handlers = eventHandlers.get(path) ?? [];
      eventHandlers.set(path, handlers.filter((handler) => handler !== callback));
    };
  }

  function emit(path: string, payload: unknown): void {
    const handlers = eventHandlers.get(path) ?? [];
    handlers.forEach((handler) => handler(payload));
  }

  function registerStatus(path: string, callback: XapiCallback): Unsubscribe {
    const validation = validator.validateStatus(path);
    if (!validation.ok) {
      logValidationErrors(validation.errors);
      return () => {};
    }

    if (!statusHandlers.has(path)) {
      statusHandlers.set(path, []);
    }
    statusHandlers.get(path)?.push(callback);
    addLog(`Registered status listener for ${path}`, "success");

    return () => {
      const handlers = statusHandlers.get(path) ?? [];
      statusHandlers.set(path, handlers.filter((handler) => handler !== callback));
    };
  }

  function publishStatus(path: string, value: unknown): void {
    const handlers = statusHandlers.get(path) ?? [];
    handlers.forEach((handler) => handler(value));
  }

  function registerConfig(path: string, callback: XapiCallback): Unsubscribe {
    const validation = validator.validateConfig(path);
    if (!validation.ok) {
      logValidationErrors(validation.errors);
      return () => {};
    }

    if (!configHandlers.has(path)) {
      configHandlers.set(path, []);
    }
    configHandlers.get(path)?.push(callback);
    addLog(`Registered configuration listener for ${path}`, "success");

    return () => {
      const handlers = configHandlers.get(path) ?? [];
      configHandlers.set(path, handlers.filter((handler) => handler !== callback));
    };
  }

  function configGet(path: string): Promise<unknown> {
    addLog(`xapi.Config.${path}.get()`);
    const validation = validator.validateConfig(path);
    if (!validation.ok) {
      logValidationErrors(validation.errors);
      return Promise.reject(new Error(validation.errors.join(" ")));
    }

    const key = toConfigKey(path);
    if (key in device.config) {
      return Promise.resolve(device.config[key]);
    }

    // Fall back to the schema default so a read before any write is meaningful.
    const node = validation.node ?? findNodeByPath(configRoot, path);
    return Promise.resolve(node?.defaultValue ?? null);
  }

  function configSet(path: string, value: unknown): Promise<unknown> {
    addLog(`xapi.Config.${path}.set(${JSON.stringify(value)})`);
    const validation = validator.validateConfig(path, value);
    if (!validation.ok) {
      logValidationErrors(validation.errors);
      return Promise.reject(new Error(validation.errors.join(" ")));
    }

    // A fresh object so the React surfaces see the change.
    device.config = { ...device.config, [toConfigKey(path)]: value };
    (configHandlers.get(path) ?? []).forEach((handler) => handler(value));
    // A write can show or hide UI features, so repaint the simulated surfaces.
    renderDevice();
    return Promise.resolve({ ok: true });
  }

  const commandHandlers: XapiCommandHandler[] = [
    createBookingsCommandHandler({
      device,
      addLog,
      emitEvent: emit,
      publishStatus,
      renderDevice,
    }),
    createCallCommandHandler({
      device,
      addLog,
      publishStatus,
    }),
    createPanelCommandHandler({
      device,
      addLog,
      emitEvent: emit,
    }),
  ];

  function commandExecutor(path: string, args: unknown[] = []): Promise<unknown> {
    const payload = toPayload(args[0]);
    addLog(`xapi.Command.${path}(${args.map((arg) => JSON.stringify(arg)).join(", ")})`);
    const validation = validator.validateCommand(path, payload);
    if (!validation.ok) {
      logValidationErrors(validation.errors);
      return Promise.reject(new Error(validation.errors.join(" ")));
    }

    const handler = commandHandlers.find((entry) => entry.canHandle(path));
    if (handler) {
      const result = handler.handle(path, args);
      renderDevice();
      return Promise.resolve(result);
    }

    switch (path) {
      case "UserInterface.Message.Alert.Display":
        device.alert = {
          title: String(payload.Title ?? "Untitled alert"),
          text: String(payload.Text ?? "No message supplied."),
        };
        break;
      case "UserInterface.Message.Alert.Clear":
        device.alert = null;
        break;
      default:
        addLog(`No simulation mapping yet for xapi.Command.${path}`, "error");
    }

    renderDevice();
    return Promise.resolve({ ok: true });
  }

  function statusGet(path: string): Promise<unknown> {
    addLog(`xapi.Status.get(${path})`);
    const validation = validator.validateStatus(path);
    if (!validation.ok) {
      logValidationErrors(validation.errors);
      return Promise.reject(new Error(validation.errors.join(" ")));
    }

    const handledStatus = commandHandlers
      .map((handler) => handler.getStatus?.(path))
      .find((value) => value !== undefined);
    if (handledStatus !== undefined) {
      return Promise.resolve(handledStatus);
    }

    if (path === "UserInterface.Extensions.ActivePanel") {
      return Promise.resolve(device.activePanel);
    }
    if (path === "RoomScheduler.State") {
      return Promise.resolve(device.scheduler);
    }
    return Promise.resolve(null);
  }

  return {
    Command: createCommandProxy([], commandExecutor),
    Event: createEventProxy([], register),
    Status: createStatusProxy([], statusGet, registerStatus),
    Config: createConfigProxy([], configGet, configSet, registerConfig),
    command: (path, ...args) => commandExecutor(path, args),
    emit,
  };
}
