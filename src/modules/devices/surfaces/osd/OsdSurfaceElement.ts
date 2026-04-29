import { createOsdRenderer } from "../renderers/osdRenderer.ts";
import type { DeviceRendererAdapter, DeviceState } from "../../../types.ts";

export class OsdSurfaceElement extends HTMLElement {
  private renderer?: DeviceRendererAdapter;
  private pendingDevice?: DeviceState;

  connectedCallback(): void {
    if (this.renderer) {
      return;
    }

    this.classList.add("device-card", "osd-card");
    this.renderer = createOsdRenderer({
      root: this,
      onSelectPanel: (panel: string) => {
        this.dispatchEvent(new CustomEvent("select-panel", {
          bubbles: true,
          detail: { panel },
        }));
      },
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

export function defineOsdSurfaceElement(): void {
  if (!customElements.get("roomos-osd-surface")) {
    customElements.define("roomos-osd-surface", OsdSurfaceElement);
  }
}
