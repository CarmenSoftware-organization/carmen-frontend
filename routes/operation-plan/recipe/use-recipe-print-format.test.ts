import { describe, it, expect } from "vitest";
import {
  RECIPE_CARD_LANDSCAPE_TEMPLATE_ID,
  RECIPE_CARD_TEMPLATE_ID,
} from "@/lib/print-document";
import type { BusinessUnitConfigItem } from "@/types/business-unit";
import { recipePrintFormat } from "./use-recipe-print-format";

const item = (key: string, value: string) =>
  ({ key, value, datatype: "string", label: key }) as BusinessUnitConfigItem;

describe("recipePrintFormat", () => {
  it("prints portrait with preparation and ingredients when the BU has set nothing", () => {
    for (const config of [undefined, {}, []]) {
      expect(recipePrintFormat(config as never)).toEqual({
        templateId: RECIPE_CARD_TEMPLATE_ID,
        filters: { ShowPreparation: "Y", ShowIngredients: "Y" },
      });
    }
  });

  it("picks the landscape template and hides what the BU turned off", () => {
    const config = [
      item("recipe.print-orientation", "landscape"),
      item("recipe.print-preparation", "false"),
      item("recipe.print-ingredients", "true"),
    ];
    expect(recipePrintFormat(config)).toEqual({
      templateId: RECIPE_CARD_LANDSCAPE_TEMPLATE_ID,
      filters: { ShowPreparation: "N", ShowIngredients: "Y" },
    });
  });

  it("treats an empty value as unset (portrait, printed)", () => {
    const config = [
      item("recipe.print-orientation", ""),
      item("recipe.print-ingredients", ""),
    ];
    expect(recipePrintFormat(config)).toEqual({
      templateId: RECIPE_CARD_TEMPLATE_ID,
      filters: { ShowPreparation: "Y", ShowIngredients: "Y" },
    });
  });
});
