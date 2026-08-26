import { useEffect } from "react";
import { products } from "../../modules/productHelper.ts";
import { useAppStore } from "../app/AppProvider.tsx";
import { registerDeviceHost } from "../../legacy/deviceHost.ts";
import { isLogSeverityLevel } from "../console/logUtils.ts";
import { DeviceStack } from "./surfaces/DeviceStack.tsx";

export function DeviceSimulator() {
  const { state, store } = useAppStore();

  useEffect(() => {
    registerDeviceHost.mount({
      store,
      addLog: (message, level = "info") => {
        store.dispatch({
          type: "ADD_LOG",
          log: {
            id: crypto.randomUUID(),
            level:
              level === "success" || isLogSeverityLevel(level)
                ? level
                : "info",
            message,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
        });
      },
      getSelectedProductId: () => {
        const productSelect = document.querySelector<HTMLSelectElement>("#product-select");
        const selectedProductName = productSelect?.value ?? "";
        return Object.entries(products).find(([, name]) => name === selectedProductName)?.[0] ?? null;
      },
      getSelectedProductName: () =>
        document.querySelector<HTMLSelectElement>("#product-select")?.value ?? "",
    });
  }, [store]);

  return (
    <div id="device-render-root" className="device-render-root">
      <DeviceStack
        device={state.device}
        onSelectPanel={(panelId, surface) => registerDeviceHost.handleSelectPanel(panelId, surface)}
        onDismissAlert={() => registerDeviceHost.handleDismissAlert()}
      />
    </div>
  );
}
