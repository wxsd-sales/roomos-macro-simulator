import type { DeviceRendererAdapter, DeviceState } from "../../../types.ts";
import { defineDeviceSurfaceElements } from "../defineSurfaceElements.ts";

interface DeviceRendererOptions {
  container: HTMLElement;
  onDismissAlert: () => void;
  onSelectPanel: (panel: string) => void;
}

interface DeviceSurfaceElement extends HTMLElement {
  render(device: DeviceState): void;
}

function requireSurface(container: ParentNode, selector: string): DeviceSurfaceElement {
  const element = container.querySelector(selector);
  if (!element) {
    throw new Error(`Unable to find device surface: ${selector}`);
  }

  return element as DeviceSurfaceElement;
}

function getPanelFromEvent(event: Event): string | null {
  return (event as CustomEvent<{ panel?: string }>).detail?.panel ?? null;
}

export function createDeviceRenderer({
  container,
  onDismissAlert,
  onSelectPanel,
}: DeviceRendererOptions): DeviceRendererAdapter {
  defineDeviceSurfaceElements();

  container.innerHTML = `
    <div class="device-stack">
      <roomos-osd-surface data-device-surface="osd"></roomos-osd-surface>
      <roomos-controller-surface data-device-surface="controller"></roomos-controller-surface>
      <roomos-scheduler-surface data-device-surface="scheduler"></roomos-scheduler-surface>
    </div>
  `;

  const osdSurface = requireSurface(container, '[data-device-surface="osd"]');
  const controllerSurface = requireSurface(container, '[data-device-surface="controller"]');
  const schedulerSurface = requireSurface(container, '[data-device-surface="scheduler"]');

  osdSurface.addEventListener("select-panel", (event) => {
    const panel = getPanelFromEvent(event);
    if (panel) {
      onSelectPanel(panel);
    }
  });
  controllerSurface.addEventListener("select-panel", (event) => {
    const panel = getPanelFromEvent(event);
    if (panel) {
      onSelectPanel(panel);
    }
  });
  controllerSurface.addEventListener("dismiss-alert", () => onDismissAlert());

  function render(device: DeviceState): void {
    osdSurface.render(device);
    controllerSurface.render(device);
    schedulerSurface.render(device);
  }

  return { render };
}
