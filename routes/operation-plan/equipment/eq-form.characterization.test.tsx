import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import type { Equipment } from "@/types/equipment";
import {
  fakeMutation,
  firstPayload,
  renderForm,
  submitForm,
} from "@/lib/test-utils/form-characterization";

const navigate = vi.fn();
const createMut = fakeMutation({ data: { id: "eq-new" } });
const updateMut = fakeMutation();
const deleteMut = fakeMutation();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("./use-eq", () => ({
  useCreateEquipment: () => createMut,
  useUpdateEquipment: () => updateMut,
  useDeleteEquipment: () => deleteMut,
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

const { EquipmentForm } = await import("./eq-form");

const EQUIPMENT: Equipment = {
  id: "eq-1",
  doc_version: 3,
  code: "OVEN-01",
  name: "Combi Oven",
  description: null,
  category_id: null,
  category_name: null,
  brand: null,
  model: null,
  serial_no: null,
  capacity: null,
  power_rating: null,
  station: null,
  operation_instructions: null,
  safety_notes: null,
  cleaning_instructions: null,
  maintenance_schedule: null,
  last_maintenance_date: null,
  next_maintenance_date: null,
  note: null,
  is_active: true,
  is_portable: false,
  available_qty: 1,
  total_qty: 1,
  usage_count: 0,
  attachments: null,
  manuals_urls: null,
  info: null,
  average_usage_time: 0,
  category: null,
  image_url: null,
  audit: {} as Equipment["audit"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * บันทึกพฤติกรรมปัจจุบันของ EquipmentForm ไว้ก่อนยุบเข้า hook กลาง
 * — ไม่ได้บอกว่าถูก บอกว่าตอนนี้เป็นแบบนี้ ถ้า refactor แล้วเปลี่ยน ต้องเป็นเพราะตั้งใจ
 */
describe("EquipmentForm — characterization", () => {
  async function enterEditMode() {
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
  }

  it("[update] เซฟแล้วอยู่หน้าเดิม ไม่เด้งกลับหน้ารายการ", async () => {
    renderForm(<EquipmentForm equipment={EQUIPMENT} />);
    await enterEditMode();
    await act(async () => submitForm("equipment-form"));

    expect(updateMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("[update] payload แนบ id กับ doc_version ที่โหลดมา", async () => {
    renderForm(<EquipmentForm equipment={EQUIPMENT} />);
    await enterEditMode();
    await act(async () => submitForm("equipment-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      id: "eq-1",
      doc_version: 3,
    });
  });

  it("[create] เซฟแล้วกลับหน้ารายการ ไม่ค้างที่หน้า /new", async () => {
    renderForm(<EquipmentForm />);
    await userEvent.type(
      document.getElementById("equipment-code") as HTMLInputElement,
      "MIX-01",
    );
    await userEvent.type(
      document.getElementById("equipment-name") as HTMLInputElement,
      "Planetary Mixer",
    );
    await act(async () => submitForm("equipment-form"));

    expect(createMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/operation-plan/equipment");
  });
});
