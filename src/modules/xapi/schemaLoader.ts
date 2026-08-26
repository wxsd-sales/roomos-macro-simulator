import { compactSchemaPayload } from "./compactSchema.ts";
import { buildSchemaRoots, fetchLatestXapiSchema, isPlainObject } from "./schema.ts";
import type { XapiSchemaBundle } from "./schema.ts";

const CACHE_KEY = "roomos-macro-simulator.xapi-schema.v1";

interface CachedSchema {
  schemaName: string;
  payload: unknown;
}

export interface LoadXapiSchemaOptions {
  /**
   * Invoked when a newer schema arrives from Cisco after the initial bundle
   * has already been handed back, so callers can re-register declarations.
   */
  onRefresh?: (bundle: XapiSchemaBundle) => void;
  onError?: (error: unknown) => void;
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Storage access throws in some privacy modes.
    return null;
  }
}

function readCache(): CachedSchema | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed) || typeof parsed.schemaName !== "string" || !parsed.payload) {
      return null;
    }
    return { schemaName: parsed.schemaName, payload: parsed.payload };
  } catch {
    return null;
  }
}

function writeCache(schemaName: string, payload: unknown): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(CACHE_KEY, JSON.stringify({ schemaName, payload }));
  } catch {
    // Quota exceeded or storage disabled; the pinned schema remains the fallback.
  }
}

async function loadPinnedSchema(): Promise<CachedSchema> {
  const module = await import("./pinnedSchema.json");
  const payload = (module.default ?? module) as { version?: string };
  return { schemaName: payload.version ?? "pinned", payload };
}

function toBundle({ schemaName, payload }: CachedSchema): XapiSchemaBundle {
  return { schemaName, roots: buildSchemaRoots(payload) };
}

/**
 * Resolves a usable schema immediately from cache or the vendored copy, then
 * refreshes from Cisco in the background. IntelliSense therefore works
 * offline, on a cold cache, and behind a blocked network.
 */
export async function loadXapiSchema({
  onRefresh,
  onError,
}: LoadXapiSchemaOptions = {}): Promise<XapiSchemaBundle> {
  const cached = readCache();
  const local = cached ?? (await loadPinnedSchema());
  const bundle = toBundle(local);

  void refreshFromNetwork(local.schemaName, onRefresh, onError);

  return bundle;
}

async function refreshFromNetwork(
  currentSchemaName: string,
  onRefresh: LoadXapiSchemaOptions["onRefresh"],
  onError: LoadXapiSchemaOptions["onError"],
): Promise<void> {
  try {
    const { schemaName, payload } = await fetchLatestXapiSchema();
    if (schemaName === currentSchemaName) {
      return;
    }

    writeCache(schemaName, compactSchemaPayload(payload, schemaName));
    onRefresh?.({ schemaName, roots: buildSchemaRoots(payload) });
  } catch (error) {
    onError?.(error);
  }
}
