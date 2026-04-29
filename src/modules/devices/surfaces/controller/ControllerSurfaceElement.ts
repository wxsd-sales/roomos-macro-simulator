import { createControllerRenderer } from "../renderers/controllerRenderer.ts";
import type { DeviceRendererAdapter, DeviceState } from "../../../types.ts";

export class ControllerSurfaceElement extends HTMLElement {
  private renderer?: DeviceRendererAdapter;
  private pendingDevice?: DeviceState;

  connectedCallback(): void {
    if (this.renderer) {
      return;
    }

    this.classList.add("device-card", "controller-card");
    this.renderer = createControllerRenderer({
      root: this,
      onDismissAlert: () => this.dispatchEvent(new CustomEvent("dismiss-alert", { bubbles: true })),
      onSelectPanel: (panel: string) =>
        this.dispatchEvent(new CustomEvent("select-panel", {
          bubbles: true,
          detail: { panel },
        })),
    });

    if (this.pendingDevice) {
      this.render(this.pendingDevice);
      this.pendingDevice = undefined;
    }
  }

  render(device: DeviceState): void {
    if (!this.renderer) {
      this.pendingDevice = device;
      return;
    }

    this.renderer.render(device);
  }
}

export function defineControllerSurfaceElement(): void {
  if (!customElements.get("roomos-controller-surface")) {
    customElements.define("roomos-controller-surface", ControllerSurfaceElement);
  }
}
