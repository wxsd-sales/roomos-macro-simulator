import { useMemo } from "react";
import type { DeviceState } from "../../../modules/types.ts";
import {
  getSurfaceActionFromPanel,
  type SurfaceAction,
} from "../../../modules/devices/surfaceActionButtons.ts";
import { Icon } from "../../../components/Icon.tsx";
import { RoundActionIcon } from "./RoundActionIcon.tsx";

interface SchedulerSurfaceProps {
  device: DeviceState;
}

function formatSchedulerTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSchedulerCustomAction(device: DeviceState): SurfaceAction {
  const panel =
    device.panels.find((entry) => String(entry.location ?? "").trim().toLowerCase() === "homescreen") ??
    device.panels[0];

  return panel
    ? getSurfaceActionFromPanel(panel, 0)
    : {
        id: "scheduler-custom",
        label: "Custom button",
        activityType: "Custom",
      };
}

export function SchedulerSurface({ device }: SchedulerSurfaceProps) {
  const now = new Date();
  const customAction = useMemo(() => getSchedulerCustomAction(device), [device]);

  return (
    <div className="device-card scheduler-card">
      <div className="scheduler-home">
        <div className="scheduler-stage">
          <div className="scheduler-layout">
            <div className="scheduler-left-column">
              <div className="scheduler-room-panel">
                <div className="scheduler-room-icon" aria-hidden="true">
                  <Icon name="icon-webex-teams-regular" />
                </div>
                <div className="scheduler-device-name-row">
                  <div data-scheduler-device-name className="scheduler-device-name">
                    {device.workspaceName ?? "Workspace Name"}
                  </div>
                </div>
              </div>

              <div className="scheduler-custom-panel">
                <button className="scheduler-custom-tile" type="button">
                  <span data-scheduler-custom-icon className="scheduler-custom-icon" aria-hidden="true">
                    <RoundActionIcon
                      action={customAction}
                      imageClass="scheduler-action-image"
                      brandImageClass="scheduler-brand-action-image"
                      customImageClass="surface-custom-action-image"
                    />
                  </span>
                  <span data-scheduler-custom-label className="scheduler-custom-label">
                    {customAction.label}
                  </span>
                </button>
              </div>
            </div>

            <div className="scheduler-right-column">
              <div data-scheduler-system-top className="scheduler-system-top">
                {formatSchedulerTime(now)}
              </div>
              <div className="scheduler-availability-panel">
                <div data-booking-state className="scheduler-availability-text">
                  {device.scheduler?.busy ? "Busy" : "Available"}
                </div>
                <div className="scheduler-action-stack">
                  <button className="scheduler-primary-action" type="button">
                    <Icon name="icon-calendar-add-regular" />
                    <span>Book room</span>
                  </button>
                  <button className="scheduler-secondary-action" type="button">
                    <Icon name="icon-calendar-empty-regular" />
                    <span>Room calendar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
