import { useMemo } from "react";
import type { DeviceState, DeviceSurface } from "../../../modules/types.ts";
import {
  describeBookingTiming,
  formatBookingRange,
  resolveRoomAvailability,
} from "../../../modules/bookings/availability.ts";
import { getPanelsForSurface } from "../../../modules/devices/panelLocations.ts";
import {
  getSurfaceActionFromPanel,
  OSD_NATIVE_ACTIONS,
} from "../../../modules/devices/surfaceActionButtons.ts";
import { getVisibleNativeActions } from "../../../modules/devices/uiFeatures.ts";
import { Icon } from "../../../components/Icon.tsx";
import { MeetingPlatformIcon } from "./MeetingPlatformIcon.tsx";
import { RoundActionButton } from "./RoundActionButton.tsx";

interface OsdSurfaceProps {
  device: DeviceState;
  onSelectPanel(panelId: string, surface: DeviceSurface): void;
}

export function OsdSurface({ device, onSelectPanel }: OsdSurfaceProps) {
  const now = new Date();
  const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const inCall = device.call?.active ?? false;
  const visiblePanels = useMemo(
    () => getPanelsForSurface(device.panels, "osd", { inCall }),
    [device.panels, inCall],
  );
  const nativeActions = useMemo(
    () => getVisibleNativeActions(OSD_NATIVE_ACTIONS, device.config),
    [device.config],
  );
  const actions = useMemo(
    () => [...nativeActions, ...visiblePanels.map(getSurfaceActionFromPanel)].slice(0, 16),
    [nativeActions, visiblePanels],
  );
  const availability = resolveRoomAvailability(device.bookings, now);
  const currentBooking = availability.current;

  return (
    <div className="device-card osd-card">
      <div className="osd-home">
        <div className="osd-stage">
          <div className="osd-topbar">
            <button className="osd-workspace-name" type="button">
              <span data-workspace-name>{device.workspaceName ?? "Workspace Name"}</span>
              <span className="osd-workspace-chevron" aria-hidden="true">
                ›
              </span>
            </button>
            <div className="osd-statusbar">
              <span className="osd-status-item" aria-hidden="true">
                <Icon name="icon-airplay-regular" className="momentum-icon osd-status-icon" />
                <span>AirPlay</span>
              </span>
              <span className="osd-status-item" aria-hidden="true">
                <Icon name="icon-device-connection-regular" className="momentum-icon osd-status-icon" />
                <span>Miracast</span>
              </span>
              <span data-device-clock className="osd-clock">
                {clock}
              </span>
            </div>
          </div>

          <div className="osd-actions-shell">
            <div data-osd-actions className="osd-actions-grid">
              {actions.map((action) => {
                const isActive =
                  device.activePanel === action.id ||
                  device.activePanel === action.label ||
                  (!visiblePanels.length && action.id === "native-call");

                return (
                  <RoundActionButton
                    key={action.id}
                    action={action}
                    tileClass="osd-action-tile"
                    buttonClass="osd-action-button"
                    iconClass="osd-action-icon"
                    labelClass="osd-action-label"
                    actionIdAttribute="data-osd-action"
                    active={isActive}
                    tabIndex={-1}
                    imageClass="osd-action-image"
                    brandImageClass="osd-brand-action-image"
                    customImageClass="surface-custom-action-image"
                    onClick={() => onSelectPanel(action.id, "osd")}
                  />
                );
              })}
            </div>
          </div>

          <div
            data-osd-availability={availability.state}
            className="osd-booking-panel"
          >
            <span className="osd-booking-icon" aria-hidden="true">
              <Icon name={currentBooking ? "icon-meetings-regular" : "icon-calendar-add-regular"} />
            </span>
            {currentBooking ? (
              <div className="osd-booking-copy">
                <span data-osd-booking-timing className="osd-booking-timing">
                  {describeBookingTiming(currentBooking, now)}
                </span>
                <span data-osd-booking-state className="osd-booking-headline">
                  {currentBooking.title}
                </span>
                <span className="osd-booking-meta">
                  <MeetingPlatformIcon platform={currentBooking.meetingPlatform} />
                  <span data-osd-booking-range>{formatBookingRange(currentBooking)}</span>
                </span>
              </div>
            ) : (
              <div className="osd-booking-copy">
                <span data-osd-booking-state className="osd-booking-headline">
                  {availability.state === "available" ? "Room available all day" : availability.headline}
                </span>
                <button className="osd-booking-action" type="button" tabIndex={-1}>
                  <Icon name="icon-calendar-add-regular" />
                  <span>Book room</span>
                </button>
              </div>
            )}
          </div>

          <div className="osd-page-indicator" aria-hidden="true">
            <span className="osd-page-dot active" />
            <span className="osd-page-dot" />
          </div>

          <div className="osd-edge-handle" aria-hidden="true">
            <span>❮</span>
          </div>

          <div className="osd-home-indicator" aria-hidden="true" />

          <div
            data-alert-layer
            className={`osd-alert-layer${device.alert ? "" : " hidden"}`}
          >
            <div className="osd-alert-card" role="status" aria-live="polite">
              <span className="osd-alert-icon">
                <Icon name="icon-priority-circle-regular" />
              </span>
              <div className="osd-alert-copy">
                <h4 data-alert-title>{device.alert?.title ?? "Alert title"}</h4>
                <p data-alert-text>{device.alert?.text ?? "Alert text"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
