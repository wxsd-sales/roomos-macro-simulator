import { createDefaultDeviceState } from "../devices/DeviceRuntime.ts";
import type { DeviceFixture } from "../types.ts";

export function createDefaultDeviceFixture(): DeviceFixture {
  return {
    id: "board-pro-roomos-default",
    productId: "polaris",
    productName: "Desk Pro",
    mode: "roomos",
    surfaces: ["osd", "controller", "scheduler"],
    state: createDefaultDeviceState(),
  };
}
