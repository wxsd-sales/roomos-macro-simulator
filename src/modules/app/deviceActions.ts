import type { AddLog, DeviceRuntime, DeviceState, RenderDevice } from "../types.ts";

export interface DeviceActions {
  dismissAlert(): void;
  selectPanel(panel: string): void;
  reset(): void;
}

interface CreateDeviceActionsOptions {
  deviceRuntime: DeviceRuntime;
  addLog: AddLog;
  renderDevice: RenderDevice;
  onDeviceChange?: (device: DeviceState) => void;
}

export function createDeviceActions({
  deviceRuntime,
  addLog,
  renderDevice,
  onDeviceChange = () => {},
}: CreateDeviceActionsOptions): DeviceActions {
  function commitDeviceChange(device: DeviceState): void {
    onDeviceChange(device);
    renderDevice();
  }

  return {
    dismissAlert() {
      const device = deviceRuntime.update((nextDevice) => {
        nextDevice.alert = null;
      });
      addLog("Dismissed active alert.", "success");
      commitDeviceChange(device);
    },
    selectPanel(panel) {
      const device = deviceRuntime.update((nextDevice) => {
        nextDevice.activePanel = panel;
      });
      addLog(`Switched visible device surface to ${panel}.`, "success");
      commitDeviceChange(device);
    },
    reset() {
      const device = deviceRuntime.reset();
      addLog("Simulator state reset.", "success");
      commitDeviceChange(device);
    },
  };
}
