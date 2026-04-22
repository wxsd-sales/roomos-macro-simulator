import { createControllerRenderer } from "./controllerRenderer.js";
import { createOsdRenderer } from "./osdRenderer.js";
import { createSchedulerRenderer } from "./schedulerRenderer.js";

export function createDeviceRenderer({ container, onDismissAlert, onSelectPanel }) {
  container.innerHTML = `
    <div class="device-stack">
      <section class="device-card osd-card" data-device-surface="osd"></section>
      <section class="device-card controller-card" data-device-surface="controller"></section>
      <section class="device-card scheduler-card" data-device-surface="scheduler"></section>
    </div>
  `;

  const osdRenderer = createOsdRenderer({
    root: container.querySelector('[data-device-surface="osd"]'),
    onDismissAlert,
  });
  const controllerRenderer = createControllerRenderer({
    root: container.querySelector('[data-device-surface="controller"]'),
    onSelectPanel,
  });
  const schedulerRenderer = createSchedulerRenderer({
    root: container.querySelector('[data-device-surface="scheduler"]'),
  });

  function render(device) {
    osdRenderer.render(device);
    controllerRenderer.render(device);
    schedulerRenderer.render(device);
  }

  return { render };
}
