import { createDeviceActions } from "../modules/app/index.ts";
import { getPanelClickOrigin } from "../modules/devices/panelLocations.ts";
import { applyUiFeatureDefaults } from "../modules/devices/uiFeatures.ts";
import type { DevicePanel, DeviceState, DeviceSurface } from "../modules/types.ts";
import { onXapiSchemaReady } from "./monacoHost.ts";
import type { AppStoreBridge } from "../features/app/appStoreBridge.ts";
import { simulatorDeviceRuntime } from "../features/app/simulatorDevice.ts";
import type { AppAction } from "../features/app/types.ts";
import { createXapiFacade } from "../modules/xapi/facade.ts";
import type { XapiFacade } from "../modules/xapi/facade.ts";
import type { XapiSchemaBundle, XapiSchemaNode } from "../modules/xapi/schema.ts";

type DeviceActions = ReturnType<typeof createDeviceActions>;

let appStore: AppStoreBridge | null = null;
let deviceActions: DeviceActions | null = null;
let activeXapiFacade: XapiFacade | null = null;
let addLogFn: ((message: string, level?: string) => void) | null = null;
let getSelectedProductIdFn: (() => string | null) | null = null;
let getSelectedProductNameFn: (() => string) | null = null;
let disposeSchemaListener: (() => void) | null = null;
let latestConfigRoot: XapiSchemaNode | null = null;

const deviceRuntime = simulatorDeviceRuntime;

function dispatchApp(action: AppAction): void {
  appStore?.dispatch(action);
}

function setActiveDeviceState(device: DeviceState): DeviceState {
  dispatchApp({ type: "SET_DEVICE", device });
  return device;
}

function getExtensionPanelById(panelId: string): DevicePanel | null {
  const device = deviceRuntime.getState();
  return device.panels.find((panel) => panel.id === panelId || panel.name === panelId) ?? null;
}

function emitPanelClicked(panelId: string, surface: DeviceSurface): void {
  const panel = getExtensionPanelById(panelId);
  if (!panel || !activeXapiFacade) {
    return;
  }

  activeXapiFacade.command("UserInterface.Extensions.Panel.Clicked", {
    PanelId: panel.id,
    Origin: getPanelClickOrigin(surface),
    PeripheralId: "simulator",
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    addLogFn?.(`Failed to emit panel clicked event: ${message}`, "error");
  });
}

function handleDevicePanelSelection(panelId: string, surface: DeviceSurface): void {
  deviceActions?.selectPanel(panelId);
  emitPanelClicked(panelId, surface);
}

function renderFromRuntime(): void {
  setActiveDeviceState(deviceRuntime.getState());
}

/** Restores the schema-defined UserInterface.Features starting point. */
function seedUiFeatureDefaults(): boolean {
  return applyUiFeatureDefaults(deviceRuntime.getState(), latestConfigRoot);
}

export const registerDeviceHost = {
  mount(options: {
    store: AppStoreBridge;
    addLog: (message: string, level?: string) => void;
    getSelectedProductId: () => string | null;
    getSelectedProductName: () => string;
  }): void {
    appStore = options.store;
    addLogFn = options.addLog;
    getSelectedProductIdFn = options.getSelectedProductId;
    getSelectedProductNameFn = options.getSelectedProductName;

    deviceActions = createDeviceActions({
      deviceRuntime,
      addLog: options.addLog,
      renderDevice: renderFromRuntime,
      onDeviceChange: setActiveDeviceState,
    });

    // The surfaces read UserInterface.Features straight off the device, so the
    // schema defaults have to land before any macro runs.
    disposeSchemaListener?.();
    disposeSchemaListener = onXapiSchemaReady((schemaBundle) => {
      latestConfigRoot = schemaBundle.roots?.configRoot ?? null;
      if (seedUiFeatureDefaults()) {
        renderFromRuntime();
      }
    });

    renderFromRuntime();
  },

  handleSelectPanel(panelId: string, surface: DeviceSurface): void {
    handleDevicePanelSelection(panelId, surface);
  },

  handleDismissAlert(): void {
    deviceActions?.dismissAlert();
  },

  renderFromRuntime,

  reset(): void {
    activeXapiFacade = null;
    deviceActions?.reset();
    // reset() clears the device, so put the feature defaults back.
    if (seedUiFeatureDefaults()) {
      renderFromRuntime();
    }
  },

  getRuntime() {
    return deviceRuntime;
  },

  setActiveXapiFacade(facade: XapiFacade | null): void {
    activeXapiFacade = facade;
  },

  createXapiFacade(
    addLog: (message: string, level?: string) => void,
    renderDevice: () => void,
    schemaBundle: XapiSchemaBundle | null,
  ): XapiFacade {
    activeXapiFacade = createXapiFacade({
      device: deviceRuntime.getState(),
      addLog,
      renderDevice,
      schemaBundle,
      productId: getSelectedProductIdFn?.() ?? null,
      productName: getSelectedProductNameFn?.() ?? "",
    });
    return activeXapiFacade;
  },

  clearXapiFacade(): void {
    activeXapiFacade = null;
  },
};
