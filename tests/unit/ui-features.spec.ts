import { describe, expect, it, vi } from "vitest";
import { createDefaultDeviceState } from "../../src/modules/devices/index.ts";
import {
  CONTROLLER_NATIVE_ACTIONS,
  OSD_NATIVE_ACTIONS,
} from "../../src/modules/devices/surfaceActionButtons.ts";
import {
  applyUiFeatureDefaults,
  collectUiFeatureDefaults,
  getVisibleNativeActions,
  isFeatureEnabled,
  isHideAllEnabled,
  isNativeActionVisible,
  toConfigKey,
} from "../../src/modules/devices/uiFeatures.ts";
import { createXapiFacade } from "../../src/modules/xapi/facade.ts";
import { buildSchemaRoots } from "../../src/modules/xapi/schema.ts";
import pinnedSchema from "../../src/modules/xapi/pinnedSchema.json" with { type: "json" };

const roots = buildSchemaRoots(pinnedSchema);

const CALL_START = "UserInterface.Features.Call.Start";
const HIDE_ALL = "UserInterface.Features.HideAll";
const JOIN_ZOOM = "UserInterface.Features.Call.JoinZoom";
const JOIN_TEAMS_CVI = "UserInterface.Features.Call.JoinMicrosoftTeamsCVI";
const JOIN_TEAMS_DIRECT = "UserInterface.Features.Call.JoinMicrosoftTeamsDirectGuestJoin";

function actionIds(actions: Array<{ id: string }>): string[] {
  return actions.map((action) => action.id);
}

describe("native action buttons", () => {
  it("offers the same buttons on the OSD and the Controller apart from whiteboarding", () => {
    expect(actionIds(OSD_NATIVE_ACTIONS)).toEqual([
      "native-call",
      "native-whiteboard",
      "native-share",
      "native-webex",
      "native-zoom",
      "native-microsoft-teams",
      "native-google-meet",
    ]);

    // Whiteboarding needs a touch screen, so the Controller drops just that one.
    expect(actionIds(CONTROLLER_NATIVE_ACTIONS)).toEqual(
      actionIds(OSD_NATIVE_ACTIONS).filter((id) => id !== "native-whiteboard"),
    );
  });
});

describe("toConfigKey", () => {
  it("normalizes space separated and dotted paths to one key", () => {
    expect(toConfigKey("UserInterface Features Call Start")).toBe(CALL_START);
    expect(toConfigKey(CALL_START)).toBe(CALL_START);
    expect(toConfigKey(["UserInterface", "Features", "Call", "Start"])).toBe(CALL_START);
  });
});

describe("isFeatureEnabled", () => {
  it("treats only Hidden as off, whatever the casing", () => {
    expect(isFeatureEnabled({ [CALL_START]: "Auto" }, CALL_START)).toBe(true);
    expect(isFeatureEnabled({ [CALL_START]: "Hidden" }, CALL_START)).toBe(false);
    expect(isFeatureEnabled({ [CALL_START]: "hidden" }, CALL_START)).toBe(false);
    expect(isFeatureEnabled({ [CALL_START]: " HIDDEN " }, CALL_START)).toBe(false);
  });

  it("treats an unset or empty path as enabled", () => {
    expect(isFeatureEnabled({}, CALL_START)).toBe(true);
    expect(isFeatureEnabled(undefined, CALL_START)).toBe(true);
    expect(isFeatureEnabled({ [CALL_START]: null }, CALL_START)).toBe(true);
  });

  it("accepts a space separated path", () => {
    expect(isFeatureEnabled({ [CALL_START]: "Hidden" }, "UserInterface Features Call Start")).toBe(
      false,
    );
  });
});

describe("isHideAllEnabled", () => {
  it("only removes the buttons for True", () => {
    expect(isHideAllEnabled({ [HIDE_ALL]: "True" })).toBe(true);
    expect(isHideAllEnabled({ [HIDE_ALL]: "False" })).toBe(false);
    expect(isHideAllEnabled({})).toBe(false);
  });
});

describe("isNativeActionVisible", () => {
  it("hides a button when its feature is Hidden", () => {
    expect(isNativeActionVisible({ [CALL_START]: "Hidden" }, "native-call")).toBe(false);
    expect(isNativeActionVisible({ [CALL_START]: "Auto" }, "native-call")).toBe(true);
  });

  it("keeps the Microsoft Teams button while either join route is enabled", () => {
    expect(
      isNativeActionVisible(
        { [JOIN_TEAMS_CVI]: "Hidden", [JOIN_TEAMS_DIRECT]: "Auto" },
        "native-microsoft-teams",
      ),
    ).toBe(true);
    expect(
      isNativeActionVisible(
        { [JOIN_TEAMS_CVI]: "Auto", [JOIN_TEAMS_DIRECT]: "Hidden" },
        "native-microsoft-teams",
      ),
    ).toBe(true);
    expect(
      isNativeActionVisible(
        { [JOIN_TEAMS_CVI]: "Hidden", [JOIN_TEAMS_DIRECT]: "Hidden" },
        "native-microsoft-teams",
      ),
    ).toBe(false);
  });

  it("hides every native button when HideAll is True", () => {
    const config = { [HIDE_ALL]: "True", [CALL_START]: "Auto" };

    expect(getVisibleNativeActions(OSD_NATIVE_ACTIONS, config)).toEqual([]);
  });

  it("shows buttons that no feature configuration governs", () => {
    expect(isNativeActionVisible({}, "panel-custom")).toBe(true);
  });
});

describe("collectUiFeatureDefaults", () => {
  it("reads the initial state out of the shipped schema", () => {
    const defaults = collectUiFeatureDefaults(roots.configRoot);

    expect(defaults[CALL_START]).toBe("Auto");
    expect(defaults["UserInterface.Features.Share.Start"]).toBe("Auto");
    expect(defaults["UserInterface.Features.Whiteboard.Start"]).toBe("Auto");
    expect(defaults[HIDE_ALL]).toBe("False");

    // RoomOS ships the Zoom and Teams CVI join buttons switched off.
    expect(defaults[JOIN_ZOOM]).toBe("Hidden");
    expect(defaults[JOIN_TEAMS_CVI]).toBe("Hidden");
    expect(defaults[JOIN_TEAMS_DIRECT]).toBe("Auto");
  });

  it("only collects UserInterface Features paths", () => {
    const paths = Object.keys(collectUiFeatureDefaults(roots.configRoot));

    expect(paths.length).toBeGreaterThan(20);
    expect(paths.every((path) => path.startsWith("UserInterface.Features."))).toBe(true);
  });

  it("returns nothing without a schema", () => {
    expect(collectUiFeatureDefaults(null)).toEqual({});
  });
});

describe("applyUiFeatureDefaults", () => {
  it("fills in the defaults and replaces config so React notices", () => {
    const device = createDefaultDeviceState();
    const before = device.config;

    expect(applyUiFeatureDefaults(device, roots.configRoot)).toBe(true);
    expect(device.config).not.toBe(before);
    expect(device.config[CALL_START]).toBe("Auto");
  });

  it("never overwrites a value a macro already set", () => {
    const device = createDefaultDeviceState();
    device.config = { [CALL_START]: "Hidden" };

    applyUiFeatureDefaults(device, roots.configRoot);

    expect(device.config[CALL_START]).toBe("Hidden");
    expect(device.config[HIDE_ALL]).toBe("False");
  });

  it("reports no change on a second pass", () => {
    const device = createDefaultDeviceState();
    applyUiFeatureDefaults(device, roots.configRoot);

    expect(applyUiFeatureDefaults(device, roots.configRoot)).toBe(false);
  });
});

describe("xapi.Config feature writes", () => {
  function createFacade() {
    const device = createDefaultDeviceState();
    const renderDevice = vi.fn();
    const xapi = createXapiFacade({
      device,
      addLog: () => {},
      renderDevice,
      schemaBundle: { schemaName: "pinned", roots },
      productId: null,
      productName: "",
    });

    return { device, renderDevice, xapi };
  }

  it("seeds the schema defaults onto the device when the facade is created", () => {
    const { device } = createFacade();

    expect(device.config[CALL_START]).toBe("Auto");
    expect(device.config[JOIN_ZOOM]).toBe("Hidden");
  });

  it("hides the call button when a macro sets Call.Start to Hidden", async () => {
    const { device, renderDevice, xapi } = createFacade();

    expect(isNativeActionVisible(device.config, "native-call")).toBe(true);

    await xapi.Config.UserInterface.Features.Call.Start.set("Hidden");

    expect(device.config[CALL_START]).toBe("Hidden");
    expect(isNativeActionVisible(device.config, "native-call")).toBe(false);
    // The surfaces only repaint when the runtime asks them to.
    expect(renderDevice).toHaveBeenCalled();
  });

  it("shows the Zoom button once a macro sets JoinZoom to Auto", async () => {
    const { device, xapi } = createFacade();

    expect(isNativeActionVisible(device.config, "native-zoom")).toBe(false);

    await xapi.Config.UserInterface.Features.Call.JoinZoom.set("Auto");

    expect(isNativeActionVisible(device.config, "native-zoom")).toBe(true);
  });

  it("rejects a value outside the valuespace and leaves the config alone", async () => {
    const { device, xapi } = createFacade();

    await expect(
      xapi.Config.UserInterface.Features.Call.Start.set("Invisible"),
    ).rejects.toThrow();
    expect(device.config[CALL_START]).toBe("Auto");
  });

  it("reads a feature back through the root level set and get", async () => {
    const { xapi } = createFacade();

    await xapi.Config.set("UserInterface Features Share Start", "Hidden");

    await expect(xapi.Config.UserInterface.Features.Share.Start.get()).resolves.toBe("Hidden");
  });
});
