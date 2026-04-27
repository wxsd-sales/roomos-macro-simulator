import { icon } from "../icons.js";

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const NATIVE_CONTROLLER_ACTIONS = [
  { id: "native-call", label: "Call", icon: "call" },
  { id: "native-share", label: "Share", icon: "share" },
  { id: "native-webex", label: "Webex", icon: "webex" },
  { id: "native-zoom", label: "Zoom", icon: "zoom" },
  { id: "native-cvicalls", label: "CVICalls", icon: "sliders" },
];

function formatControllerDate(date) {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getActionIconMarkup(action) {
  switch (action.icon) {
    case "call":
      return icon("camera");
    case "share":
      return icon("contentShare");
    case "webex":
      return `
        <img
          class="osd-action-image zoom-action-image"
          src="https://www.webex.com/content/dam/wbx/global/images/webex-favicon.png"
          alt=""
          aria-hidden="true"
        />
      `;
    case "zoom":
      return `
        <img
          class="controller-action-image zoom-action-image"
          src=https://media.zoom.com/images/assets/virtual-meetings-white.svg/Zz02OTBlMzAzOGJkY2QxMWVkYjk4Y2NlMzFjZDhkNzM5MA=="
          alt=""
          aria-hidden="true"
        />
      `;
    case "sliders":
      return icon("adjust");
    default:
      return `
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 8c6.08 0 11 4.92 11 11v3.1c0 2.18.72 4.3 2.04 6.04L39.4 31H8.6l2.36-2.86A9.67 9.67 0 0 0 13 22.1V19c0-6.08 4.92-11 11-11Zm0 28.5c3.06 0 5.66-2.02 6.53-4.8H17.47c.87 2.78 3.47 4.8 6.53 4.8Z" fill="currentColor"/>
        </svg>
      `;
  }
}

function getCustomAction(panel, index) {
  return {
    id: panel.id ?? `panel-${index + 1}`,
    label: panel.name ?? panel.id ?? `Action ${index + 1}`,
    icon: "custom",
  };
}

function isControllerSupportedPanel(panel) {
  const activityType = String(panel.activityType ?? "Custom").toLowerCase();
  return activityType !== "webapp";
}

export function createControllerRenderer({ root, onSelectPanel }) {
  root.innerHTML = `
    <div class="controller-home">
      <div class="controller-stage">
        <div class="controller-topbar">
          <button class="controller-device-name" type="button">
            <span data-controller-workspace-name>Workspace Name</span>
            <span class="controller-device-chevron" aria-hidden="true">›</span>
          </button>
        </div>

        <div class="controller-layout">
          <div class="controller-clock-panel">
            <div data-controller-time class="controller-time">23:56</div>
            <div data-controller-date class="controller-date">Tuesday, April 21</div>
          </div>

          <div class="controller-actions-panel">
            <div data-controller-actions class="controller-actions-grid"></div>
          </div>
        </div>

        <div class="controller-page-indicator" aria-hidden="true">
          <span class="controller-page-dot active"></span>
          <span class="controller-page-dot"></span>
        </div>

        <div class="controller-edge-handle" aria-hidden="true">
          <span>❮</span>
        </div>

        <div class="controller-volume-panel" aria-hidden="true">
          <button class="controller-volume-button" type="button" tabindex="-1">
            <span class="controller-volume-icon">${icon("speakerTurnDown")}</span>
            <span class="sr-only">Volume down</span>
          </button>
          <button class="controller-volume-button" type="button" tabindex="-1">
            <span class="controller-volume-icon">${icon("speakerTurnUp")}</span>
            <span class="sr-only">Volume up</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const refs = {
    workspaceName: root.querySelector("[data-controller-workspace-name]"),
    time: root.querySelector("[data-controller-time]"),
    date: root.querySelector("[data-controller-date]"),
    actions: root.querySelector("[data-controller-actions]"),
  };

  function renderActions(device) {
    const customActions = device.panels.filter(isControllerSupportedPanel).map(getCustomAction);
    const actions = [...NATIVE_CONTROLLER_ACTIONS, ...customActions].slice(0, 9);

    refs.actions.innerHTML = actions
      .map((action, index) => {
        const isActive =
          device.activePanel === action.id ||
          device.activePanel === action.label ||
          (!customActions.length && index === 0);

        return `
          <div class="controller-action-tile">
            <button
              class="controller-action-button ${isActive ? "active" : ""}"
              type="button"
              data-controller-action="${escapeHtml(action.id)}"
            >
              <span class="controller-action-icon">${getActionIconMarkup(action)}</span>
            </button>
            <span class="controller-action-label">${escapeHtml(action.label)}</span>
          </div>
        `;
      })
      .join("");

    refs.actions.querySelectorAll("[data-controller-action]").forEach((button) => {
      button.addEventListener("click", () => onSelectPanel(button.dataset.controllerAction));
    });
  }

  function render(device) {
    const now = new Date();
    refs.workspaceName.textContent = device.workspaceName ?? "Workspace Name";
    refs.time.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    refs.date.textContent = formatControllerDate(now);
    renderActions(device);
  }

  return { render };
}
