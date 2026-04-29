import { createDeviceRuntime } from "./DeviceRuntime.ts";
import type {
  DeviceInstance,
  DeviceProfile,
  DeviceStateOverrides,
  DeviceSurface,
} from "../types.ts";

interface CreateDeviceInstanceOptions {
  id?: string;
  productId?: string;
  productName?: string;
  mode?: string;
  surfaces?: DeviceSurface[];
  initialState?: DeviceStateOverrides;
}

export function createDeviceInstance({
  id = "primary-device",
  productId = "polaris",
  productName = "Desk Pro",
  mode = "roomos",
  surfaces = ["osd", "controller", "scheduler"],
  initialState,
}: CreateDeviceInstanceOptions = {}): DeviceInstance {
  const runtime = createDeviceRuntime({ initialState });
  const profile: DeviceProfile = {
    productId,
    productName,
    mode,
    surfaces: [...surfaces],
  };

  return {
    id,
    profile,
    runtime,
    getSnapshot() {
      return {
        id,
        profile,
        state: runtime.getState(),
      };
    },
  };
}
