import { describe, expect, it } from "vitest";
import { createAppState } from "../../src/modules/app/index.ts";
import { createDeviceInstance, createDeviceRuntime } from "../../src/modules/devices/index.ts";
import { createDefaultDeviceFixture } from "../../src/modules/fixtures/index.ts";
import { MEETING_JOIN_STATES, MEETING_PROVIDERS } from "../../src/modules/meetings/index.ts";

describe("device runtime", () => {
  it("keeps default device state and partial fixture overrides together", () => {
    const runtime = createDeviceRuntime({
      initialState: {
        workspaceName: "Board Pro",
        scheduler: {
          busy: true,
        },
        meeting: {
          provider: MEETING_PROVIDERS.microsoftTeams,
          joinState: MEETING_JOIN_STATES.scheduled,
        },
      },
    });

    expect(runtime.getState()).toMatchObject({
      workspaceName: "Board Pro",
      scheduler: {
        busy: true,
        title: "Focus Room 3A",
      },
      meeting: {
        provider: MEETING_PROVIDERS.microsoftTeams,
        joinState: MEETING_JOIN_STATES.scheduled,
      },
    });
  });

  it("creates a device instance from the default fixture", () => {
    const fixture = createDefaultDeviceFixture();
    const device = createDeviceInstance({
      id: fixture.id,
      productId: fixture.productId,
      productName: fixture.productName,
      mode: fixture.mode,
      surfaces: fixture.surfaces,
      initialState: fixture.state,
    });

    expect(device.getSnapshot()).toMatchObject({
      id: "board-pro-roomos-default",
      profile: {
        productName: "Desk Pro",
        surfaces: ["osd", "controller", "scheduler"],
      },
      state: {
        activePanel: "Home",
      },
    });
  });

  it("creates app state around the active device state", () => {
    const deviceState = createDeviceRuntime().getState();
    const appState = createAppState({ device: deviceState });

    expect(appState.device).toBe(deviceState);
    expect(appState.files).toEqual([]);
    expect(appState.logSeverityLevels.has("error")).toBe(true);
  });
});
