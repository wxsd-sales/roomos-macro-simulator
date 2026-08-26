import { useMemo } from "react";
import type { DeviceState } from "../../../modules/types.ts";
import {
  describeBookingTiming,
  formatBookingRange,
  resolveRoomAvailability,
} from "../../../modules/bookings/availability.ts";
import { getPanelsForSurface } from "../../../modules/devices/panelLocations.ts";
import {
  getSurfaceActionFromPanel,
  type SurfaceAction,
} from "../../../modules/devices/surfaceActionButtons.ts";
import { Icon } from "../../../components/Icon.tsx";
import { MeetingPlatformIcon } from "./MeetingPlatformIcon.tsx";
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

/** Only `RoomScheduler` panels reach this surface. */
function getSchedulerCustomAction(device: DeviceState): SurfaceAction | null {
  const [panel] = getPanelsForSurface(device.panels, "scheduler", { inCall: false });
  return panel ? getSurfaceActionFromPanel(panel, 0) : null;
}

export function SchedulerSurface({ device }: SchedulerSurfaceProps) {
  const now = new Date();
  const customAction = useMemo(() => getSchedulerCustomAction(device), [device]);
  const availability = resolveRoomAvailability(device.bookings, now);
  const isBooked = availability.state === "booked";

  return (
    <div className="device-card scheduler-card">
      <div className="scheduler-home">
        <div
          data-scheduler-availability={availability.state}
          className={`scheduler-stage${isBooked ? " booked" : ""}`}
        >
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

              {customAction ? (
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
              ) : null}
            </div>

            <div className="scheduler-right-column">
              <div data-scheduler-system-top className="scheduler-system-top">
                {formatSchedulerTime(now)}
              </div>
              <div className="scheduler-availability-panel">
                {availability.current ? (
                  <div data-scheduler-meeting className="scheduler-meeting">
                    <div data-scheduler-meeting-timing className="scheduler-meeting-timing">
                      {describeBookingTiming(availability.current, now)}
                    </div>
                    <div data-booking-state className="scheduler-availability-text">
                      {availability.current.title}
                    </div>
                    <div className="scheduler-meeting-organizer">
                      <MeetingPlatformIcon platform={availability.current.meetingPlatform} />
                      <div className="scheduler-meeting-organizer-copy">
                        <span data-scheduler-meeting-organizer>
                          Organizer: {availability.current.organizerName}
                        </span>
                        <span data-scheduler-meeting-range>
                          {formatBookingRange(availability.current)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div data-booking-state className="scheduler-availability-text">
                    {availability.headline}
                  </div>
                )}

                <div className="scheduler-action-stack">
                  {isBooked ? null : (
                    <button className="scheduler-primary-action" type="button">
                      <Icon name="icon-calendar-add-regular" />
                      <span>Book room</span>
                    </button>
                  )}
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
