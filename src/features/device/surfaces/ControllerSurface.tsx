import { useMemo } from "react";
import type { DeviceState } from "../../../modules/types.ts";
import {
  describeBookingTiming,
  formatBookingRange,
  resolveRoomAvailability,
} from "../../../modules/bookings/availability.ts";
import { getPanelsForSurface } from "../../../modules/devices/panelLocations.ts";
import {
  CONTROLLER_NATIVE_ACTIONS,
  getSurfaceActionFromPanel,
} from "../../../modules/devices/surfaceActionButtons.ts";
import { getVisibleNativeActions } from "../../../modules/devices/uiFeatures.ts";
import { Icon } from "../../../components/Icon.tsx";
import { MeetingPlatformIcon } from "./MeetingPlatformIcon.tsx";
import { RoundActionButton } from "./RoundActionButton.tsx";

interface ControllerSurfaceProps {
  device: DeviceState;
  onSelectPanel(panelId: string): void;
  onDismissAlert(): void;
}

function formatControllerDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function ControllerSurface({ device, onSelectPanel, onDismissAlert }: ControllerSurfaceProps) {
  const now = new Date();
  const inCall = device.call?.active ?? false;
  const customActions = useMemo(
    () => getPanelsForSurface(device.panels, "controller", { inCall }).map(getSurfaceActionFromPanel),
    [device.panels, inCall],
  );
  const nativeActions = useMemo(
    () => getVisibleNativeActions(CONTROLLER_NATIVE_ACTIONS, device.config),
    [device.config],
  );
  const actions = useMemo(
    () => [...nativeActions, ...customActions].slice(0, 9),
    [nativeActions, customActions],
  );
  const availability = resolveRoomAvailability(device.bookings, now);
  // The Navigator features the meeting in progress, or the next one due today.
  const featuredBooking = availability.current ?? availability.next;
  const moreMeetings = availability.current
    ? availability.upcomingToday.length
    : Math.max(0, availability.upcomingToday.length - 1);

  return (
    <div className="device-card controller-card">
      <div className="controller-home">
        <div className="controller-stage">
          <div className="controller-topbar">
            <button className="controller-device-name" type="button">
              <span data-controller-workspace-name>{device.workspaceName ?? "Workspace Name"}</span>
              <span className="controller-device-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </div>

          <div className="controller-layout">
            <div className="controller-clock-panel">
              <div data-controller-time className="controller-time">
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div data-controller-date className="controller-date">
                {formatControllerDate(now)}
              </div>

              <div
                data-controller-availability={availability.state}
                className="controller-booking-panel"
              >
                {featuredBooking ? (
                  <>
                    <div data-controller-booking-timing className="controller-booking-timing">
                      {describeBookingTiming(featuredBooking, now)}
                    </div>
                    <div data-controller-booking-state className="controller-booking-title">
                      {featuredBooking.title}
                    </div>
                    <div data-controller-booking-organizer className="controller-booking-organizer">
                      Organizer: {featuredBooking.organizerName}
                    </div>
                    <div className="controller-booking-range">
                      <MeetingPlatformIcon platform={featuredBooking.meetingPlatform} />
                      <span data-controller-booking-range>{formatBookingRange(featuredBooking)}</span>
                    </div>
                    {moreMeetings > 0 ? (
                      <div data-controller-booking-more className="controller-booking-more">
                        <Icon name="icon-calendar-empty-regular" />
                        <span>
                          {moreMeetings} more meeting{moreMeetings === 1 ? "" : "s"} today
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div data-controller-booking-state className="controller-booking-title">
                    Room available all day
                  </div>
                )}
              </div>
            </div>

            <div className="controller-actions-panel">
              <div data-controller-actions className="controller-actions-grid">
                {actions.map((action, index) => {
                  const isActive =
                    device.activePanel === action.id ||
                    device.activePanel === action.label ||
                    (!customActions.length && index === 0);

                  return (
                    <RoundActionButton
                      key={action.id}
                      action={action}
                      tileClass="controller-action-tile"
                      buttonClass="controller-action-button"
                      iconClass="controller-action-icon"
                      labelClass="controller-action-label"
                      actionIdAttribute="data-controller-action"
                      active={isActive}
                      imageClass="controller-action-image"
                      brandImageClass="controller-brand-action-image"
                      customImageClass="surface-custom-action-image"
                      onClick={() => onSelectPanel(action.id)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="controller-page-indicator" aria-hidden="true">
            <span className="controller-page-dot active" />
            <span className="controller-page-dot" />
          </div>

          <div className="controller-edge-handle" aria-hidden="true">
            <span>❮</span>
          </div>

          <div className="controller-volume-panel" aria-hidden="true">
            <button className="controller-volume-button" type="button" tabIndex={-1}>
              <span className="controller-volume-icon">
                <Icon name="icon-speaker-turn-down-regular" />
              </span>
              <span className="sr-only">Volume down</span>
            </button>
            <button className="controller-volume-button" type="button" tabIndex={-1}>
              <span className="controller-volume-icon">
                <Icon name="icon-speaker-turn-up-regular" />
              </span>
              <span className="sr-only">Volume up</span>
            </button>
          </div>

          <div
            data-controller-alert-layer
            className={`controller-alert-layer${device.alert ? "" : " hidden"}`}
          >
            <div
              className="controller-alert-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="controller-alert-title"
            >
              <h4 id="controller-alert-title" data-controller-alert-title>
                {device.alert?.title ?? "Alert title"}
              </h4>
              <p data-controller-alert-text>{device.alert?.text ?? "Alert text"}</p>
              <button
                data-controller-dismiss-alert
                className="controller-alert-dismiss"
                type="button"
                onClick={onDismissAlert}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
