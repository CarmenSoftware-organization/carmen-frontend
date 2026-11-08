import { describe, it, expect } from "vitest";
import { RECIPE_CARD_PORTRAIT_TEMPLATE_ID } from "@/lib/print-document";
import type { BusinessUnitConfigItem } from "@/types/business-unit";
import { recipePrintTemplateId } from "./use-recipe-print-template";

const item = (key: string, value: string) =>
  ({ key, value, datatype: "enum", label: key }) as BusinessUnitConfigItem;

describe("recipePrintTemplateId", () => {
  it("prints the system's portrait card when the BU has picked nothing", () => {
    for (const config of [undefined, {}, [], [item("print-form.recipe", "")]]) {
      expect(recipePrintTemplateId(config as never)).toBe(
        RECIPE_CARD_PORTRAIT_TEMPLATE_ID,
      );
    }
  });

  it("prints the template the BU picked from the platform's Recipe forms", () => {
    expect(
      recipePrintTemplateId([
        item("print-form.pr", "pr-form"),
        item("print-form.recipe", "1553adcf-admin-made"),
      ]),
    ).toBe("1553adcf-admin-made");
  });

  // ค่าจาก dropdown เดิม (ก่อนย้ายไปแบบฟอร์มการพิมพ์) ไม่มีผลแล้ว
  it("ignores the retired orientation / content settings", () => {
    expect(
      recipePrintTemplateId([
        item("recipe.print-orientation", "landscape"),
        item("recipe.print-content", "ingredients"),
      ]),
    ).toBe(RECIPE_CARD_PORTRAIT_TEMPLATE_ID);
  });
});
