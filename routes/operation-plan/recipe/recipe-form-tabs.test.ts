import { describe, it, expect } from "vitest";
import type { FieldErrors } from "react-hook-form";
import { EMPTY_FORM, type RecipeFormValues } from "./recipe-form-schema";
import {
  RECIPE_TABS,
  tabOfField,
  tabsWithErrors,
  tabToOpenForErrors,
} from "./recipe-form-tabs";

const errorsOf = (...keys: string[]) =>
  Object.fromEntries(
    keys.map((k) => [k, { type: "custom", message: "x" }]),
  ) as FieldErrors<RecipeFormValues>;

describe("tabOfField", () => {
  it("ทุกช่องของฟอร์มถูกระบุแท็บ (หรือ null = อยู่นอกแท็บ) — ไม่มีตัวไหนตกหล่น", () => {
    for (const key of Object.keys(EMPTY_FORM)) {
      const tab = tabOfField(key);
      expect(tab === null || RECIPE_TABS.includes(tab), key).toBe(true);
    }
  });

  it.each([
    ["code", "details"],
    ["allergens.custom", "details"],
    ["ingredients.3.qty", "ingredients"],
    ["preparation_steps.0.description", "steps"],
    ["max_food_cost_percentage", "cost"],
    ["name", null],
    ["not_a_field", null],
  ])("%s → %s", (path, tab) => {
    expect(tabOfField(path)).toBe(tab);
  });
});

describe("tabToOpenForErrors", () => {
  it("เปิดแท็บแรกตามลำดับที่แสดง ไม่ใช่ลำดับของ error", () => {
    const errors = errorsOf(
      "selling_price",
      "preparation_steps",
      "ingredients",
    );
    expect(tabToOpenForErrors(errors)).toBe("ingredients");
    expect([...tabsWithErrors(errors)].sort()).toEqual(
      ["cost", "ingredients", "steps"].sort(),
    );
  });

  it("มี error ของช่องเหนือแท็บ (ชื่อสูตร) → ไม่สลับแท็บ", () => {
    expect(tabToOpenForErrors(errorsOf("name", "selling_price"))).toBeNull();
  });

  it("ไม่มี error → ไม่สลับแท็บ", () => {
    expect(tabToOpenForErrors({})).toBeNull();
  });
});
