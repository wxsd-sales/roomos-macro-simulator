import { describe, expect, it } from "vitest";
import {
  DEFAULT_PANEL_LOCATION,
  getPanelLocation,
  getPanelsForSurface,
  isLocationVisibleOnSurface,
  normalizePanelLocation,
  type PanelLocation,
} from "../../src/modules/devices/panelLocations.ts";
import type { DevicePanel, DeviceSurface } from "../../src/modules/types.ts";

function createPanel(location: string | undefined, id = "panel"): DevicePanel {
  return { id, name: id, activityType: "Custom", location };
}

describe("normalizePanelLocation", () => {
  it("accepts every RoomOS location regardless of casing", () => {
    expect(normalizePanelLocation("HomeScreen")).toBe("HomeScreen");
    expect(normalizePanelLocation("homescreen")).toBe("HomeScreen");
    expect(normalizePanelLocation("  CALLCONTROLS  ")).toBe("CallControls");
    expect(normalizePanelLocation("homescreenandcallcontrols")).toBe("HomeScreenAndCallControls");
    expect(normalizePanelLocation("ControlPanel")).toBe("ControlPanel");
    expect(normalizePanelLocation("roomscheduler")).toBe("RoomScheduler");
    expect(normalizePanelLocation("Hidden")).toBe("Hidden");
  });

  it("returns null for missing or unknown locations", () => {
    expect(normalizePanelLocation(undefined)).toBeNull();
    expect(normalizePanelLocation("")).toBeNull();
    expect(normalizePanelLocation("Sidebar")).toBeNull();
  });

  it("falls back to the home screen for panels without a usable location", () => {
    expect(getPanelLocation(createPanel(undefined))).toBe(DEFAULT_PANEL_LOCATION);
    expect(getPanelLocation(createPanel("Nonsense"))).toBe("HomeScreen");
    expect(getPanelLocation(createPanel("RoomScheduler"))).toBe("RoomScheduler");
  });
});

describe("location visibility per surface", () => {
  const cases: Array<{
    location: PanelLocation;
    outOfCall: DeviceSurface[];
    inCall: DeviceSurface[];
  }> = [
    { location: "HomeScreen", outOfCall: ["osd", "controller"], inCall: [] },
    { location: "CallControls", outOfCall: [], inCall: ["osd", "controller"] },
    {
      location: "HomeScreenAndCallControls",
      outOfCall: ["osd", "controller"],
      inCall: ["osd", "controller"],
    },
    { location: "RoomScheduler", outOfCall: ["scheduler"], inCall: ["scheduler"] },
    // The slide-out drawer is not simulated yet.
    { location: "ControlPanel", outOfCall: [], inCall: [] },
    { location: "Hidden", outOfCall: [], inCall: [] },
  ];

  const surfaces: DeviceSurface[] = ["osd", "controller", "scheduler"];

  it.each(cases)("$location renders on the expected surfaces", ({ location, outOfCall, inCall }) => {
    for (const surface of surfaces) {
      expect(isLocationVisibleOnSurface(location, surface, { inCall: false })).toBe(
        outOfCall.includes(surface),
      );
      expect(isLocationVisibleOnSurface(location, surface, { inCall: true })).toBe(
        inCall.includes(surface),
      );
    }
  });
});

describe("getPanelsForSurface", () => {
  const panels = [
    createPanel("HomeScreen", "home"),
    createPanel("CallControls", "call"),
    createPanel("HomeScreenAndCallControls", "both"),
    createPanel("ControlPanel", "drawer"),
    createPanel("RoomScheduler", "scheduler"),
    createPanel("Hidden", "hidden"),
  ];

  function idsFor(surface: DeviceSurface, inCall: boolean): string[] {
    return getPanelsForSurface(panels, surface, { inCall }).map((panel) => panel.id);
  }

  it("shows home screen panels out of call and call controls in call", () => {
    expect(idsFor("osd", false)).toEqual(["home", "both"]);
    expect(idsFor("controller", false)).toEqual(["home", "both"]);
    expect(idsFor("osd", true)).toEqual(["call", "both"]);
    expect(idsFor("controller", true)).toEqual(["call", "both"]);
  });

  it("only shows RoomScheduler panels on the scheduler", () => {
    expect(idsFor("scheduler", false)).toEqual(["scheduler"]);
    expect(idsFor("scheduler", true)).toEqual(["scheduler"]);
  });

  it("never renders Hidden or ControlPanel panels", () => {
    const everywhere = [
      ...idsFor("osd", false),
      ...idsFor("osd", true),
      ...idsFor("controller", false),
      ...idsFor("controller", true),
      ...idsFor("scheduler", false),
    ];

    expect(everywhere).not.toContain("hidden");
    expect(everywhere).not.toContain("drawer");
  });

  it("tolerates an empty panel list", () => {
    expect(getPanelsForSurface(undefined, "osd", { inCall: false })).toEqual([]);
  });
});
