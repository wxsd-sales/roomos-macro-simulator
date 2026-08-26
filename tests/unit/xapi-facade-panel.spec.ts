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
          <CustomIcon>
            <Content>iVBORw0KGgo=</Content>
            <Id>custom-icon-1</Id>
          </CustomIcon>
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
        customIconDataUri: "data:image/png;base64,iVBORw0KGgo=",
        customIconId: "custom-icon-1",
        rawXml: expect.stringContaining("<Extensions>"),
      }),
    ]);

    await xapi.Command.UserInterface.Extensions.Panel.Clicked({
      PanelId: "lights",
      Origin: "Controller",
      PeripheralId: "controller",
    });
    expect(clickedEvents).toEqual([
      {
        PanelId: "lights",
        Origin: "Controller",
        PeripheralId: "controller",
      },
    ]);

    await xapi.Command.UserInterface.Extensions.Panel.Clicked({ PanelId: "lights" });
    expect(clickedEvents[1]).toEqual({
      PanelId: "lights",
      PeripheralId: "",
    });

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

  it("accepts custom icon image content as an additional panel save argument", async () => {
    const { device, xapi } = createFacade();

    await xapi.Command.UserInterface.Extensions.Panel.Save(
      { PanelId: "custom-button" },
      "<Extensions><Panel><Name>Button</Name><Icon>Custom</Icon><ActivityType>Custom</ActivityType></Panel></Extensions>",
      { Content: "iVBORw0KGgo=", Id: "custom-icon-2" },
    );

    expect(device.panels[0]).toMatchObject({
      id: "custom-button",
      name: "Button",
      icon: "Custom",
      customIconDataUri: "data:image/png;base64,iVBORw0KGgo=",
      customIconId: "custom-icon-2",
    });
  });

  it("stores the canonical Location parsed from the panel XML", async () => {
    const { device, xapi } = createFacade();

    await xapi.Command.UserInterface.Extensions.Panel.Save(
      { PanelId: "presets" },
      "<Extensions><Panel><Location>callcontrols</Location><Name>Presets</Name></Panel></Extensions>",
    );
    await xapi.Command.UserInterface.Extensions.Panel.Save(
      { PanelId: "issue" },
      "<Extensions><Panel><Location>RoomScheduler</Location><Name>Report Issue</Name></Panel></Extensions>",
    );
    await xapi.Command.UserInterface.Extensions.Panel.Save(
      { PanelId: "secret" },
      "<Extensions><Panel><Location>Hidden</Location><Name>Secret</Name></Panel></Extensions>",
    );

    expect(device.panels.map((panel) => [panel.id, panel.location])).toEqual([
      ["presets", "CallControls"],
      ["issue", "RoomScheduler"],
      ["secret", "Hidden"],
    ]);
  });

  it("defaults to HomeScreen and warns when the Location is unknown", async () => {
    const { device, logs, xapi } = createFacade();

    await xapi.Command.UserInterface.Extensions.Panel.Save(
      { PanelId: "odd" },
      "<Extensions><Panel><Location>Sidebar</Location><Name>Odd</Name></Panel></Extensions>",
    );

    expect(device.panels[0]).toMatchObject({ id: "odd", location: "HomeScreen" });
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "warn",
          message: expect.stringContaining('unknown location "Sidebar"'),
        }),
      ]),
    );
  });

  it("defaults to HomeScreen when the XML omits a Location", async () => {
    const { device, xapi } = createFacade();

    await xapi.Command.UserInterface.Extensions.Panel.Save(
      { PanelId: "plain" },
      "<Extensions><Panel><Name>Plain</Name></Panel></Extensions>",
    );

    expect(device.panels[0]).toMatchObject({ location: "HomeScreen" });
  });
});
