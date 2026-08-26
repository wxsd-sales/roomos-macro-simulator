import { describe, expect, it } from "vitest";
import { buildXapiDeclarations, valuespaceToType } from "../../src/modules/editor/xapiDeclarations.ts";
import { buildSchemaRoots } from "../../src/modules/xapi/schema.ts";

const schema = {
  objects: [
    {
      type: "Command",
      path: "Audio Volume Set",
      products: ["polaris"],
      attributes: {
        description: "Sets the volume.",
        params: [
          { name: "Level", required: true, valuespace: { Min: "0", Max: "100", type: "Integer" } },
          { name: "Device", required: false, valuespace: { Values: ["Internal", "HDMI"], type: "Literal" } },
        ],
      },
    },
    {
      type: "Status",
      path: "Standby State",
      products: ["polaris"],
      attributes: { valuespace: { Values: ["Standby", "Off"], type: "Literal" } },
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
  ],
};

function build(): string {
  return buildXapiDeclarations(buildSchemaRoots(schema), "test-schema");
}

describe("valuespaceToType", () => {
  it("maps scalar valuespaces onto TypeScript types", () => {
    expect(valuespaceToType({ type: "Integer" })).toBe("number");
    expect(valuespaceToType({ type: "String" })).toBe("string");
    expect(valuespaceToType({ type: "Literal", Values: ["On", "Off"] })).toBe('"On" | "Off"');
    expect(valuespaceToType(null)).toBe("unknown");
  });

  it("maps array valuespaces, parenthesising unions", () => {
    expect(valuespaceToType({ type: "StringArray" })).toBe("string[]");
    expect(valuespaceToType({ type: "LiteralArray", Values: ["A", "B"] })).toBe('("A" | "B")[]');
  });
});

describe("buildXapiDeclarations", () => {
  it("declares xapi both globally and as the 'xapi' module", () => {
    const declarations = build();

    expect(declarations).toContain("declare const xapi: XapiSchema.Xapi;");
    expect(declarations).toContain('declare module "xapi" {');
    expect(declarations).toContain("export default instance;");
  });

  it("stays a global script so the ambient xapi binding survives", () => {
    // A single top-level import/export would re-scope the file as a module and
    // silently drop `declare const xapi`.
    const topLevel = build()
      .split("\n")
      .filter((line) => /^(import|export)\b/.test(line));

    expect(topLevel).toEqual([]);
  });

  it("exposes all four xapi roots", () => {
    const declarations = build();

    expect(declarations).toContain("Command: XCommand;");
    expect(declarations).toContain("Config: XConfig");
    expect(declarations).toContain("Status: XStatus");
    expect(declarations).toContain("Event: XEvent;");
  });

  it("emits command arguments with required flags and valuespace types", () => {
    const declarations = build();

    expect(declarations).toContain("Level: number;");
    expect(declarations).toContain('Device?: "Internal" | "HDMI";');
    expect(declarations).toMatch(/\(args: XCommand_Audio_Volume_SetArgs, body\?: string/);
  });

  it("gives statuses get/on/off and configurations get/set/on", () => {
    const declarations = build();

    expect(declarations).toMatch(/interface XStatus_Standby_State \{[^}]*get\(\): Promise<"Standby" \| "Off">;/);
    expect(declarations).toMatch(/interface XStatus_Standby_State \{[^}]*off\(\): void;/);
    expect(declarations).toMatch(/interface XConfig_Audio_DefaultVolume \{[^}]*set\(value: number\): Promise<any>;/);
  });

  it("wraps indexed nodes so numeric access is allowed", () => {
    expect(build()).toContain("Ethernet: XapiIndexed<XStatus_Audio_Input_Connectors_Ethernet>;");
  });

  it("types event payloads from the schema children", () => {
    const declarations = build();

    expect(declarations).toContain("PanelId: string;");
    expect(declarations).toContain('Origin?: "OSD" | "Controller";');
  });

  it("records the schema name it was generated from", () => {
    expect(build()).toContain('"test-schema"');
  });
});
