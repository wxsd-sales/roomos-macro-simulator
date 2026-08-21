import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AppProvider } from "../../src/features/app/AppProvider.tsx";
import { createSimulatorAppStore } from "../../src/features/app/createSimulatorAppStore.ts";
import { HelpOverlay } from "../../src/features/help/HelpOverlay.tsx";

describe("HelpOverlay", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders keyboard shortcuts when help is visible", () => {
    const store = createSimulatorAppStore();
    store.dispatch({ type: "SET_HELP_VISIBLE", visible: true });

    render(
      <AppProvider store={store}>
        <HelpOverlay />
      </AppProvider>,
    );

    expect(screen.getByRole("dialog", { name: "Macro Editor Shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Toggle help")).toBeInTheDocument();
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    const store = createSimulatorAppStore();
    store.dispatch({ type: "SET_HELP_VISIBLE", visible: true });

    render(
      <AppProvider store={store}>
        <HelpOverlay />
      </AppProvider>,
    );

    const dialog = screen.getByRole("dialog", { name: "Macro Editor Shortcuts" });
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(store.getState().helpVisible).toBe(false);
  });
});
