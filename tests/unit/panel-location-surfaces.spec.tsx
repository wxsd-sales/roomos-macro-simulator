import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDefaultDeviceState } from "../../src/modules/devices/index.ts";
import { ControllerSurface } from "../../src/features/device/surfaces/ControllerSurface.tsx";
import { OsdSurface } from "../../src/features/device/surfaces/OsdSurface.tsx";
import { SchedulerSurface } from "../../src/features/device/surfaces/SchedulerSurface.tsx";
import type { DevicePanel, DeviceState } from "../../src/modules/types.ts";

function createPanel(location: string, id: string): DevicePanel {
  return { id, name: id, activityType: "Custom", location };
}

const PANELS = [
  createPanel("HomeScreen", "home-panel"),
  createPanel("CallControls", "call-panel"),
  createPanel("HomeScreenAndCallControls", "both-panel"),
  createPanel("ControlPanel", "drawer-panel"),
  createPanel("RoomScheduler", "scheduler-panel"),
  createPanel("Hidden", "hidden-panel"),
];

function createDevice(inCall: boolean, panels: DevicePanel[] = PANELS): DeviceState {
  return {
    ...createDefaultDeviceState(),
    panels,
    call: { active: inCall, remoteNumber: inCall ? "meet@example.com" : "" },
  };
}

function osdPanelIds(inCall: boolean): string[] {
  const { container } = render(<OsdSurface device={createDevice(inCall)} onSelectPanel={() => {}} />);
  return [...container.querySelectorAll("[data-osd-action]")]
    .map((node) => node.getAttribute("data-osd-action") ?? "")
    .filter((id) => !id.startsWith("native-"));
}

function controllerPanelIds(inCall: boolean): string[] {
  const { container } = render(
    <ControllerSurface
      device={createDevice(inCall)}
      onSelectPanel={() => {}}
      onDismissAlert={() => {}}
    />,
  );
  return [...container.querySelectorAll("[data-controller-action]")]
    .map((node) => node.getAttribute("data-controller-action") ?? "")
    .filter((id) => !id.startsWith("native-"));
}

describe("panel locations on the OSD", () => {
  it("shows home screen panels out of a call", () => {
    expect(osdPanelIds(false)).toEqual(["home-panel", "both-panel"]);
  });

  it("swaps to call control panels during a call", () => {
    expect(osdPanelIds(true)).toEqual(["call-panel", "both-panel"]);
  });
});

describe("panel locations on the Navigator", () => {
  it("shows home screen panels out of a call", () => {
    expect(controllerPanelIds(false)).toEqual(["home-panel", "both-panel"]);
  });

  it("swaps to call control panels during a call", () => {
    expect(controllerPanelIds(true)).toEqual(["call-panel", "both-panel"]);
  });
});

describe("panel locations on the Room Scheduler", () => {
  it("only renders the RoomScheduler panel", () => {
    const { container } = render(<SchedulerSurface device={createDevice(false)} />);

    expect(container.querySelector("[data-scheduler-custom-label]")?.textContent).toBe(
      "scheduler-panel",
    );
  });

  it("renders no custom tile when no RoomScheduler panel exists", () => {
    const device = createDevice(false, [createPanel("HomeScreen", "home-panel")]);
    const { container } = render(<SchedulerSurface device={device} />);

    expect(container.querySelector(".scheduler-custom-panel")).toBeNull();
  });
});
