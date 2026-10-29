import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import en from "@/messages/en.json";
import type { Recipe } from "@/types/recipe";
import { renderForm } from "@/lib/test-utils/form-characterization";

// ปุ่ม Print — hook จริงยิง query business unit เอง ตัดออกแล้วจับแค่ว่าเรียกพิมพ์อะไร
const print = vi.fn();
vi.mock("@/hooks/use-print-document", () => ({
  usePrintDocument: () => ({ print, isPrinting: false }),
}));
// หน่วยของ yield โหลดจาก API — หน้านี้ใช้แค่ชื่อ ไม่เกี่ยวกับปุ่ม Print
vi.mock("@/hooks/use-unit", () => ({
  useUnitById: () => ({ data: undefined }),
}));
let canWrite = true;
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({ can: () => canWrite, canWrite }),
}));

const { RecipeCookView } = await import("./recipe-cook-view");

// หน้าโหมดทำอาหารอ่านแค่ชื่อ รหัส เวลา ขั้นตอน วัตถุดิบ — ใส่เท่าที่ใช้แล้ว cast
const RECIPE = {
  id: "rec-1",
  code: "RCP-001",
  name: "Beef & Pork Meatball Mix",
  base_yield: 1,
  base_yield_unit: "",
  prep_time: 10,
  cook_time: 20,
  allergens: null,
  preparation_steps: [],
  ingredients: [],
} as unknown as Recipe;

beforeEach(() => {
  vi.clearAllMocks();
  canWrite = true;
});

describe("RecipeCookView — ปุ่ม Print", () => {
  it("พิมพ์ Recipe Card Report ของสูตรนี้สูตรเดียว", async () => {
    renderForm(<RecipeCookView recipe={RECIPE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.common.print }));
    });

    expect(print).toHaveBeenCalledWith("RECIPE", {
      documentId: undefined,
      templateId: "60bbb2b6-3aa5-4802-bf24-66357287c301",
      filters: {
        CategoryFrom: "ALL",
        CategoryTo: "ALL",
        RecipeFrom: "RCP-001",
        RecipeTo: "RCP-001",
        Status: "ALL",
      },
    });
  });

  it("คนที่แก้สูตรไม่ได้ก็ยังพิมพ์ได้ (ไม่มีปุ่ม Edit)", () => {
    canWrite = false;
    renderForm(<RecipeCookView recipe={RECIPE} />);
    expect(screen.getByRole("button", { name: en.common.print })).toBeEnabled();
    expect(screen.queryByText(en.operationPlan.recipe.editRecipe)).toBeNull();
  });
});
