import { describe, expect, it, vi } from "vitest";
import { createDefaultDeviceState } from "../../src/modules/devices/index.ts";
import { createXapiFacade } from "../../src/modules/xapi/facade.ts";
import { resolveSchemaRoots } from "../../src/modules/xapi/schema.ts";

const schema = {
  objects: [
    {
      type: "Command",
      path: "Bookings Book",
      products: ["polaris"],
      attributes: {
        params: [
          { name: "Duration", valuespace: { type: "Number" } },
          { name: "MeetingPlatform", valuespace: { type: "String" } },
          { name: "Number", valuespace: { type: "String" } },
          { name: "OrganizerEmail", valuespace: { type: "String" } },
          { name: "OrganizerName", valuespace: { type: "String" } },
          { name: "Protocol", valuespace: { type: "String" } },
          { name: "Title", valuespace: { type: "String" } },
        ],
      },
    },
    {
      type: "Command",
      path: "Bookings List",
      products: ["polaris"],
      attributes: {},
    },
    {
      type: "Event",
      path: "Bookings Start",
      products: ["polaris"],
      attributes: {},
    },
    {
      type: "Event",
      path: "Bookings End",
      products: ["polaris"],
      attributes: {},
    },
    {
      type: "Status",
      path: "Bookings Availability Status",
      products: ["polaris"],
      attributes: {},
    },
    {
      type: "Status",
      path: "Bookings Availability TimeStamp",
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

describe("xapi bookings facade", () => {
  it("books, lists, emits lifecycle events, and publishes availability status", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));

    try {
      const { device, renderDevice, xapi } = createFacade();
      const startEvents: unknown[] = [];
      const endEvents: unknown[] = [];
      const availabilityStatuses: unknown[] = [];

      xapi.Event.Bookings.Start.on((event: unknown) => startEvents.push(event));
      xapi.Event.Bookings.End.on((event: unknown) => endEvents.push(event));
      xapi.Status.Bookings.Availability.Status.on((status: unknown) => availabilityStatuses.push(status));

      const booking = await xapi.Command.Bookings.Book({
        Duration: 0.001,
        MeetingPlatform: "Webex",
        Number: "123456789@webex.com",
        OrganizerEmail: "user@example.com",
        OrganizerName: "Example User",
        Protocol: "spark",
        Title: "Quick sync",
      });

      expect(booking).toMatchObject({
        Title: "Quick sync",
        State: "started",
      });
      expect(device.bookings).toHaveLength(1);
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0]).toMatchObject({
        Title: "Quick sync",
        OrganizerName: "Example User",
      });
      expect(availabilityStatuses).toContain("Busy");
      await expect(xapi.Status.Bookings.Availability.Status.get()).resolves.toBe("Busy");
      expect(device.scheduler).toMatchObject({
        busy: true,
        title: "Quick sync",
        presenter: "Example User",
      });

      const bookings = await xapi.Command.Bookings.List();
      expect(bookings).toHaveLength(1);
      expect(bookings[0]).toMatchObject({ Title: "Quick sync" });

      await vi.advanceTimersByTimeAsync(60);

      expect(endEvents).toHaveLength(1);
      expect(endEvents[0]).toMatchObject({ Title: "Quick sync" });
      expect(availabilityStatuses.at(-1)).toBe("Available");
      expect(device.scheduler.busy).toBe(false);
      expect(renderDevice).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
