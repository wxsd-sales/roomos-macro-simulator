import { describe, expect, it, vi } from "vitest";
import { createDefaultDeviceState } from "../../src/modules/devices/index.ts";
import { createXapiFacade } from "../../src/modules/xapi/facade.ts";
import { buildSchemaRoots } from "../../src/modules/xapi/schema.ts";
import { createXapiValidator } from "../../src/modules/xapi/validator.ts";

const schema = {
  objects: [
    {
      type: "Configuration",
      path: "Audio DefaultVolume",
      products: ["polaris"],
      attributes: { default: "50", valuespace: { Min: "0", Max: "100", type: "Integer" } },
    },
    {
      type: "Configuration",
      path: "UserInterface Language",
      products: ["polaris"],
      attributes: { default: "English", valuespace: { Values: ["English", "German"], type: "Literal" } },
    },
    {
      type: "Configuration",
      path: "Audio Input Microphone[n] Mode",
      products: ["polaris"],
      attributes: { default: "On", valuespace: { Values: ["On", "Off"], type: "Literal" } },
    },
    {
      type: "Configuration",
      path: "Standby Delay",
      products: ["barents"],
      attributes: { default: "10", valuespace: { Min: "1", Max: "480", type: "Integer" } },
    },
  ],
};

const roots = buildSchemaRoots(schema);

function createValidator() {
  return createXapiValidator({
    schemaBundle: { schemaName: "test-schema", roots },
    productId: "polaris",
    productName: "Desk Pro",
  });
}

function createFacade() {
  const device = createDefaultDeviceState();
  const logs: Array<{ message: string; level: string }> = [];
  const xapi = createXapiFacade({
    device,
    addLog: (message, level = "info") => logs.push({ message, level }),
    renderDevice: vi.fn(),
    schemaBundle: { schemaName: "test-schema", roots },
    productId: "polaris",
    productName: "Desk Pro",
  });

  return { logs, xapi };
}

describe("config validation", () => {
  it("accepts a configuration value inside its valuespace", () => {
    expect(createValidator().validateConfig("Audio.DefaultVolume", 50).ok).toBe(true);
    expect(createValidator().validateConfig("UserInterface.Language", "German").ok).toBe(true);
  });

  it("rejects a numeric value outside the declared range", () => {
    const result = createValidator().validateConfig("Audio.DefaultVolume", 120);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("must be less than or equal to 100");
  });

  it("rejects a literal value outside the allowed set", () => {
    const result = createValidator().validateConfig("UserInterface.Language", "Klingon");

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("must be one of: English, German");
  });

  it("rejects an unknown configuration path", () => {
    const result = createValidator().validateConfig("Audio.NotARealSetting", 1);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("xapi.Config.Audio.NotARealSetting is not available");
  });

  it("rejects configurations unavailable on the selected product", () => {
    const result = createValidator().validateConfig("Standby.Delay", 20);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("is not available on Desk Pro (polaris)");
  });

  it("resolves indexed configuration paths through their numeric index", () => {
    expect(createValidator().validateConfig("Audio.Input.Microphone.1.Mode", "On").ok).toBe(true);
  });
});

describe("xapi config facade", () => {
  it("falls back to the schema default before anything is written", async () => {
    const { xapi } = createFacade();

    await expect(xapi.Config.Audio.DefaultVolume.get()).resolves.toBe("50");
    await expect(xapi.Config.UserInterface.Language.get()).resolves.toBe("English");
  });

  it("stores a written value and returns it on the next read", async () => {
    const { xapi } = createFacade();

    await xapi.Config.Audio.DefaultVolume.set(75);

    await expect(xapi.Config.Audio.DefaultVolume.get()).resolves.toBe(75);
  });

  it("notifies listeners registered with .on()", async () => {
    const { xapi } = createFacade();
    const seen: unknown[] = [];

    xapi.Config.UserInterface.Language.on((value: unknown) => seen.push(value));
    await xapi.Config.UserInterface.Language.set("German");

    expect(seen).toEqual(["German"]);
  });

  it("stops notifying after the subscription is released", async () => {
    const { xapi } = createFacade();
    const seen: unknown[] = [];

    const unsubscribe = xapi.Config.UserInterface.Language.on((value: unknown) => seen.push(value));
    await xapi.Config.UserInterface.Language.set("German");
    unsubscribe();
    await xapi.Config.UserInterface.Language.set("English");

    expect(seen).toEqual(["German"]);
  });

  it("rejects an invalid write and logs the reason", async () => {
    const { logs, xapi } = createFacade();

    await expect(xapi.Config.Audio.DefaultVolume.set(500)).rejects.toThrow(
      /must be less than or equal to 100/,
    );
    expect(logs.some((entry) => entry.level === "error")).toBe(true);
  });

  it("supports the string path form on the Config root", async () => {
    const { xapi } = createFacade();

    await xapi.Config.set("Audio.DefaultVolume", 30);

    await expect(xapi.Config.get("Audio.DefaultVolume")).resolves.toBe(30);
  });
});
