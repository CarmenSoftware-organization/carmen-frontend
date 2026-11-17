import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import type { RequestPriceList } from "@/types/request-price-list";
import {
  fakeMutation,
  firstPayload,
  renderForm,
  submitForm,
} from "@/lib/test-utils/form-characterization";

const navigate = vi.fn();
const createMut = fakeMutation({ data: { id: "rfp-new" } });
const updateMut = fakeMutation();
const deleteMut = fakeMutation();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("./use-rfp", () => ({
  useCreateRequestPriceList: () => createMut,
  useUpdateRequestPriceList: () => updateMut,
  useDeleteRequestPriceList: () => deleteMut,
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    defaultCurrencyCode: "THB",
    dateFormat: "DD/MM/YYYY",
    dateTimeFormat: "DD/MM/YYYY HH:mm",
    buCode: "BU-1",
  }),
}));
vi.mock("@/hooks/use-vendor", () => ({
  useVendor: () => ({
    data: {
      data: [
        { id: "ven-1", code: "V001", name: "Acme Foods", contacts: [] },
        {
          id: "ven-2",
          code: "V002",
          name: "Beta Farms",
          contacts: [
            {
              is_primary: true,
              name: "Lek",
              phone: "02-111",
              email: "lek@beta.test",
            },
          ],
        },
      ],
      paginate: { total: 2 },
    },
    isLoading: false,
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

const { RequestPriceListForm } = await import("./rfp-form");

const RFP = {
  id: "rfp-1",
  doc_version: 2,
  name: "Q1 Produce RFP",
  start_date: "2026-01-01",
  end_date: "2026-03-31",
  custom_message: "",
  email_template_id: null,
  info: "{}",
  pricelist_template: {
    id: "plt-1",
    name: "Produce",
    status: "active",
    currency: { id: "cur-1", code: "THB" },
  },
  vendor_count: 0,
} as unknown as RequestPriceList;

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * บันทึกพฤติกรรมปัจจุบันของ RequestPriceListForm ไว้ก่อนยุบเข้า hook กลาง
 * — ไม่ได้บอกว่าถูก บอกว่าตอนนี้เป็นแบบนี้ ถ้า refactor แล้วเปลี่ยน ต้องเป็นเพราะตั้งใจ
 */
describe("RequestPriceListForm — characterization", () => {
  async function enterEditMode() {
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
  }

  it("[update] เซฟแล้วอยู่หน้าเดิม ไม่เด้งกลับหน้ารายการ", async () => {
    renderForm(<RequestPriceListForm requestPriceList={RFP} />);
    await enterEditMode();
    await act(async () => submitForm("rfp-form"));

    expect(updateMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("[update] payload แนบ id กับ doc_version ที่โหลดมา", async () => {
    renderForm(<RequestPriceListForm requestPriceList={RFP} />);
    await enterEditMode();
    await act(async () => submitForm("rfp-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      id: "rfp-1",
      doc_version: 2,
    });
  });

  it.todo("[create] พฤติกรรมหลังสร้าง");
});

const rv = en.vendorManagement.requestPriceList.vendors;

const RFP_WITH_VENDOR = {
  ...RFP,
  vendor_count: 1,
  vendors: [
    {
      id: "rv-1",
      vendor: { id: "ven-1", name: "Acme Foods", code: "V001" },
      contact_person: "Som",
      contact_phone: "02-000",
      contact_email: "som@acme.test",
      url_token: "tok-1",
      has_submitted: false,
      pricelist: null,
    },
  ],
} as unknown as RequestPriceList;

async function enterEdit() {
  await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
}

async function removeFirstVendor() {
  await userEvent.click(screen.getByRole("button", { name: rv.removeVendor }));
  await userEvent.click(screen.getByRole("button", { name: en.common.delete }));
}

async function pickVendor(name: string) {
  const row = screen
    .getAllByRole("row")
    .find(
      (r) => r.textContent?.includes(name) && within(r).queryByRole("checkbox"),
    );
  if (!row) throw new Error(`ไม่พบแถวของ ${name} ใน dialog`);
  await userEvent.click(within(row).getByRole("checkbox"));
}

async function addVendorFromDialog(name: string) {
  await userEvent.click(screen.getByRole("button", { name: rv.addVendor }));
  await pickVendor(name);
  await userEvent.click(screen.getByRole("button", { name: /Add 1 vendor/i }));
}

const addAcmeBack = () => addVendorFromDialog("Acme Foods");

type VendorsPayload = {
  vendors?: {
    add?: { vendor_id: string }[];
    remove?: { id: string }[];
  };
};

describe("RequestPriceListForm — เพิ่ม/ลบผู้ขาย", () => {
  it("[view] เห็นผู้ขายที่บันทึกไว้ แต่ยังไม่มีปุ่มเพิ่ม/ลบ", () => {
    renderForm(<RequestPriceListForm requestPriceList={RFP_WITH_VENDOR} />);

    expect(screen.getByText("Acme Foods")).toBeTruthy();
    expect(screen.getByText("som@acme.test")).toBeTruthy();
    expect(screen.queryByRole("button", { name: rv.addVendor })).toBeNull();
    expect(screen.queryByRole("button", { name: rv.removeVendor })).toBeNull();
  });

  it("ลบผู้ขายเดิมแล้วบันทึก ส่ง remove ไปรายการเดียว", async () => {
    renderForm(<RequestPriceListForm requestPriceList={RFP_WITH_VENDOR} />);
    await enterEdit();
    await removeFirstVendor();
    await act(async () => submitForm("rfp-form"));

    // id ของบรรทัด (rv-1) ไม่ใช่ vendor_id (ven-1) — หลังบ้านลบตาม id ของบรรทัด เดิมส่ง
    // { vendor_id } ไป หลังบ้านได้ id = undefined แล้วไปลบบรรทัดแรกของตาราง (ใบอื่น)
    const { vendors } = firstPayload(updateMut) as VendorsPayload;
    expect(vendors?.remove).toEqual([{ id: "rv-1" }]);
    expect(vendors?.add).toBeUndefined();
  });

  /**
   * ลบแล้วเปลี่ยนใจเพิ่มกลับในการแก้ไขรอบเดียวกัน = ไม่มีอะไรเปลี่ยน ต้องไม่ส่ง
   * ทั้ง add และ remove — ถ้าส่งทั้งคู่ backend จะลบแถวเดิมแล้วสร้างใหม่
   * `url_token` เปลี่ยน ลิงก์ที่ส่งให้ผู้ขายไปแล้วใช้ไม่ได้
   */
  it("ลบแล้วเพิ่มคนเดิมกลับ ต้องไม่ส่งทั้ง add และ remove", async () => {
    renderForm(<RequestPriceListForm requestPriceList={RFP_WITH_VENDOR} />);
    await enterEdit();
    await removeFirstVendor();
    expect(screen.queryByText("Acme Foods")).toBeNull();

    await addAcmeBack();
    expect(screen.getByText("Acme Foods")).toBeTruthy();

    await act(async () => submitForm("rfp-form"));
    const { vendors } = firstPayload(updateMut) as VendorsPayload;
    expect(vendors?.remove).toBeUndefined();
    expect(vendors?.add).toBeUndefined();
  });
});

describe("RequestPriceListForm — ผู้ขายใหม่กับการเซฟซ้ำ", () => {
  it("เพิ่มผู้ขายรายใหม่ ส่ง add พร้อม sequence_no ต่อจากรายเดิม", async () => {
    renderForm(<RequestPriceListForm requestPriceList={RFP_WITH_VENDOR} />);
    await enterEdit();
    await addVendorFromDialog("Beta Farms");
    await act(async () => submitForm("rfp-form"));

    const { vendors } = firstPayload(updateMut) as VendorsPayload;
    expect(vendors?.remove).toBeUndefined();
    expect(vendors?.add).toEqual([
      expect.objectContaining({
        vendor_id: "ven-2",
        vendor_name: "Beta Farms",
        vendor_code: "V002",
        // ข้อมูลติดต่อเติมจากผู้ติดต่อหลักของผู้ขายให้เอง
        contact_person: "Lek",
        contact_email: "lek@beta.test",
        // ต่อจากผู้ขายเดิมที่ยังอยู่ 1 ราย
        sequence_no: 2,
        id: "",
      }),
    ]);
  });

  /**
   * เซฟแล้ว query ถูก invalidate → refetch คืนใบที่ผู้ขายใหม่มี id จริงแล้ว
   * ฟอร์มต้อง re-sync ตามไม่งั้นเซฟรอบสองจะส่ง add ซ้ำ สร้างผู้ขายซ้ำฝั่ง backend
   */
  it("เซฟรอบสองหลังข้อมูลกลับมาแล้ว ไม่ส่ง add ซ้ำ", async () => {
    // refetch จริงคือ prop เปลี่ยนใต้ provider เดิม — rerender() ของ RTL จะทิ้ง
    // provider ที่ renderForm ครอบไว้ เลยต้องสลับ prop จากใน component เอง
    function Harness() {
      const [rfp, setRfp] = useState(RFP_WITH_VENDOR);
      return (
        <>
          <button type="button" onClick={() => setRfp(AFTER_SAVE)}>
            refetch
          </button>
          <RequestPriceListForm requestPriceList={rfp} />
        </>
      );
    }

    renderForm(<Harness />);
    await enterEdit();
    await addVendorFromDialog("Beta Farms");
    await act(async () => submitForm("rfp-form"));
    expect(
      (firstPayload(updateMut) as VendorsPayload).vendors?.add,
    ).toHaveLength(1);

    updateMut.mutate.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "refetch" }));
    await enterEdit();
    await act(async () => submitForm("rfp-form"));

    const { vendors } = firstPayload(updateMut) as VendorsPayload;
    expect(vendors?.add).toBeUndefined();
    expect(vendors?.remove).toBeUndefined();
  });
});

const AFTER_SAVE = {
  ...RFP_WITH_VENDOR,
  vendors: [
    ...(RFP_WITH_VENDOR.vendors ?? []),
    {
      id: "rv-2",
      vendor: { id: "ven-2", name: "Beta Farms", code: "V002" },
      contact_person: "Lek",
      contact_phone: "02-111",
      contact_email: "lek@beta.test",
      url_token: "tok-2",
      has_submitted: false,
      pricelist: null,
    },
  ],
} as unknown as RequestPriceList;
