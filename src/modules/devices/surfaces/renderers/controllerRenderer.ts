import { icon } from "../../../icons.ts";
import type { DevicePanel, DeviceRendererAdapter, DeviceState } from "../../../types.ts";

type ControllerActionIcon = "call" | "share" | "webex" | "zoom" | "sliders" | "lightbulb" | "custom";

interface ControllerAction {
  id: string;
  label: string;
  icon: ControllerActionIcon;
}

interface ControllerRendererOptions {
  root: HTMLElement;
  onDismissAlert: () => void;
  onSelectPanel: (panel: string) => void;
}

const NATIVE_CONTROLLER_ACTIONS: ControllerAction[] = [
  { id: "native-call", label: "Call", icon: "call" },
  { id: "native-share", label: "Share", icon: "share" },
  { id: "native-webex", label: "Webex", icon: "webex" },
  { id: "native-zoom", label: "Zoom", icon: "zoom" },
];

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Unable to find controller element: ${selector}`);
  }

  return element as T;
}

function escapeHtml(text: unknown): string {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatControllerDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getActionIconMarkup(action: ControllerAction): string {
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
          src="https://media.zoom.com/images/assets/virtual-meetings-white.svg/Zz02OTBlMzAzOGJkY2QxMWVkYjk4Y2NlMzFjZDhkNzM5MA=="
          alt=""
          aria-hidden="true"
        />
      `;
    case "sliders":
      return icon("adjust");
    case "lightbulb":
        return icon("lightbulb");
    default:
      return `
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 8c6.08 0 11 4.92 11 11v3.1c0 2.18.72 4.3 2.04 6.04L39.4 31H8.6l2.36-2.86A9.67 9.67 0 0 0 13 22.1V19c0-6.08 4.92-11 11-11Zm0 28.5c3.06 0 5.66-2.02 6.53-4.8H17.47c.87 2.78 3.47 4.8 6.53 4.8Z" fill="currentColor"/>
        </svg>
      `;
  }
}

function getCustomAction(panel: DevicePanel, index: number): ControllerAction {
  return {
    id: panel.id ?? `panel-${index + 1}`,
    label: panel.name ?? panel.id ?? `Action ${index + 1}`,
    icon: "custom",
  };
}

function isControllerSupportedPanel(panel: DevicePanel): boolean {
  const activityType = String(panel.activityType ?? "Custom").toLowerCase();
  return activityType !== "webapp";
}

export function createControllerRenderer({
  root,
  onDismissAlert,
  onSelectPanel,
}: ControllerRendererOptions): DeviceRendererAdapter {
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

        <div data-controller-alert-layer class="controller-alert-layer hidden">
          <div class="controller-alert-card" role="dialog" aria-modal="true" aria-labelledby="controller-alert-title">
            <h4 id="controller-alert-title" data-controller-alert-title>Alert title</h4>
            <p data-controller-alert-text>Alert text</p>
            <button data-controller-dismiss-alert class="controller-alert-dismiss" type="button">Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const refs = {
    workspaceName: requireElement<HTMLElement>(root, "[data-controller-workspace-name]"),
    time: requireElement<HTMLElement>(root, "[data-controller-time]"),
    date: requireElement<HTMLElement>(root, "[data-controller-date]"),
    actions: requireElement<HTMLElement>(root, "[data-controller-actions]"),
    alertLayer: requireElement<HTMLElement>(root, "[data-controller-alert-layer]"),
    alertTitle: requireElement<HTMLElement>(root, "[data-controller-alert-title]"),
    alertText: requireElement<HTMLElement>(root, "[data-controller-alert-text]"),
    dismissAlertButton: requireElement<HTMLButtonElement>(root, "[data-controller-dismiss-alert]"),
  };

  refs.dismissAlertButton.addEventListener("click", onDismissAlert);

  function renderActions(device: DeviceState): void {
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

    refs.actions.querySelectorAll<HTMLElement>("[data-controller-action]").forEach((button) => {
      button.addEventListener("click", () => onSelectPanel(button.dataset.controllerAction ?? ""));
    });
  }

  function render(device: DeviceState): void {
    const now = new Date();
    refs.workspaceName.textContent = device.workspaceName ?? "Workspace Name";
    refs.time.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    refs.date.textContent = formatControllerDate(now);
    renderActions(device);
    refs.alertLayer.classList.toggle("hidden", !device.alert);
    refs.alertTitle.textContent = device.alert?.title ?? "Alert title";
    refs.alertText.textContent = device.alert?.text ?? "Alert text";
  }

  return { render };
}
