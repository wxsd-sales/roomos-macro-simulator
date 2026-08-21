import { createDeviceInstance } from "../../modules/devices/index.ts";
import { createDefaultDeviceFixture } from "../../modules/fixtures/index.ts";
import type { DeviceState } from "../../modules/types.ts";

const defaultDeviceFixture = createDefaultDeviceFixture();

export const simulatorDevice = createDeviceInstance({
  id: defaultDeviceFixture.id,
  productId: defaultDeviceFixture.productId,
  productName: defaultDeviceFixture.productName,
  mode: defaultDeviceFixture.mode,
  surfaces: defaultDeviceFixture.surfaces,
  initialState: defaultDeviceFixture.state,
});

export const simulatorDeviceRuntime = simulatorDevice.runtime;

export const initialDeviceState: DeviceState = simulatorDeviceRuntime.getState();
