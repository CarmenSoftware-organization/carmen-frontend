import { describe, it, expect } from "vitest";
import {
  RECIPE_CARD_LANDSCAPE_TEMPLATE_ID,
  RECIPE_CARD_PORTRAIT_TEMPLATE_ID,
} from "@/lib/print-document";
import type { BusinessUnitConfigItem } from "@/types/business-unit";
import { recipePrintFormat } from "./use-recipe-print-format";

const item = (key: string, value: string) =>
  ({ key, value, datatype: "string", label: key }) as BusinessUnitConfigItem;

describe("recipePrintFormat", () => {
  it("prints portrait with everything when the BU has set nothing", () => {
    for (const config of [undefined, {}, []]) {
      expect(recipePrintFormat(config as never)).toEqual({
        templateId: RECIPE_CARD_PORTRAIT_TEMPLATE_ID,
        filters: { ShowPreparation: "Y", ShowIngredients: "Y" },
      });
    }
  });

  it.each([
    ["all", "Y", "Y"],
    ["preparation", "Y", "N"],
    ["ingredients", "N", "Y"],
  ] as const)(
    "content %s → ShowPreparation %s · ShowIngredients %s",
    (content, sp, si) => {
      const config = [
        item("recipe.print-orientation", "landscape"),
        item("recipe.print-content", content),
      ];
      expect(recipePrintFormat(config)).toEqual({
        templateId: RECIPE_CARD_LANDSCAPE_TEMPLATE_ID,
        filters: { ShowPreparation: sp, ShowIngredients: si },
      });
    },
  );

  it("treats an empty value as unset (portrait, everything)", () => {
    const config = [
      item("recipe.print-orientation", ""),
      item("recipe.print-content", ""),
    ];
    expect(recipePrintFormat(config)).toEqual({
      templateId: RECIPE_CARD_PORTRAIT_TEMPLATE_ID,
      filters: { ShowPreparation: "Y", ShowIngredients: "Y" },
    });
  });
});
