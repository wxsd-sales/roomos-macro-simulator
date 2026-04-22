const NATIVE_ACTIONS = [
  { id: "native-call", label: "Call", icon: "call" },
  { id: "native-whiteboard", label: "Whiteboard", icon: "whiteboard" },
  { id: "native-share", label: "Share", icon: "share" },
  { id: "native-webex", label: "Webex", icon: "webex" },
  { id: "native-zoom", label: "Zoom", icon: "zoom" },
];

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getActionIconMarkup(action) {
  switch (action.icon) {
    case "call":
      return `<i class="icon icon-camera_16" aria-hidden="true"></i>`;
    case "whiteboard":
      return `<i class="icon icon-whiteboard_16" aria-hidden="true"></i>`;
    case "share":
      return `<i class="icon icon-content-share_16" aria-hidden="true"></i>`;
    case "webex":
      return `
        <img
          class="osd-action-image zoom-action-image"
          src="https://www.webex.com/content/dam/wbx/global/images/webex-favicon.png"
          alt=""
          aria-hidden="true"
        />
      `;
    case "files":
      return `<i class="icon icon-files_16" aria-hidden="true"></i>`;
    case "zoom":
      return `
        <img
          class="osd-action-image zoom-action-image"
          src="https://media.zoom.com/images/assets/virtual-meetings-white.svg/Zz02OTBlMzAzOGJkY2QxMWVkYjk4Y2NlMzFjZDhkNzM5MA=="
          alt=""
          aria-hidden="true"
        />
      `;
    default:
      return `
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 11a11 11 0 0 1 11 11v3.2c0 2.25.74 4.45 2.1 6.24L39 34H9l1.9-2.56A10.6 10.6 0 0 0 13 25.2V22a11 11 0 0 1 11-11Zm0 28a5.5 5.5 0 0 0 5.3-4h-10.6A5.5 5.5 0 0 0 24 39Z" fill="currentColor"/>
        </svg>
      `;
  }
}

function getCustomAction(action, index) {
  const label = action.name ?? action.id ?? `Action ${index + 1}`;
  const normalizedLabel = label.trim().toLowerCase();

  return {
    id: action.id ?? `panel-${index + 1}`,
    label,
    icon: normalizedLabel === "files" ? "files" : "custom",
  };
}

export function createOsdRenderer({ root, onDismissAlert }) {
  root.innerHTML = `
    <div class="osd-home">
      <div class="osd-stage">
        <div class="osd-topbar">
          <button class="osd-workspace-name" type="button">
            <span data-workspace-name>Workspace Name</span>
            <span class="osd-workspace-chevron" aria-hidden="true">›</span>
          </button>
          <div class="osd-statusbar">
            <span class="osd-airplay-status" aria-hidden="true">
              <span class="osd-airplay-icon">
                <svg viewBox="0 0 20 20">
                  <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h9A2.5 2.5 0 0 1 17 4.5V11h-1.8V4.5a.7.7 0 0 0-.7-.7h-9a.7.7 0 0 0-.7.7V11H3V4.5Zm7 6.4 3.3 4.1H6.7l3.3-4.1Zm-5.8 4.9h11.6v1.2H4.2v-1.2Z" fill="currentColor"/>
                </svg>
              </span>
              <span>AirPlay</span>
            </span>
            <span data-device-clock class="osd-clock">22:57</span>
          </div>
        </div>

        <div class="osd-actions-shell">
          <div data-osd-actions class="osd-actions-grid"></div>
        </div>

        <div class="osd-page-indicator" aria-hidden="true">
          <span class="osd-page-dot active"></span>
          <span class="osd-page-dot"></span>
        </div>

        <div class="osd-edge-handle" aria-hidden="true">
          <span>❮</span>
        </div>

        <div class="osd-home-indicator" aria-hidden="true"></div>

        <div data-alert-layer class="alert-layer hidden">
          <div class="alert-card">
            <p class="alert-caption">System Message</p>
            <h4 data-alert-title>Alert title</h4>
            <p data-alert-text>Alert text</p>
            <button data-dismiss-alert class="primary-button wide">Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const refs = {
    workspaceName: root.querySelector("[data-workspace-name]"),
    clock: root.querySelector("[data-device-clock]"),
    actions: root.querySelector("[data-osd-actions]"),
    alertLayer: root.querySelector("[data-alert-layer]"),
    alertTitle: root.querySelector("[data-alert-title]"),
    alertText: root.querySelector("[data-alert-text]"),
    dismissAlertButton: root.querySelector("[data-dismiss-alert]"),
  };

  refs.dismissAlertButton.addEventListener("click", onDismissAlert);

  function renderActions(device) {
    const actions = [...NATIVE_ACTIONS, ...device.panels.map(getCustomAction)].slice(0, 16);

    refs.actions.innerHTML = actions
      .map((action) => {
        const isActive =
          device.activePanel === action.id ||
          device.activePanel === action.label ||
          (!device.panels.length && action.id === "native-call");

        return `
          <div class="osd-action-tile">
            <button class="osd-action-button ${isActive ? "active" : ""}" type="button" tabindex="-1">
              <span class="osd-action-icon">${getActionIconMarkup(action)}</span>
            </button>
            <span class="osd-action-label">${escapeHtml(action.label)}</span>
          </div>
        `;
      })
      .join("");
  }

  function render(device) {
    refs.workspaceName.textContent = device.workspaceName ?? "Workspace Name";
    refs.clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    renderActions(device);
    refs.alertLayer.classList.toggle("hidden", !device.alert);
    refs.alertTitle.textContent = device.alert?.title ?? "Alert title";
    refs.alertText.textContent = device.alert?.text ?? "Alert text";
  }

  return { render };
}
