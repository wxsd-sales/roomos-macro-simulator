import { AppProvider } from "./features/app/AppProvider.tsx";
import { SimulatorShell } from "./features/shell/SimulatorShell.tsx";

export function App() {
  return <SimulatorShell />;
}

export { AppProvider };
