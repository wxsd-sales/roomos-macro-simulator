import {
  CONTROLLER_NATIVE_ACTIONS,
  createRoundActionButtonMarkup,
  getSurfaceActionFromPanel,
} from "../../surfaceActionButtons.ts";
import type { DeviceRendererAdapter, DeviceState } from "../../../types.ts";

interface ControllerRendererOptions {
  root: HTMLElement;
  onDismissAlert: () => void;
  onSelectPanel: (panel: string) => void;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Unable to find controller element: ${selector}`);
  }

  return element as T;
}

function getIconMarkup(iconClass: string, className = "momentum-icon"): string {
  return `<span class="${className} icon ${iconClass}" aria-hidden="true"></span>`;
}

function formatControllerDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
            <span class="controller-volume-icon">${getIconMarkup("icon-speaker-turn-down-regular")}</span>
            <span class="sr-only">Volume down</span>
          </button>
          <button class="controller-volume-button" type="button" tabindex="-1">
            <span class="controller-volume-icon">${getIconMarkup("icon-speaker-turn-up-regular")}</span>
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
    const customActions = device.panels.map(getSurfaceActionFromPanel);
    const actions = [...CONTROLLER_NATIVE_ACTIONS, ...customActions].slice(0, 9);

    refs.actions.innerHTML = actions
      .map((action, index) => {
        const isActive =
          device.activePanel === action.id ||
          device.activePanel === action.label ||
          (!customActions.length && index === 0);

        return createRoundActionButtonMarkup({
          action,
          tileClass: "controller-action-tile",
          buttonClass: "controller-action-button",
          iconClass: "controller-action-icon",
          labelClass: "controller-action-label",
          dataAttribute: "data-controller-action",
          active: isActive,
          imageClass: "controller-action-image",
          brandImageClass: "controller-brand-action-image",
          customImageClass: "surface-custom-action-image",
        });
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
