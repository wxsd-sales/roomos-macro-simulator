import { describe, expect, it } from "vitest";
import {
  buildSchemaRoots,
  findNodeByPath,
  getCommandParams,
  normalizeValuespace,
  parseSegment,
} from "../../src/modules/xapi/schema.ts";
import { compactSchemaPayload } from "../../src/modules/xapi/compactSchema.ts";

const upstream = {
  objects: [
    {
      type: "Command",
      path: "Audio Volume Set",
      products: ["polaris", "barents"],
      attributes: {
        description: "Sets the volume.\n\nA second paragraph that is dropped.",
        params: [{ name: "Level", required: true, valuespace: { Min: "0", Max: "100", type: "Integer" } }],
      },
    },
    {
      type: "Status",
      path: "Audio Input Connectors Ethernet[n] Mute",
      products: ["polaris"],
      attributes: { valuespace: { Values: ["On", "Off"], type: "Literal" } },
    },
    {
      type: "Configuration",
      path: "Audio DefaultVolume",
      products: ["polaris"],
      attributes: { default: "50", valuespace: { Min: "0", Max: "100", type: "Integer" } },
    },
    {
      type: "Event",
      path: "UserInterface Extensions Panel Clicked",
      products: ["polaris"],
      attributes: {
        children: {
          PanelId: { required: true, valuespace: "string" },
          Origin: { required: false, valuespace: "literal", values: ["OSD", "Controller"] },
        },
      },
    },
    { type: "SomethingElse", path: "Ignored Path", attributes: {} },
  ],
};

describe("parseSegment", () => {
  it("separates the indexed marker from the addressable name", () => {
    expect(parseSegment("Ethernet[n]")).toEqual({ name: "Ethernet", indexed: true });
    expect(parseSegment("ARC[1..3]")).toEqual({ name: "ARC", indexed: true });
    expect(parseSegment("Volume")).toEqual({ name: "Volume", indexed: false });
  });
});

describe("normalizeValuespace", () => {
  it("normalizes the object form used by commands, statuses and configurations", () => {
    expect(normalizeValuespace({ Min: "0", Max: "100", type: "Integer" })).toEqual({
      type: "Integer",
      Min: 0,
      Max: 100,
    });
  });

  it("normalizes the bare-string form used by event payload fields", () => {
    expect(normalizeValuespace("literal", ["OSD", "Controller"])).toEqual({
      type: "literal",
      Values: ["OSD", "Controller"],
    });
  });

  it("returns null when there is nothing to normalize", () => {
    expect(normalizeValuespace(undefined)).toBeNull();
  });
});

describe("buildSchemaRoots", () => {
  it("builds a tree for every kind, including configurations", () => {
    const roots = buildSchemaRoots(upstream);

    expect(roots.commandRoot).not.toBeNull();
    expect(roots.statusRoot).not.toBeNull();
    expect(roots.configRoot).not.toBeNull();
    expect(roots.eventRoot).not.toBeNull();
  });

  it("keeps only the first description paragraph", () => {
    const node = findNodeByPath(buildSchemaRoots(upstream).commandRoot, "Audio.Volume.Set");

    expect(node?.description).toBe("Sets the volume.");
  });

  it("marks indexed segments and strips the bracket from the key", () => {
    const roots = buildSchemaRoots(upstream);
    const ethernet = findNodeByPath(roots.statusRoot, "Audio.Input.Connectors.Ethernet");

    expect(ethernet?.indexed).toBe(true);
    expect(Object.keys(ethernet?.children ?? {})).toEqual(["Mute"]);
  });

  it("resolves a numeric index against an indexed node", () => {
    const roots = buildSchemaRoots(upstream);

    expect(findNodeByPath(roots.statusRoot, "Audio.Input.Connectors.Ethernet.2.Mute")?.leaf).toBe(true);
    expect(findNodeByPath(roots.statusRoot, "Audio.Input.Connectors.Ethernet.Mute")?.leaf).toBe(true);
  });

  it("captures command parameters and configuration defaults", () => {
    const roots = buildSchemaRoots(upstream);

    expect(getCommandParams(findNodeByPath(roots.commandRoot, "Audio.Volume.Set"))).toEqual([
      { name: "Level", required: true, valuespace: { type: "Integer", Min: 0, Max: 100 } },
    ]);
    expect(findNodeByPath(roots.configRoot, "Audio.DefaultVolume")?.defaultValue).toBe("50");
  });

  it("reads event payloads from the schema children", () => {
    const node = findNodeByPath(
      buildSchemaRoots(upstream).eventRoot,
      "UserInterface.Extensions.Panel.Clicked",
    );

    expect(node?.payload).toEqual({
      PanelId: { required: true, multiple: false, valuespace: { type: "string" } },
      Origin: {
        required: false,
        multiple: false,
        valuespace: { type: "literal", Values: ["OSD", "Controller"] },
      },
    });
  });

  it("ignores object types that are not part of the xapi surface", () => {
    const roots = buildSchemaRoots(upstream);
    const allRoots = [roots.commandRoot, roots.statusRoot, roots.configRoot, roots.eventRoot];

    expect(allRoots.some((root) => findNodeByPath(root, "Ignored.Path"))).toBe(false);
  });

  it("returns empty roots for an unusable payload", () => {
    expect(buildSchemaRoots(null)).toEqual({
      commandRoot: null,
      statusRoot: null,
      configRoot: null,
      eventRoot: null,
    });
  });
});

describe("compactSchemaPayload", () => {
  it("produces a payload that rebuilds to the same tree", () => {
    const compact = compactSchemaPayload(upstream, "test-schema");
    const fromCompact = buildSchemaRoots(compact);
    const fromUpstream = buildSchemaRoots(upstream);

    expect(compact.version).toBe("test-schema");
    expect(compact.products).toEqual(["polaris", "barents"]);
    expect(fromCompact).toEqual(fromUpstream);
  });

  it("dictionary-encodes products rather than repeating their names", () => {
    const compact = compactSchemaPayload(upstream, "test-schema");
    const command = compact.objects.find((object) => object.p === "Audio Volume Set");

    expect(command?.r).toEqual([0, 1]);
  });
});
