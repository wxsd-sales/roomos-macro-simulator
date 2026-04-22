import { describe, expect, it } from "vitest";
import { products } from "../../modules/productHelper.js";

describe("products map", () => {
  it("includes Desk Pro in the exported product values", () => {
    expect(Object.values(products)).toContain("Desk Pro");
  });

  it("exports at least one product", () => {
    expect(Object.keys(products).length).toBeGreaterThan(0);
  });
});
