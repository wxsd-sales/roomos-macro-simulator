import { defineControllerSurfaceElement } from "./controller/ControllerSurfaceElement.ts";
import { defineOsdSurfaceElement } from "./osd/OsdSurfaceElement.ts";
import { defineSchedulerSurfaceElement } from "./scheduler/SchedulerSurfaceElement.ts";

export function defineDeviceSurfaceElements() {
  defineOsdSurfaceElement();
  defineControllerSurfaceElement();
  defineSchedulerSurfaceElement();
}
