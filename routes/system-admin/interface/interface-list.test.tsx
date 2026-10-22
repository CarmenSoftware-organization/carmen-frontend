import { describe, it, expect } from "vitest";
import { interfaceGroups } from "./interface-list";
import { INTERFACE_CATEGORIES } from "./interface-registry";
import type { AppConfig } from "@/types/app-config";

function config(key: string, value: Record<string, unknown>): AppConfig {
  return {
    id: key,
    key,
    value,
  };
}

const allowAll = () => "entitled" as const;

describe("interfaceGroups", () => {
  it("marks a brand enabled when its config row says so", () => {
    const groups = interfaceGroups(
      INTERFACE_CATEGORIES,
      [config("interface_pos_simphony", { enabled: true })],
      allowAll,
    );
    const pos = groups.find((g) => g.category.key === "pos");
    expect(pos?.brands.find((b) => b.brand.key === "simphony")?.enabled).toBe(
      true,
    );
    expect(pos?.brands.find((b) => b.brand.key === "square")?.enabled).toBe(
      false,
    );
  });

  it("marks a brand disabled when it has no config row", () => {
    const groups = interfaceGroups(INTERFACE_CATEGORIES, [], allowAll);
    expect(groups.every((g) => g.brands.every((b) => !b.enabled))).toBe(true);
  });

  it("treats a non-boolean enabled as disabled", () => {
    const groups = interfaceGroups(
      INTERFACE_CATEGORIES,
      [config("interface_pos_simphony", { enabled: "yes" })],
      allowAll,
    );
    const simphony = groups
      .find((g) => g.category.key === "pos")
      ?.brands.find((b) => b.brand.key === "simphony");
    expect(simphony?.enabled).toBe(false);
  });

  it("ignores app configs that are not interface brands", () => {
    const groups = interfaceGroups(
      INTERFACE_CATEGORIES,
      [config("report_email", { enabled: true })],
      allowAll,
    );
    expect(groups.every((g) => g.brands.every((b) => !b.enabled))).toBe(true);
  });

  it("filters brands by entitlement and drops empty categories", () => {
    const enabled = ["interface.pos.simphony", "interface.pos.square"];
    const groups = interfaceGroups(
      INTERFACE_CATEGORIES,
      [],
      (c: string, b: string) =>
        enabled.includes(`interface.${c}.${b}`) ? "entitled" : "none",
    );
    // only POS survives; accounting + pms have no entitled brand
    expect(groups.map((g) => g.category.key)).toEqual(["pos"]);
    expect(groups[0].brands.map((b) => b.brand.key)).toEqual([
      "simphony",
      "square",
    ]);
  });

  it("returns categories in registry order when all are entitled", () => {
    const groups = interfaceGroups(INTERFACE_CATEGORIES, [], allowAll);
    expect(groups.map((g) => g.category.key)).toEqual([
      "accounting",
      "pos",
      "pms",
      "export",
    ]);
  });

  it("returns no groups when nothing is entitled", () => {
    const groups = interfaceGroups(INTERFACE_CATEGORIES, [], () => "none");
    expect(groups).toHaveLength(0);
  });

  it("keeps an expired brand visible instead of dropping it like none", () => {
    // Regression guard: someone changing the filter from `!== "none"` to
    // `=== "entitled"` would silently un-ship the expired-badge feature with
    // an otherwise-green suite, since no other case here ever returns "expired".
    const groups = interfaceGroups(
      INTERFACE_CATEGORIES,
      [],
      (c: string, b: string) =>
        c === "pos" && b === "simphony" ? "expired" : "none",
    );
    const pos = groups.find((g) => g.category.key === "pos");
    expect(pos?.brands.map((b) => b.brand.key)).toEqual(["simphony"]);
  });
});
