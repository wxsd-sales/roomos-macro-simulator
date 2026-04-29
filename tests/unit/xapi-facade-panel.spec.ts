import { describe, expect, it, vi } from "vitest";
import { createDefaultDeviceState } from "../../src/modules/devices/index.ts";
import { createXapiFacade } from "../../src/modules/xapi/facade.ts";
import { resolveSchemaRoots } from "../../src/modules/xapi/schema.ts";

const schema = {
  objects: [
    {
      type: "Command",
      path: "Audio Volume Set",
      products: ["polaris"],
      attributes: {
        params: [{ name: "Level", valuespace: { type: "Number" } }],
      },
    },
    {
      type: "Event",
      path: "Call Successful",
      products: ["polaris"],
      attributes: {},
    },
  ],
};

function createFacade() {
  const device = createDefaultDeviceState();
  const logs: Array<{ message: string; level: string }> = [];
  const renderDevice = vi.fn();
  const xapi = createXapiFacade({
    device,
    addLog: (message, level = "info") => logs.push({ message, level }),
    renderDevice,
    schemaBundle: {
      schemaName: "test-schema",
      roots: resolveSchemaRoots(schema),
    },
    productId: "polaris",
    productName: "Desk Pro",
  });

  return { device, logs, renderDevice, xapi };
}

describe("xapi user interface extension panel facade", () => {
  it("saves raw XML panels and emits panel lifecycle events", async () => {
    const { device, renderDevice, xapi } = createFacade();
    const clickedEvents: unknown[] = [];
    const openEvents: unknown[] = [];
    const closeEvents: unknown[] = [];
    const xml = `
      <Extensions>
        <Panel>
          <Location>HomeScreen</Location>
          <Icon>Lightbulb</Icon>
          <Name>Toggle Lights</Name>
          <ActivityType>Custom</ActivityType>
        </Panel>
      </Extensions>`;

    xapi.Event.UserInterface.Extensions.Panel.Clicked.on((event: unknown) => clickedEvents.push(event));
    xapi.Event.UserInterface.Extensions.Panel.Open.on((event: unknown) => openEvents.push(event));
    xapi.Event.UserInterface.Extensions.Panel.Close.on((event: unknown) => closeEvents.push(event));

    const saveResult = await xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: "lights" }, xml);

    expect(saveResult).toMatchObject({
      PanelId: "lights",
      Panels: [
        {
          PanelId: "lights",
          Name: "Toggle Lights",
          ActivityType: "Custom",
          Icon: "Lightbulb",
          Location: "HomeScreen",
        },
      ],
    });
    expect(device.panels).toEqual([
      expect.objectContaining({
        id: "lights",
        name: "Toggle Lights",
        activityType: "Custom",
        icon: "Lightbulb",
        location: "HomeScreen",
        rawXml: expect.stringContaining("<Extensions>"),
      }),
    ]);

    await xapi.Command.UserInterface.Extensions.Panel.Clicked({
      PanelId: "lights",
      Origin: "local",
      PeripheralId: "controller",
    });
    expect(clickedEvents).toEqual([
      {
        PanelId: "lights",
        Origin: "local",
        PeripheralId: "controller",
      },
    ]);

    await xapi.Command.UserInterface.Extensions.Panel.Open({ PanelId: "lights" });
    expect(device.activePanel).toBe("lights");
    expect(openEvents[0]).toMatchObject({ PanelId: "lights" });

    await xapi.Command.UserInterface.Extensions.Panel.Close({ PanelId: "lights" });
    expect(device.activePanel).toBe("Home");
    expect(closeEvents[0]).toMatchObject({ PanelId: "lights" });

    await xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: "lights" });
    expect(device.panels).toEqual([]);
    expect(renderDevice).toHaveBeenCalled();
  });

  it("updates an existing panel from a second XML payload", async () => {
    const { device, xapi } = createFacade();

    await xapi.Command.UserInterface.Extensions.Panel.Save(
      { PanelId: "lights" },
      "<Extensions><Panel><Name>Toggle Lights</Name><ActivityType>Custom</ActivityType></Panel></Extensions>",
    );
    await xapi.Command.UserInterface.Extensions.Panel.Update(
      { PanelId: "lights" },
      "<Extensions><Panel><Name>Lights Updated</Name><ActivityType>WebApp</ActivityType></Panel></Extensions>",
    );

    expect(device.panels).toHaveLength(1);
    expect(device.panels[0]).toMatchObject({
      id: "lights",
      name: "Lights Updated",
      activityType: "WebApp",
    });
  });
});
