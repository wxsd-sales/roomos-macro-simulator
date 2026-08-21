import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App, AppProvider } from "../../src/App.tsx";
import { createSimulatorAppStore } from "../../src/features/app/createSimulatorAppStore.ts";

vi.mock("../../src/legacy/bootstrapApp.ts", () => ({
  bootstrapApp: vi.fn(),
}));

describe("App", () => {
  it("renders the simulator shell inside the app provider", () => {
    const store = createSimulatorAppStore();
    const { container } = render(
      <AppProvider store={store}>
        <App />
      </AppProvider>,
    );
    expect(container.querySelector(".app-shell")).toBeTruthy();
  });
});
