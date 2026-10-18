import { describe, it, expect } from "vitest";
import {
  INTERFACE_CATEGORIES,
  findCategory,
  findBrand,
} from "./interface-registry";

describe("interface registry", () => {
  it("registers the four categories", () => {
    expect(INTERFACE_CATEGORIES.map((d) => d.key)).toEqual([
      "accounting",
      "pos",
      "pms",
      "export",
    ]);
  });

  it("has no duplicate category keys", () => {
    expect(new Set(INTERFACE_CATEGORIES.map((d) => d.key)).size).toBe(
      INTERFACE_CATEGORIES.length,
    );
  });

  it("has no duplicate brand keys within a category", () => {
    for (const category of INTERFACE_CATEGORIES) {
      const keys = category.brands.map((b) => b.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("namespaces every brand config key under interface_<category>_", () => {
    for (const category of INTERFACE_CATEGORIES) {
      for (const brand of category.brands) {
        expect(brand.configKey).toBe(`interface_${category.key}_${brand.key}`);
      }
    }
  });

  it("gives every category an icon and at least one brand", () => {
    for (const category of INTERFACE_CATEGORIES) {
      expect(category.icon).toBeDefined();
      expect(category.brands.length).toBeGreaterThan(0);
    }
  });

  it("gives every brand a form (its own or the category's)", () => {
    for (const category of INTERFACE_CATEGORIES) {
      for (const brand of category.brands) {
        expect(brand.form ?? category.form).toBeDefined();
      }
    }
  });

  it("keeps config keys globally unique across all brands", () => {
    const all = INTERFACE_CATEGORIES.flatMap((c) =>
      c.brands.map((b) => b.configKey),
    );
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("findCategory", () => {
  it("resolves a known category", () => {
    expect(findCategory("pos")?.key).toBe("pos");
  });

  it("returns undefined for an unknown category", () => {
    expect(findCategory("hms")).toBeUndefined();
  });

  it("returns undefined when the key is missing", () => {
    expect(findCategory(undefined)).toBeUndefined();
  });
});

describe("findBrand", () => {
  it("resolves a known category + brand", () => {
    expect(findBrand("pos", "micros")?.configKey).toBe("interface_pos_micros");
  });

  it("returns undefined for a brand not in the category", () => {
    expect(findBrand("pos", "opera")).toBeUndefined();
  });

  it("returns undefined for an unknown category", () => {
    expect(findBrand("hms", "micros")).toBeUndefined();
  });

  it("returns undefined when either param is missing", () => {
    expect(findBrand("pos", undefined)).toBeUndefined();
    expect(findBrand(undefined, "micros")).toBeUndefined();
  });
});

describe("brand form overrides", () => {
  it("gives carmen_gl its own form", () => {
    expect(findBrand("accounting", "carmen_gl")?.form).toBeDefined();
  });

  it("gives external its own form under export", () => {
    expect(findBrand("export", "external")?.form).toBeDefined();
    expect(findBrand("export", "external")?.configKey).toBe(
      "interface_export_external",
    );
    expect(findBrand("accounting", "external")).toBeUndefined();
  });

  it("leaves blueledgers on the category form", () => {
    expect(findBrand("accounting", "blueledgers")?.form).toBeUndefined();
  });
});
