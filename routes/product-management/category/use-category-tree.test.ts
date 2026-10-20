import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type {
  CategoryDto,
  SubCategoryDto,
  ItemGroupDto,
} from "@/types/category";
import { useCategoryTree } from "./use-category-tree";

const cat = (id: string, code: string): CategoryDto => ({
  id,
  code,
  name: `cat-${code}`,
  is_active: true,
});

const sub = (
  id: string,
  code: string,
  product_category_id: string,
): SubCategoryDto => ({
  id,
  code,
  name: `sub-${code}`,
  is_active: true,
  product_category: { id: product_category_id },
});

const ig = (
  id: string,
  code: string,
  product_subcategory_id: string,
): ItemGroupDto => ({
  id,
  code,
  name: `ig-${code}`,
  is_active: true,
  product_subcategory_id,
});

describe("useCategoryTree — sort by code", () => {
  it("orders every level ascending by code, numerically", () => {
    const { result } = renderHook(() =>
      useCategoryTree({
        // deliberately out of order; numeric so C10 must come AFTER C2
        categories: [cat("a", "C10"), cat("b", "C2")],
        subCategories: [sub("s10", "S10", "b"), sub("s2", "S2", "b")],
        itemGroups: [ig("i10", "I10", "s2"), ig("i2", "I2", "s2")],
        isLoading: false,
      }),
    );

    const tree = result.current.categoryData;
    expect(tree.map((n) => n.code)).toEqual(["C2", "C10"]);

    const catB = tree.find((n) => n.code === "C2");
    expect(catB?.children?.map((n) => n.code)).toEqual(["S2", "S10"]);

    const subS2 = catB?.children?.find((n) => n.code === "S2");
    expect(subS2?.children?.map((n) => n.code)).toEqual(["I2", "I10"]);
  });
});
