import { describe, expect, it } from "vitest";
import { products } from "../../src/modules/productHelper.ts";

describe("products map", () => {
  it("includes Desk Pro in the exported product values", () => {
    expect(Object.values(products)).toContain("Desk Pro");
  });

  it("exports at least one product", () => {
    expect(Object.keys(products).length).toBeGreaterThan(0);
  });
});
