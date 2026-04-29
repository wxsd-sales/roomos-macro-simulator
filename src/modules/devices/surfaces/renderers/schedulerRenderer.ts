import { icon } from "../../../icons.ts";
import type { DeviceRendererAdapter, DeviceState } from "../../../types.ts";

interface SchedulerRendererOptions {
  root: HTMLElement;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Unable to find scheduler element: ${selector}`);
  }

  return element as T;
}

function formatSchedulerTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function createSchedulerRenderer({ root }: SchedulerRendererOptions): DeviceRendererAdapter {
  root.innerHTML = `
    <div class="scheduler-home">
      <div class="scheduler-stage">
        <div class="scheduler-layout">
          <div class="scheduler-left-column">
          <div class="scheduler-room-panel">
            <div class="scheduler-room-icon" aria-hidden="true">
              ${icon("webexTeams")}
            </div>
              <div class="scheduler-device-name-row">
                <div data-scheduler-device-name class="scheduler-device-name">Workspace Name</div>
              </div>
            </div>

            <div class="scheduler-custom-panel">
              <button class="scheduler-custom-tile" type="button">
                <span class="scheduler-custom-icon" aria-hidden="true">
                  ${icon("laptop")}
                </span>
                <span class="scheduler-custom-label">Custom button</span>
              </button>
            </div>
          </div>

          <div class="scheduler-right-column">
            <div data-scheduler-system-top class="scheduler-system-top">11:57 AM</div>
            <div class="scheduler-availability-panel">
              <div data-booking-state class="scheduler-availability-text">Available</div>
              <div class="scheduler-action-stack">
                <button class="scheduler-primary-action" type="button">
                  ${icon("calendarAdd")}
                  <span>Book room</span>
                </button>
                <button class="scheduler-secondary-action" type="button">
                  ${icon("calendarEmpty")}
                  <span>Room calendar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const refs = {
    deviceName: requireElement<HTMLElement>(root, "[data-scheduler-device-name]"),
    systemTop: requireElement<HTMLElement>(root, "[data-scheduler-system-top]"),
    bookingState: requireElement<HTMLElement>(root, "[data-booking-state]"),
  };

  function render(device: DeviceState): void {
    const now = new Date();
    refs.deviceName.textContent = device.workspaceName ?? "Workspace Name";
    refs.systemTop.textContent = formatSchedulerTime(now);
    refs.bookingState.textContent = device?.scheduler?.busy ? "Busy" : "Available";
  }

  return { render };
}
