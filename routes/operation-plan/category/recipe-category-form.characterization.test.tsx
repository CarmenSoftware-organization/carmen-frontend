import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import type { RecipeCategory } from "@/types/recipe-category";
import {
  fakeMutation,
  firstPayload,
  renderForm,
  submitForm,
} from "@/lib/test-utils/form-characterization";

const navigate = vi.fn();
const createMut = fakeMutation({ data: { id: "rc-new" } });
const updateMut = fakeMutation();
const deleteMut = fakeMutation();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/use-recipe-category", () => ({
  useCreateRecipeCategory: () => createMut,
  useUpdateRecipeCategory: () => updateMut,
  useDeleteRecipeCategory: () => deleteMut,
  useRecipeCategory: () => ({ data: undefined, isLoading: false }),
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

const { RecipeCategoryForm } = await import("./recipe-category-form");

const CATEGORY: RecipeCategory = {
  id: "rc-1",
  doc_version: 2,
  code: "MAIN",
  name: "Main Course",
  description: null,
  note: null,
  is_active: true,
  parent: null,
  level: 1,
  default_cost_settings: null,
  default_margins: null,
  info: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * บันทึกพฤติกรรมปัจจุบันของ RecipeCategoryForm ไว้ก่อนยุบเข้า hook กลาง
 * — ไม่ได้บอกว่าถูก บอกว่าตอนนี้เป็นแบบนี้ ถ้า refactor แล้วเปลี่ยน ต้องเป็นเพราะตั้งใจ
 */
describe("RecipeCategoryForm — characterization", () => {
  async function enterEditMode() {
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
  }

  it("[update] เซฟแล้วเด้งกลับหน้ารายการ", async () => {
    renderForm(<RecipeCategoryForm category={CATEGORY} />);
    await enterEditMode();
    await act(async () => submitForm("recipe-category-form"));

    expect(updateMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/operation-plan/category");
  });

  it("[update] payload แนบ id กับ doc_version ที่โหลดมา", async () => {
    renderForm(<RecipeCategoryForm category={CATEGORY} />);
    await enterEditMode();
    await act(async () => submitForm("recipe-category-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      id: "rc-1",
      doc_version: 2,
    });
  });

  it("[create] เซฟแล้วกลับหน้ารายการ ไม่เด้งไปหน้าใบที่เพิ่งสร้าง", async () => {
    renderForm(<RecipeCategoryForm />);
    await userEvent.type(
      document.getElementById("rc-code") as HTMLInputElement,
      "DES",
    );
    await userEvent.type(
      document.getElementById("rc-name") as HTMLInputElement,
      "Dessert",
    );
    await act(async () => submitForm("recipe-category-form"));

    expect(createMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/operation-plan/category");
  });
});
