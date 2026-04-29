import { describe, expect, it } from "vitest";
import { createXapiValidator } from "../../src/modules/xapi/validator.ts";
import { resolveSchemaRoots } from "../../src/modules/xapi/schema.ts";

const schema = {
  objects: [
    {
      type: "Command",
      path: "UserInterface Message Alert Display",
      products: ["polaris"],
      attributes: {
        params: [
          {
            name: "Title",
            required: true,
            valuespace: { type: "String" },
          },
          {
            name: "Duration",
            required: false,
            valuespace: { type: "Integer", Min: "1", Max: "30" },
          },
        ],
      },
    },
    {
      type: "Status",
      path: "RoomAnalytics PeopleCount Current",
      products: ["polaris"],
      attributes: {
        valuespace: { type: "Integer" },
      },
    },
  ],
};

function createValidator(productId = "polaris") {
  return createXapiValidator({
    schemaBundle: {
      schemaName: "test-schema",
      roots: resolveSchemaRoots(schema),
    },
    productId,
    productName: "Desk Pro",
  });
}

describe("xapi validator", () => {
  it("accepts a schema command path and valid arguments", () => {
    const result = createValidator().validateCommand("UserInterface.Message.Alert.Display", {
      Title: "Hello",
      Duration: 5,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects unsupported arguments and missing required arguments", () => {
    const result = createValidator().validateCommand("UserInterface.Message.Alert.Display", {
      Text: "Missing title",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "xapi.Command.UserInterface.Message.Alert.Display requires Title.",
        "xapi.Command.UserInterface.Message.Alert.Display does not support argument Text.",
      ]),
    );
  });

  it("rejects commands unavailable on the selected product", () => {
    const result = createValidator("barents").validateCommand("UserInterface.Message.Alert.Display", {
      Title: "Hello",
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("is not available on Desk Pro (barents)");
  });

  it("accepts status paths found in the schema", () => {
    const result = createValidator().validateStatus("RoomAnalytics.PeopleCount.Current");

    expect(result.ok).toBe(true);
  });
});
