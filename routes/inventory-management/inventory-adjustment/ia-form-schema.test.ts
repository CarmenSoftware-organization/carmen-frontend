import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  createAdjSchema,
  getDefaultValues,
  latestIssuableDate,
  mapItemToPayload,
} from "./ia-form-schema";
import type { InventoryAdjustment } from "@/types/inventory-adjustment";

const adjustment = {
  id: "db0c651b-fd83-43e7-99e8-893ebcbf3a18",
  si_date: "2026-05-31T00:00:00.000Z",
  si_no: "SI260500008",
  description: "555",
  adjustment_type_id: "c0fa2904-e708-4d28-84fe-f0dda8686f0f",
  doc_status: "draft",
  location_id: "47414c16-9d52-4b16-8428-4a4c4e89986e",
  stock_in_detail: [
    {
      id: "6e9ab38b-3174-489f-85e5-70645b206c4a",
      sequence_no: 1,
      product: {
        id: "101a24a6-d6e5-450f-8ee6-665779eb4210",
        name: "Brushtail Estate Grey Label Sparkling 33033",
        code: "22060006",
        local_name: "Brushtail Estate Grey Label Sparkling 33033",
      },
      // หน่วยนับมาเป็น object ไม่ใช่ flat string — จุดที่เคยอ่านพลาด
      inventory_unit: {
        id: "b5b22dba-fff4-4662-8e43-b25566402461",
        name: "BTL",
      },
      description: null,
      qty: 20,
      cost_per_unit: 300,
      total_cost: 6000,
      doc_version: 0,
    },
  ],
} as unknown as InventoryAdjustment;

describe("getDefaultValues", () => {
  // endpoint รายละเอียดคืน inventory_unit เป็น object ส่วน list คืน flat string
  // อ่านทางเดียวแล้วคอลัมน์ Unit ว่างทุกใบที่เปิดขึ้นมาแก้
  it("อ่านหน่วยนับจาก object ที่ backend ส่งมาจริง", () => {
    const values = getDefaultValues(adjustment);

    expect(values.items[0].unit_name).toBe("BTL");
  });

  it("ยังอ่านแบบ flat string ได้ (endpoint list)", () => {
    const flat = {
      ...adjustment,
      stock_in_detail: [
        {
          ...adjustment.stock_in_detail![0],
          inventory_unit: undefined,
          inventory_unit_name: "KG",
        },
      ],
    } as unknown as InventoryAdjustment;

    expect(getDefaultValues(flat).items[0].unit_name).toBe("KG");
  });

  // ทรงที่ stock-ins/{id} คืนมาจริงหลัง gateway ติด @CollapseRefs — header ยุบเป็น
  // ก้อน และก้อน adjustment_type ไม่มี name มาด้วย (ต่างจาก endpoint list)
  it("อ่าน header ที่ยุบเป็น object แล้ว (endpoint รายละเอียด)", () => {
    const collapsed = {
      ...adjustment,
      adjustment_type_id: undefined,
      location_id: undefined,
      adjustment_type: {
        id: "c0fa2904-e708-4d28-84fe-f0dda8686f0f",
        code: "TEST-STOCK_IN",
      },
      location: {
        id: "47414c16-9d52-4b16-8428-4a4c4e89986e",
        name: "Movement Test WH",
        code: "TEST-MOVE",
      },
    } as unknown as InventoryAdjustment;

    const values = getDefaultValues(collapsed);

    expect(values.adjustment_type_id).toBe(
      "c0fa2904-e708-4d28-84fe-f0dda8686f0f",
    );
    expect(values.location_id).toBe("47414c16-9d52-4b16-8428-4a4c4e89986e");
  });

  it("ที่เหลือ map ครบตาม response", () => {
    const values = getDefaultValues(adjustment);

    expect(values).toMatchObject({
      description: "555",
      doc_status: "draft",
      adjustment_type_id: "c0fa2904-e708-4d28-84fe-f0dda8686f0f",
      date: "2026-05-31T00:00:00.000Z",
      location_id: "47414c16-9d52-4b16-8428-4a4c4e89986e",
    });
    expect(values.items[0]).toMatchObject({
      id: "6e9ab38b-3174-489f-85e5-70645b206c4a",
      product_id: "101a24a6-d6e5-450f-8ee6-665779eb4210",
      product_name: "Brushtail Estate Grey Label Sparkling 33033",
      qty: 20,
      cost_per_unit: 300,
      total_cost: 6000,
      // description เป็น null ในฐานข้อมูล ต้องกลายเป็นสตริงว่าง ไม่ใช่ null
      description: "",
    });
  });
});

describe("mapItemToPayload", () => {
  // /save ตอบ 400 "stock_in_detail.update.0.doc_version: Required" ถ้าไม่ส่งกลับ
  it("แถวที่มีอยู่แล้วส่ง doc_version กลับไปด้วย", () => {
    const item = getDefaultValues(adjustment).items[0];

    expect(mapItemToPayload(item)).toMatchObject({ doc_version: 0 });
  });

  // แถวที่เพิ่งกดเพิ่มยังไม่มีเวอร์ชัน ส่ง undefined ไปจะกลายเป็น invalid_type
  it("แถวใหม่ไม่มี doc_version ในผลลัพธ์เลย", () => {
    const payload = mapItemToPayload({
      product_id: "p1",
      product_name: "",
      product_local_name: "",
      unit_name: "",
      qty: 1,
      cost_per_unit: 1,
      total_cost: 1,
      description: "",
    });

    expect("doc_version" in payload).toBe(false);
  });
});

// e2e SO.3 (2026-10-02): the stock-out detail endpoint returned no line cost, the form took
// undefined, and z.coerce.number turned it into NaN in a hidden field — Save then did nothing,
// with no request and no toast.
describe("getDefaultValues — stock-out line without a cost", () => {
  const stockOut = {
    id: "so-1",
    so_date: "2026-07-15T00:00:00.000Z",
    so_no: "SO260700002",
    description: "",
    adjustment_type: { id: "type-1" },
    doc_status: "draft",
    location: { id: "loc-1" },
    stock_out_detail: [
      {
        id: "line-1",
        product: { id: "prod-1", name: "Seaweed snack", local_name: "" },
        inventory_unit: { id: "u-1", name: "BAG" },
        description: null,
        qty: 2,
        doc_version: 0,
      },
    ],
  } as unknown as InventoryAdjustment;

  it("reads a missing cost as 0, and the form still validates", () => {
    const values = getDefaultValues(stockOut);
    expect(values.items[0]).toMatchObject({ cost_per_unit: 0, total_cost: 0 });

    const tv = (key: string) => key;
    const parsed = createAdjSchema(tv, tv).safeParse(values);
    expect(parsed.success).toBe(true);
  });
});

// SI/SO ลงวันที่อนาคตไม่ได้ (ผู้ใช้ขอ 2026-10-07) — ทั้งปฏิทินและ validation
describe("SI/SO date — never after today", () => {
  const tv = (key: string) => key;
  const NOW = new Date(2026, 9, 7, 14, 30); // 7 ต.ค. 14:30 เวลาเครื่อง
  const at = (y: number, m: number, d: number) => new Date(y, m, d).toISOString();
  const form = (date: string) => ({
    description: "",
    doc_status: "draft",
    adjustment_type_id: "type-1",
    date,
    location_id: "loc-1",
    items: [
      {
        product_id: "prod-1",
        product_name: "Sugar",
        product_local_name: "",
        unit_name: "KG",
        qty: 1,
        cost_per_unit: 0,
        total_cost: 0,
        description: "",
      },
    ],
  });
  const errorsOf = (date: string) => {
    const parsed = createAdjSchema(tv, tv).safeParse(form(date));
    return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("accepts today and any earlier day", () => {
    expect(errorsOf(at(2026, 9, 7))).toEqual([]);
    expect(errorsOf(at(2026, 9, 1))).toEqual([]);
  });

  it("refuses tomorrow", () => {
    expect(errorsOf(at(2026, 9, 8))).toContain("dateAfterToday");
  });

  it("stops the calendar at today, or at the period end when that comes first", () => {
    expect(latestIssuableDate().getDate()).toBe(7);
    expect(latestIssuableDate(at(2026, 9, 31)).getDate()).toBe(7);
    expect(latestIssuableDate(at(2026, 8, 30)).toISOString()).toBe(at(2026, 8, 30));
  });
});
