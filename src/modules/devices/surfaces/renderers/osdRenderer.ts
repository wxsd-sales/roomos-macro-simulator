import googleMeetIconUrl from "@momentum-design/brand-visuals/dist/svg/google-meet-color.svg?url";
import microsoftTeamsIconUrl from "@momentum-design/brand-visuals/dist/svg/ms-teams-color.svg?url";
import webexAppIconUrl from "@momentum-design/brand-visuals/dist/svg/webex-app-icon-color-container.svg?url";
import zoomIconUrl from "@momentum-design/brand-visuals/dist/svg/zoom-color.svg?url";
import { icon } from "../../../icons.ts";
import type { DevicePanel, DeviceRendererAdapter, DeviceState } from "../../../types.ts";

type OsdActionIcon =
  | "call"
  | "whiteboard"
  | "share"
  | "webex"
  | "files"
  | "zoom"
  | "microsoftTeams"
  | "googleMeet"
  | "custom";

interface OsdAction {
  id: string;
  label: string;
  icon: OsdActionIcon;
}

interface OsdRendererOptions {
  root: HTMLElement;
  onSelectPanel?: (panel: string) => void;
}

const NATIVE_ACTIONS: OsdAction[] = [
  { id: "native-call", label: "Call", icon: "call" },
  { id: "native-whiteboard", label: "Whiteboard", icon: "whiteboard" },
  { id: "native-share", label: "Share", icon: "share" },
  { id: "native-webex", label: "Webex", icon: "webex" },
  { id: "native-zoom", label: "Zoom", icon: "zoom" },
  { id: "native-microsoft-teams", label: "Microsoft Teams", icon: "microsoftTeams" },
  { id: "native-google-meet", label: "Google Meet", icon: "googleMeet" },
];

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Unable to find OSD element: ${selector}`);
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

function getBrandIconMarkup(iconUrl: string, label: string): string {
  return `
    <img
      class="osd-action-image osd-brand-action-image"
      src="${iconUrl}"
      alt=""
      aria-hidden="true"
      data-brand-icon="${escapeHtml(label)}"
    />
  `;
}

function getActionIconMarkup(action: OsdAction): string {
  switch (action.icon) {
    case "call":
      return icon("camera");
    case "whiteboard":
      return icon("whiteboard");
    case "share":
      return icon("contentShare");
    case "webex":
      return getBrandIconMarkup(webexAppIconUrl, "Webex");
    case "files":
      return icon("files");
    case "zoom":
      return getBrandIconMarkup(zoomIconUrl, "Zoom");
    case "microsoftTeams":
      return getBrandIconMarkup(microsoftTeamsIconUrl, "Microsoft Teams");
    case "googleMeet":
      return getBrandIconMarkup(googleMeetIconUrl, "Google Meet");
    default:
      return `
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 11a11 11 0 0 1 11 11v3.2c0 2.25.74 4.45 2.1 6.24L39 34H9l1.9-2.56A10.6 10.6 0 0 0 13 25.2V22a11 11 0 0 1 11-11Zm0 28a5.5 5.5 0 0 0 5.3-4h-10.6A5.5 5.5 0 0 0 24 39Z" fill="currentColor"/>
        </svg>
      `;
  }
}

function getCustomAction(action: DevicePanel, index: number): OsdAction {
  const label = action.name ?? action.id ?? `Action ${index + 1}`;
  const normalizedLabel = label.trim().toLowerCase();

  return {
    id: action.id ?? `panel-${index + 1}`,
    label,
    icon: normalizedLabel === "files" ? "files" : "custom",
  };
}

export function createOsdRenderer({
  root,
  onSelectPanel = () => {},
}: OsdRendererOptions): DeviceRendererAdapter {
  root.innerHTML = `
    <div class="osd-home">
      <div class="osd-stage">
        <div class="osd-topbar">
          <button class="osd-workspace-name" type="button">
            <span data-workspace-name>Workspace Name</span>
            <span class="osd-workspace-chevron" aria-hidden="true">›</span>
          </button>
          <div class="osd-statusbar">
            <span class="osd-status-item" aria-hidden="true">
              ${icon("airplay", "momentum-icon osd-status-icon")}
              <span>AirPlay</span>
            </span>
            <span class="osd-status-item" aria-hidden="true">
              ${icon("deviceConnection", "momentum-icon osd-status-icon")}
              <span>Miracast</span>
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

        <div data-alert-layer class="osd-alert-layer hidden">
          <div class="osd-alert-card" role="status" aria-live="polite">
            <span class="osd-alert-icon">${icon("priorityCircle")}</span>
            <div class="osd-alert-copy">
              <h4 data-alert-title>Alert title</h4>
              <p data-alert-text>Alert text</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const refs = {
    workspaceName: requireElement<HTMLElement>(root, "[data-workspace-name]"),
    clock: requireElement<HTMLElement>(root, "[data-device-clock]"),
    actions: requireElement<HTMLElement>(root, "[data-osd-actions]"),
    alertLayer: requireElement<HTMLElement>(root, "[data-alert-layer]"),
    alertTitle: requireElement<HTMLElement>(root, "[data-alert-title]"),
    alertText: requireElement<HTMLElement>(root, "[data-alert-text]"),
  };

  function renderActions(device: DeviceState): void {
    const actions = [...NATIVE_ACTIONS, ...device.panels.map(getCustomAction)].slice(0, 16);

    refs.actions.innerHTML = actions
      .map((action) => {
        const isActive =
          device.activePanel === action.id ||
          device.activePanel === action.label ||
          (!device.panels.length && action.id === "native-call");

        return `
          <div class="osd-action-tile">
            <button
              class="osd-action-button ${isActive ? "active" : ""}"
              type="button"
              tabindex="-1"
              data-osd-action="${escapeHtml(action.id)}"
            >
              <span class="osd-action-icon">${getActionIconMarkup(action)}</span>
            </button>
            <span class="osd-action-label">${escapeHtml(action.label)}</span>
          </div>
        `;
      })
      .join("");

    refs.actions.querySelectorAll<HTMLElement>("[data-osd-action]").forEach((button) => {
      button.addEventListener("click", () => onSelectPanel(button.dataset.osdAction ?? ""));
    });
  }

  function render(device: DeviceState): void {
    refs.workspaceName.textContent = device.workspaceName ?? "Workspace Name";
    refs.clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    renderActions(device);
    refs.alertLayer.classList.toggle("hidden", !device.alert);
    refs.alertTitle.textContent = device.alert?.title ?? "Alert title";
    refs.alertText.textContent = device.alert?.text ?? "Alert text";
  }

  return { render };
}
