import type { DeviceState, DeviceSurface } from "../../../modules/types.ts";
import { ControllerSurface } from "./ControllerSurface.tsx";
import { OsdSurface } from "./OsdSurface.tsx";
import { SchedulerSurface } from "./SchedulerSurface.tsx";

interface DeviceStackProps {
  device: DeviceState;
  onSelectPanel(panelId: string, surface: DeviceSurface): void;
  onDismissAlert(): void;
}

export function DeviceStack({ device, onSelectPanel, onDismissAlert }: DeviceStackProps) {
  return (
    <div className="device-stack">
      <OsdSurface device={device} onSelectPanel={onSelectPanel} />
      <ControllerSurface
        device={device}
        onSelectPanel={onSelectPanel}
        onDismissAlert={onDismissAlert}
      />
      <SchedulerSurface device={device} />
    </div>
  );
}
