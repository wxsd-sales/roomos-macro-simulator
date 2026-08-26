import type { DevicePanel, DeviceSurface } from "../types.ts";

/** The `<Location>` values RoomOS accepts for a UI extension panel. */
export type PanelLocation =
  | "HomeScreen"
  | "CallControls"
  | "HomeScreenAndCallControls"
  | "ControlPanel"
  | "RoomScheduler"
  | "Hidden";

export const PANEL_LOCATIONS: PanelLocation[] = [
  "HomeScreen",
  "CallControls",
  "HomeScreenAndCallControls",
  "ControlPanel",
  "RoomScheduler",
  "Hidden",
];

/** RoomOS falls back to the home screen when no location is supplied. */
export const DEFAULT_PANEL_LOCATION: PanelLocation = "HomeScreen";

const LOCATIONS_BY_TOKEN = new Map<string, PanelLocation>(
  PANEL_LOCATIONS.map((location) => [location.toLowerCase(), location]),
);

/**
 * Resolves a free-text `<Location>` value to its canonical form.
 * Returns null when the value is missing or not a RoomOS location, letting
 * callers decide whether to warn and fall back.
 */
export function normalizePanelLocation(value: unknown): PanelLocation | null {
  const token = String(value ?? "").trim().toLowerCase();
  return LOCATIONS_BY_TOKEN.get(token) ?? null;
}

export function getPanelLocation(panel: DevicePanel): PanelLocation {
  return normalizePanelLocation(panel.location) ?? DEFAULT_PANEL_LOCATION;
}

interface PanelVisibilityContext {
  /** Home-screen panels hide during a call; call-control panels only show in one. */
  inCall: boolean;
}

/**
 * Whether a panel in `location` renders on `surface` right now.
 *
 * `ControlPanel` panels live in a slide-out drawer on the OSD and Controller.
 * That drawer is not simulated yet, so they render nowhere for the moment.
 */
export function isLocationVisibleOnSurface(
  location: PanelLocation,
  surface: DeviceSurface,
  { inCall }: PanelVisibilityContext,
): boolean {
  if (location === "RoomScheduler") {
    return surface === "scheduler";
  }

  // Every other location targets the OSD and Controller only.
  if (surface === "scheduler") {
    return false;
  }

  switch (location) {
    case "HomeScreen":
      return !inCall;
    case "CallControls":
      return inCall;
    case "HomeScreenAndCallControls":
      return true;
    case "ControlPanel":
    case "Hidden":
      return false;
    default:
      return false;
  }
}

export function isPanelVisibleOnSurface(
  panel: DevicePanel,
  surface: DeviceSurface,
  context: PanelVisibilityContext,
): boolean {
  return isLocationVisibleOnSurface(getPanelLocation(panel), surface, context);
}

export function getPanelsForSurface(
  panels: DevicePanel[] = [],
  surface: DeviceSurface,
  context: PanelVisibilityContext,
): DevicePanel[] {
  return panels.filter((panel) => isPanelVisibleOnSurface(panel, surface, context));
}
