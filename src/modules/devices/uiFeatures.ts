import { findNodeByPath, splitXapiPath, type SchemaPath, type XapiSchemaNode } from "../xapi/schema.ts";
import type { DeviceConfig } from "../types.ts";

/** Every `UserInterface Features` configuration lives under this branch. */
export const UI_FEATURES_ROOT = "UserInterface.Features";

/** Removes every default button at once, independent of the per-feature paths. */
export const UI_FEATURE_HIDE_ALL_PATH = "UserInterface.Features.HideAll";

/**
 * The configuration paths that gate each native home screen button.
 *
 * A button appears when *any* of its paths is enabled. That is how RoomOS shows
 * a single Microsoft Teams button for either of the two join routes: CVI ships
 * hidden by default while direct guest join ships as `Auto`.
 */
const NATIVE_ACTION_FEATURE_PATHS: Record<string, string[]> = {
  "native-call": ["UserInterface.Features.Call.Start"],
  "native-whiteboard": ["UserInterface.Features.Whiteboard.Start"],
  "native-share": ["UserInterface.Features.Share.Start"],
  "native-webex": ["UserInterface.Features.Call.JoinWebex"],
  "native-zoom": ["UserInterface.Features.Call.JoinZoom"],
  "native-microsoft-teams": [
    "UserInterface.Features.Call.JoinMicrosoftTeamsCVI",
    "UserInterface.Features.Call.JoinMicrosoftTeamsDirectGuestJoin",
  ],
  "native-google-meet": ["UserInterface.Features.Call.JoinGoogleMeet"],
};

/** Canonical dotted key so `UserInterface Features ...` and dotted paths agree. */
export function toConfigKey(path: SchemaPath): string {
  return splitXapiPath(path).join(".");
}

function readValue(config: DeviceConfig | undefined, path: string): string | null {
  const value = config?.[toConfigKey(path)];
  if (value === undefined || value === null) {
    return null;
  }
  return String(value).trim().toLowerCase();
}

/**
 * Whether a single feature path is enabled. RoomOS only removes a button for the
 * literal `Hidden`; every other value (`Auto`, `Enabled`, `On`, ...) shows it.
 *
 * An unset path counts as enabled: defaults are seeded from the schema, so a
 * missing key means the schema has no opinion rather than "hide this".
 */
export function isFeatureEnabled(config: DeviceConfig | undefined, path: string): boolean {
  return readValue(config, path) !== "hidden";
}

export function isHideAllEnabled(config: DeviceConfig | undefined): boolean {
  return readValue(config, UI_FEATURE_HIDE_ALL_PATH) === "true";
}

export function isNativeActionVisible(
  config: DeviceConfig | undefined,
  actionId: string,
): boolean {
  if (isHideAllEnabled(config)) {
    return false;
  }

  const paths = NATIVE_ACTION_FEATURE_PATHS[actionId];
  if (!paths) {
    // Buttons without a matching configuration are always on screen.
    return true;
  }

  return paths.some((path) => isFeatureEnabled(config, path));
}

export function getVisibleNativeActions<T extends { id: string }>(
  actions: T[],
  config: DeviceConfig | undefined,
): T[] {
  return actions.filter((action) => isNativeActionVisible(config, action.id));
}

/**
 * Reads the initial state for every `UserInterface Features` leaf out of the
 * schema, so the simulator starts where a factory RoomOS device would.
 */
export function collectUiFeatureDefaults(
  configRoot: XapiSchemaNode | null | undefined,
): Record<string, string> {
  const defaults: Record<string, string> = {};

  function walk(node: XapiSchemaNode, path: string[]): void {
    if (node.leaf && node.defaultValue !== undefined) {
      defaults[path.join(".")] = node.defaultValue;
    }

    for (const [name, child] of Object.entries(node.children)) {
      walk(child, [...path, name]);
    }
  }

  const root = findNodeByPath(configRoot, UI_FEATURES_ROOT);
  if (root) {
    walk(root, splitXapiPath(UI_FEATURES_ROOT));
  }

  return defaults;
}

/**
 * Fills in any feature default the device does not carry yet, replacing
 * `device.config` so React surfaces notice. Existing entries win, so a
 * background schema refresh never overwrites a change a macro already made.
 *
 * Returns whether anything was added, letting callers skip a repaint.
 */
export function applyUiFeatureDefaults(
  device: { config?: DeviceConfig },
  configRoot: XapiSchemaNode | null | undefined,
): boolean {
  const config: DeviceConfig = { ...device.config };
  let changed = false;

  for (const [path, value] of Object.entries(collectUiFeatureDefaults(configRoot))) {
    if (!(path in config)) {
      config[path] = value;
      changed = true;
    }
  }

  if (changed || !device.config) {
    device.config = config;
  }

  return changed;
}
