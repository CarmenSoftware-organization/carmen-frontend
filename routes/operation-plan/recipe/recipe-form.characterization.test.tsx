import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import en from "@/messages/en.json";
import type { Recipe } from "@/types/recipe";
import {
  fakeMutation,
  firstPayload,
  renderForm,
  submitForm,
} from "@/lib/test-utils/form-characterization";

const navigate = vi.fn();
const createMut = fakeMutation({ data: { id: "rec-new" } });
const updateMut = fakeMutation();
const deleteMut = fakeMutation();
const syncStepsMut = fakeMutation();
const replaceIngredientsMut = fakeMutation({
  items: [],
  total_ingredient_cost: 0,
});
const previewIngredientsMut = fakeMutation({
  items: [],
  total_ingredient_cost: 0,
});

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("./use-recipe", () => ({
  useCreateRecipe: () => createMut,
  useUpdateRecipe: () => updateMut,
  useDeleteRecipe: () => deleteMut,
}));
// หลังหัวสูตรบันทึกสำเร็จ ฟอร์มจะ sync ขั้นตอนทำต่อ แล้วค่อยกลับหน้ารายการ
vi.mock("./use-recipe-steps-sync", () => ({
  useSyncRecipeSteps: () => syncStepsMut,
}));
// วัตถุดิบบันทึกก่อนหัวสูตร (เฉพาะเมื่อเปลี่ยน) — fixture ไม่มีวัตถุดิบ จึงไม่ถูกเรียก
vi.mock("./use-recipe-ingredients", () => ({
  useReplaceIngredients: () => replaceIngredientsMut,
  usePreviewIngredientCosts: () => ({
    ...previewIngredientsMut,
    reset: vi.fn(),
  }),
}));
vi.mock("./use-recipe-gallery", () => ({
  useRecipeGallery: () => ({
    isDirty: false,
    files: [],
    manifest: [],
    count: 0,
    items: [],
    buildPayload: () => ({ files: [], manifest: [] }),
    add: vi.fn(),
    remove: vi.fn(),
    reset: vi.fn(),
  }),
}));
// FormToolbar ปิดปุ่ม Edit เมื่อไม่มีสิทธิ์ — เทสต์นี้สนใจเส้นทางหลัง save
// ไม่ใช่ permission ให้ผ่านหมดไปเลย
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({
    can: () => true,
    canAny: () => true,
    canAll: () => true,
    guard: (_p: unknown, fn: () => void) => fn,
    isAdmin: true,
    permissions: [],
    canWrite: true,
  }),
}));

const { RecipeForm } = await import("./recipe-form");

// ฟิลด์ครบชุดของ Recipe ยาวกว่า 30 ตัวและไม่มีผลกับเส้นทางหลัง save —
// ใส่เท่าที่ getDefaultValues ใช้จริงแล้ว cast ท่าเดียวกับ fixture อื่นในโปรเจกต์
const RECIPE = {
  id: "rec-1",
  doc_version: 8,
  code: "R-001",
  name: "Tom Yum",
  description: null,
  note: null,
  is_active: true,
  category_id: "cat-1",
  cuisine_id: "cui-1",
  difficulty: "easy",
  base_yield: 1,
  base_yield_unit: "PCS",
  // status เป็น required ใน schema — ไม่ใส่แล้ว handleSubmit ไม่เรียก onSubmit
  status: "draft",
  prep_time: 0,
  cook_time: 0,
  total_ingredient_cost: 0,
  labor_cost: 0,
  overhead_cost: 0,
  cost_per_portion: 0,
  selling_price: 0,
  suggested_price: 0,
  gross_margin: 0,
  gross_margin_percentage: 0,
  actual_food_cost_percentage: 0,
  target_food_cost_percentage: 0,
  labor_cost_percentage: 0,
  overhead_percentage: 0,
  allergens: null,
  tags: null,
  carbon_footprint: 0,
  deduct_from_stock: false,
  default_variant_id: null,
} as unknown as Recipe;

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * บันทึกพฤติกรรมปัจจุบันของ RecipeForm ไว้ก่อนยุบเข้า hook กลาง
 * — ไม่ได้บอกว่าถูก บอกว่าตอนนี้เป็นแบบนี้ ถ้า refactor แล้วเปลี่ยน ต้องเป็นเพราะตั้งใจ
 */
describe("RecipeForm — characterization", () => {
  // ฟอร์มสูตรอยู่ที่ /:id/edit แล้ว (หน้า /:id เป็นโหมดทำอาหาร) จึงเปิดมาในโหมดแก้ไขเลย
  // ไม่มีปุ่ม Edit ให้กด — ตั้งใจเปลี่ยน ไม่ใช่ regression
  async function enterEditMode() {
    expect(
      screen.queryByRole("button", { name: en.common.edit }),
    ).not.toBeInTheDocument();
  }

  it("[update] เซฟแล้วเด้งกลับหน้ารายการ", async () => {
    renderForm(<RecipeForm recipe={RECIPE} />);
    await enterEditMode();
    await act(async () => submitForm("recipe-form"));

    expect(updateMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/operation-plan/recipe");
  });

  it("[update] payload แนบ id กับ doc_version ที่โหลดมา", async () => {
    renderForm(<RecipeForm recipe={RECIPE} />);
    await enterEditMode();
    await act(async () => submitForm("recipe-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      id: "rec-1",
      doc_version: 8,
    });
  });

  it.todo("[create] เซฟแล้วกลับหน้ารายการ");
});
