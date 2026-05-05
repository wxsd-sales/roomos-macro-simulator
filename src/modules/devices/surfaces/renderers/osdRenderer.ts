import {
  createRoundActionButtonMarkup,
  getSurfaceActionFromPanel,
  OSD_NATIVE_ACTIONS,
} from "../../surfaceActionButtons.ts";
import type { DeviceRendererAdapter, DeviceState } from "../../../types.ts";

interface OsdRendererOptions {
  root: HTMLElement;
  onSelectPanel?: (panel: string) => void;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Unable to find OSD element: ${selector}`);
  }

  return element as T;
}

function getIconMarkup(iconClass: string, className = "momentum-icon"): string {
  return `<span class="${className} icon ${iconClass}" aria-hidden="true"></span>`;
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
              ${getIconMarkup("icon-airplay-regular", "momentum-icon osd-status-icon")}
              <span>AirPlay</span>
            </span>
            <span class="osd-status-item" aria-hidden="true">
              ${getIconMarkup("icon-device-connection-regular", "momentum-icon osd-status-icon")}
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
            <span class="osd-alert-icon">${getIconMarkup("icon-priority-circle-regular")}</span>
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
    const actions = [...OSD_NATIVE_ACTIONS, ...device.panels.map(getSurfaceActionFromPanel)].slice(0, 16);

    refs.actions.innerHTML = actions
      .map((action) => {
        const isActive =
          device.activePanel === action.id ||
          device.activePanel === action.label ||
          (!device.panels.length && action.id === "native-call");

        return createRoundActionButtonMarkup({
          action,
          tileClass: "osd-action-tile",
          buttonClass: "osd-action-button",
          iconClass: "osd-action-icon",
          labelClass: "osd-action-label",
          dataAttribute: "data-osd-action",
          active: isActive,
          tabIndex: -1,
          imageClass: "osd-action-image",
          brandImageClass: "osd-brand-action-image",
          customImageClass: "surface-custom-action-image",
        });
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
