import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { App, AppProvider } from "./App.tsx";
import { createSimulatorAppStore } from "./features/app/createSimulatorAppStore.ts";
import { bootstrapApp } from "./legacy/bootstrapApp.ts";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("React root element #root was not found.");
}

const appStore = createSimulatorAppStore();
const root = createRoot(rootElement);

flushSync(() => {
  root.render(
    <AppProvider store={appStore}>
      <App />
    </AppProvider>,
  );
});

bootstrapApp(appStore);
