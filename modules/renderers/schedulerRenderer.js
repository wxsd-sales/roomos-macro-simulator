function formatSchedulerTime(date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function createSchedulerRenderer({ root }) {
  root.innerHTML = `
    <div class="scheduler-home">
      <div class="scheduler-stage">
        <div class="scheduler-layout">
          <div class="scheduler-left-column">
          <div class="scheduler-room-panel">
            <div class="scheduler-room-icon" aria-hidden="true">
              <i class="icon icon-webex-teams_16"></i>
            </div>
              <div class="scheduler-device-name-row">
                <div data-scheduler-device-name class="scheduler-device-name">Workspace Name</div>
              </div>
            </div>

            <div class="scheduler-custom-panel">
              <button class="scheduler-custom-tile" type="button">
                <span class="scheduler-custom-icon" aria-hidden="true">
                  <i class="icon icon-laptop_16"></i>
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
                  <i class="icon icon-calendar-add_16" aria-hidden="true"></i>
                  <span>Book room</span>
                </button>
                <button class="scheduler-secondary-action" type="button">
                  <i class="icon icon-calendar-empty_16" aria-hidden="true"></i>
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
    deviceName: root.querySelector("[data-scheduler-device-name]"),
    systemTop: root.querySelector("[data-scheduler-system-top]"),
    bookingState: root.querySelector("[data-booking-state]"),
  };

  function render(device) {
    const now = new Date();
    refs.deviceName.textContent = device.workspaceName ?? "Workspace Name";
    refs.systemTop.textContent = formatSchedulerTime(now);
    refs.bookingState.textContent = device?.scheduler?.busy ? "Busy" : "Available";
  }

  return { render };
}
