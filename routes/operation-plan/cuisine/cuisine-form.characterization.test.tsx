import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import type { Cuisine } from "@/types/cuisine";
import {
  fakeMutation,
  firstPayload,
  renderForm,
  submitForm,
} from "@/lib/test-utils/form-characterization";

const navigate = vi.fn();
const createMut = fakeMutation();
const updateMut = fakeMutation();
const deleteMut = fakeMutation();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/use-cuisine", () => ({
  useCreateCuisine: () => createMut,
  useUpdateCuisine: () => updateMut,
  useDeleteCuisine: () => deleteMut,
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

const { CuisineForm } = await import("./cuisine-form");

const CUISINE: Cuisine = {
  id: "cui-1",
  doc_version: 3,
  name: "Isan",
  description: "north-eastern",
  note: null,
  region: "ASIA",
  popular_dishes: null,
  key_ingredients: null,
  info: null,
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CuisineForm — characterization", () => {
  async function enterEditMode() {
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
  }

  it("[update] เซฟแล้วเด้งกลับหน้ารายการ ไม่อยู่หน้าเดิม", async () => {
    renderForm(<CuisineForm cuisine={CUISINE} />);
    await enterEditMode();
    await act(async () => submitForm("cuisine-form"));

    expect(updateMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/operation-plan/cuisine");
  });

  it("[update] payload แนบ id กับ doc_version ที่โหลดมา", async () => {
    renderForm(<CuisineForm cuisine={CUISINE} />);
    await enterEditMode();
    await act(async () => submitForm("cuisine-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      id: "cui-1",
      doc_version: 3,
    });
  });

  it("[create] เซฟแล้วกลับหน้ารายการ ไม่เด้งไปหน้าใบที่เพิ่งสร้าง", async () => {
    renderForm(<CuisineForm />);
    await userEvent.type(
      document.getElementById("cuisine-name") as HTMLInputElement,
      "Lanna",
    );
    await act(async () => submitForm("cuisine-form"));

    expect(createMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/operation-plan/cuisine");
  });
});
