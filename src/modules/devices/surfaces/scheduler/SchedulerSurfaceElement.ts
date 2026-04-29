import { createSchedulerRenderer } from "../renderers/schedulerRenderer.ts";
import type { DeviceRendererAdapter, DeviceState } from "../../../types.ts";

export class SchedulerSurfaceElement extends HTMLElement {
  private renderer?: DeviceRendererAdapter;
  private pendingDevice?: DeviceState;

  connectedCallback(): void {
    if (this.renderer) {
      return;
    }

    this.classList.add("device-card", "scheduler-card");
    this.renderer = createSchedulerRenderer({
      root: this,
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

export function defineSchedulerSurfaceElement(): void {
  if (!customElements.get("roomos-scheduler-surface")) {
    customElements.define("roomos-scheduler-surface", SchedulerSurfaceElement);
  }
}
