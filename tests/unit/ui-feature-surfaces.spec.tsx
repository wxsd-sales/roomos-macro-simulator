import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ControllerSurface } from "../../src/features/device/surfaces/ControllerSurface.tsx";
import { OsdSurface } from "../../src/features/device/surfaces/OsdSurface.tsx";
import { createDefaultDeviceState } from "../../src/modules/devices/index.ts";
import { collectUiFeatureDefaults } from "../../src/modules/devices/uiFeatures.ts";
import { buildSchemaRoots } from "../../src/modules/xapi/schema.ts";
import type { DeviceConfig, DevicePanel, DeviceState } from "../../src/modules/types.ts";
import pinnedSchema from "../../src/modules/xapi/pinnedSchema.json" with { type: "json" };

const SCHEMA_DEFAULTS = collectUiFeatureDefaults(buildSchemaRoots(pinnedSchema).configRoot);

const CALL_START = "UserInterface.Features.Call.Start";
const SHARE_START = "UserInterface.Features.Share.Start";
const WHITEBOARD_START = "UserInterface.Features.Whiteboard.Start";
const HIDE_ALL = "UserInterface.Features.HideAll";
const JOIN_ZOOM = "UserInterface.Features.Call.JoinZoom";

const CUSTOM_PANEL: DevicePanel = {
  id: "lights",
  name: "Toggle Lights",
  activityType: "Custom",
  location: "HomeScreen",
};

function createDevice(config: DeviceConfig = {}, panels: DevicePanel[] = []): DeviceState {
  return {
    ...createDefaultDeviceState(),
    panels,
    config: { ...SCHEMA_DEFAULTS, ...config },
  };
}

function osdActionIds(device: DeviceState): string[] {
  const { container } = render(<OsdSurface device={device} onSelectPanel={() => {}} />);
  return [...container.querySelectorAll("[data-osd-action]")].map(
    (node) => node.getAttribute("data-osd-action") ?? "",
  );
}

function controllerActionIds(device: DeviceState): string[] {
  const { container } = render(
    <ControllerSurface device={device} onSelectPanel={() => {}} onDismissAlert={() => {}} />,
  );
  return [...container.querySelectorAll("[data-controller-action]")].map(
    (node) => node.getAttribute("data-controller-action") ?? "",
  );
}

describe("schema defaults drive the initial buttons", () => {
  it("shows the same buttons on both surfaces, minus whiteboarding on the Controller", () => {
    const device = createDevice();

    expect(osdActionIds(device)).toEqual([
      "native-call",
      "native-whiteboard",
      "native-share",
      "native-webex",
      "native-microsoft-teams",
      "native-google-meet",
    ]);
    expect(controllerActionIds(device)).toEqual(
      osdActionIds(device).filter((id) => id !== "native-whiteboard"),
    );
  });

  it("leaves Zoom off screen because the schema ships JoinZoom as Hidden", () => {
    const device = createDevice();

    expect(osdActionIds(device)).not.toContain("native-zoom");
    expect(controllerActionIds(device)).not.toContain("native-zoom");
  });

  it("reveals Zoom on both surfaces once JoinZoom is Auto", () => {
    const device = createDevice({ [JOIN_ZOOM]: "Auto" });

    expect(osdActionIds(device)).toContain("native-zoom");
    expect(controllerActionIds(device)).toContain("native-zoom");
  });
});

describe("hiding a feature from a macro", () => {
  it("removes the call button from both surfaces", () => {
    const device = createDevice({ [CALL_START]: "Hidden" });

    expect(osdActionIds(device)).not.toContain("native-call");
    expect(controllerActionIds(device)).not.toContain("native-call");
  });

  it("removes the share button from both surfaces", () => {
    const device = createDevice({ [SHARE_START]: "Hidden" });

    expect(osdActionIds(device)).not.toContain("native-share");
    expect(controllerActionIds(device)).not.toContain("native-share");
  });

  it("removes the whiteboard button from the OSD", () => {
    const device = createDevice({ [WHITEBOARD_START]: "Hidden" });

    expect(osdActionIds(device)).not.toContain("native-whiteboard");
  });

  it("puts a button back when the value returns to Auto", () => {
    expect(osdActionIds(createDevice({ [CALL_START]: "Auto" }))).toContain("native-call");
  });
});

describe("HideAll", () => {
  it("clears the native buttons but keeps UI extension panels", () => {
    const device = createDevice({ [HIDE_ALL]: "True" }, [CUSTOM_PANEL]);

    expect(osdActionIds(device)).toEqual(["lights"]);
    expect(controllerActionIds(device)).toEqual(["lights"]);
  });
});
