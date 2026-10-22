import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import en from "@/messages/en.json";
import type { VendorDetail } from "@/types/vendor";
import {
  fakeMutation,
  firstPayload,
  renderForm,
  submitForm,
} from "@/lib/test-utils/form-characterization";

const navigate = vi.fn();
const createMut = fakeMutation({ data: { id: "ven-new" } });
const updateMut = fakeMutation();
const deleteMut = fakeMutation();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/use-vendor", () => ({
  useCreateVendor: () => createMut,
  useUpdateVendor: () => updateMut,
  useDeleteVendor: () => deleteMut,
}));

/**
 * **VendorCertificateSection ยิง query ของตัวเองสามตัว — ต้อง mock ให้ครบ**
 *
 * section นี้ render เฉพาะตอนมี `vendor` แล้วเรียก `useVendorCertificates` +
 * `useCertification` + `useProfile` ปล่อยตัวใดตัวหนึ่งไว้ query จะ retry แบบ
 * backoff อยู่เบื้องหลัง แล้ว `await act()` จะรอมันจนหมดเวลาเทสต์ (วัดได้ 59,896ms)
 * ทั้งที่ mutation ถูกเรียกไปตั้งแต่มิลลิวินาทีแรก — อาการหน้าตาเหมือนฟอร์มช้า
 * ทั้งที่ฟอร์มไม่ได้ช้า mock ครบแล้วเหลือ 1ms
 */
vi.mock("./use-vendor-certificate", () => ({
  useVendorCertificates: () => ({ data: undefined, isLoading: false }),
  useVendorCertificateById: () => ({ data: undefined, isLoading: false }),
  useCreateVendorCertificate: () => createMut,
  useUpdateVendorCertificate: () => updateMut,
  useDeleteVendorCertificate: () => deleteMut,
}));
vi.mock("../shared/use-certification", () => ({
  useCertification: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    dateFormat: "DD/MM/YYYY",
    dateTimeFormat: "DD/MM/YYYY HH:mm",
    defaultCurrencyCode: "THB",
    buCode: "BU-1",
  }),
}));

// VendorGeneral → LookupBuType → useBusinessType · VendorAddress → lookup ที่อยู่ไทย
// ทั้งหมดเป็น query จริง ปล่อยไว้ act() จะรอ retry จนหมดเวลา
vi.mock("@/hooks/use-business-type", () => ({
  useBusinessType: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/hooks/use-thai-address", () => ({
  useThaiProvinces: () => ({ data: [], isLoading: false }),
  useThaiDistricts: () => ({ data: [], isLoading: false }),
  useThaiSubDistricts: () => ({ data: [], isLoading: false }),
}));

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

// ปุ่ม Print ของหน้าผู้ขาย — hook จริงยิง query business unit เอง ตัดออกแล้วจับแค่ว่าเรียกพิมพ์อะไร
const print = vi.fn();
vi.mock("@/hooks/use-print-document", () => ({
  usePrintDocument: () => ({ print, isPrinting: false }),
}));

const { VendorForm } = await import("./vendor-form");

const VENDOR: VendorDetail = {
  id: "ven-1",
  doc_version: 9,
  code: "V-001",
  name: "Acme Foods",
  description: "",
  is_active: true,
  tax_profile: null,
  business_type: [],
  info: [],
  vendor_address: [],
  vendor_contact: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VendorForm — characterization", () => {
  async function enterEditMode() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.common.edit }));
    });
  }

  it("[update] เซฟแล้วอยู่หน้าเดิม ไม่เด้งกลับหน้ารายการ", async () => {
    renderForm(<VendorForm vendor={VENDOR} />);
    await enterEditMode();
    await act(async () => submitForm("vendor-form"));

    expect(updateMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("[update] payload แนบ id กับ doc_version ที่โหลดมา", async () => {
    renderForm(<VendorForm vendor={VENDOR} />);
    await enterEditMode();
    await act(async () => submitForm("vendor-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      id: "ven-1",
      doc_version: 9,
    });
  });

  it("[create] เซฟแล้ว replace ไปหน้าใบที่เพิ่งสร้าง", async () => {
    renderForm(<VendorForm />);
    await act(async () => {
      fireEvent.change(
        document.getElementById("vendor-code") as HTMLInputElement,
        { target: { value: "V-002" } },
      );
      fireEvent.change(
        document.getElementById("vendor-name") as HTMLInputElement,
        { target: { value: "Beta Foods" } },
      );
    });
    await act(async () => submitForm("vendor-form"));

    expect(createMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/vendor-management/vendor/ven-new", {
      replace: true,
    });
  });

  it("[view] ปุ่ม Print พิมพ์ Vendor Detail Report ของผู้ขายรายนี้", async () => {
    renderForm(<VendorForm vendor={VENDOR} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.common.print }));
    });

    expect(print).toHaveBeenCalledWith("VENDOR", {
      documentId: undefined,
      templateId: "da3fff14-8000-4065-bc28-a734e5783814",
      filters: { VendorFrom: "V-001", VendorTo: "V-001", Status: "ALL" },
    });
  });

  it("[edit / create] ไม่มีปุ่ม Print", async () => {
    renderForm(<VendorForm vendor={VENDOR} />);
    await enterEditMode();
    expect(screen.queryByRole("button", { name: en.common.print })).toBeNull();
  });

  it("[create] ไม่มีปุ่ม Print", () => {
    renderForm(<VendorForm />);
    expect(screen.queryByRole("button", { name: en.common.print })).toBeNull();
  });
});
