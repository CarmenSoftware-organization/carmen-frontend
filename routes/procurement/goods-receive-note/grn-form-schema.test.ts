import { describe, it, expect } from "vitest";
import {
  EMPTY_DETAIL,
  EMPTY_EXTRA_COST,
  createGrnSchema,
  getDefaultValues,
  mapDetailToPayload,
  pickTouchedLineUpdates,
  type GrnFormValues,
} from "./grn-form-schema";

const tv = ((k: string, p?: Record<string, string>) =>
  p?.field ? `${k}:${p.field}` : k) as never;
const tf = ((k: string) => k) as never;
const schema = createGrnSchema(tv, tf);

const item = (over: Partial<GrnFormValues["items"][number]> = {}) => ({
  ...EMPTY_DETAIL,
  product_id: "prod-1",
  location_id: "loc-1",
  received_unit_id: "unit-1",
  received_qty: 10,
  unit_price: 25,
  ...over,
});

const valid = (): GrnFormValues =>
  ({
    ...getDefaultValues(),
    invoice_no: "INV-001",
    invoice_date: "2026-08-31T00:00:00.000Z",
    vendor_id: "vendor-1",
    currency_id: "cur-1",
    items: [item()],
  }) as GrnFormValues;

const paths = (v: unknown) => {
  const r = schema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("createGrnSchema — หัวใบ", () => {
  it("ใบที่กรอกครบผ่าน", () => {
    expect(schema.safeParse(valid()).success).toBe(true);
  });

  it("เลขที่ใบแจ้งหนี้ · วันที่ใบแจ้งหนี้ · ผู้ขาย · สกุลเงิน ขาดไม่ได้", () => {
    expect(paths({ ...valid(), invoice_no: "" })).toContain("invoice_no");
    expect(paths({ ...valid(), invoice_date: null })).toContain("invoice_date");
    expect(paths({ ...valid(), vendor_id: null })).toContain("vendor_id");
    expect(paths({ ...valid(), currency_id: "" })).toContain("currency_id");
  });

  it("ใบที่ไม่มีรายการเลย บันทึกไม่ได้", () => {
    expect(paths({ ...valid(), items: [] })).toContain("items");
  });
});

describe("createGrnSchema — กติกาของแถว", () => {
  it("สินค้า · คลัง · หน่วยที่รับ ขาดไม่ได้", () => {
    expect(
      paths({ ...valid(), items: [item({ product_id: null })] }),
    ).toContain("items.0.product_id");
    expect(
      paths({ ...valid(), items: [item({ location_id: null })] }),
    ).toContain("items.0.location_id");
    expect(
      paths({ ...valid(), items: [item({ received_unit_id: null })] }),
    ).toContain("items.0.received_unit_id");
  });

  it("รับของแล้วต้องมีราคา — ไม่งั้น backend ตอบ 400 ตอนกดบันทึก", () => {
    // นี่คือกติกาที่ superRefine มีไว้: received_price บังคับเมื่อ received_qty > 0
    for (const price of [0, undefined, -5]) {
      expect(
        paths({
          ...valid(),
          items: [item({ received_qty: 5, unit_price: price })],
        }),
        String(price),
      ).toContain("items.0.unit_price");
    }
  });

  it("แถวที่ยังไม่ได้รับของ (qty 0) ไม่บังคับราคา — ของแถมใช้ช่อง FOC แยก", () => {
    expect(
      paths({
        ...valid(),
        items: [item({ received_qty: 0, unit_price: 0, foc_qty: 3 })],
      }),
    ).not.toContain("items.0.unit_price");
  });

  it("ค่าใช้จ่ายเพิ่มเติมต้องเลือกประเภท และจำนวนเงินติดลบไม่ได้", () => {
    const withCost = (over: Partial<typeof EMPTY_EXTRA_COST>) => ({
      ...valid(),
      extra_cost_details: [
        { ...EMPTY_EXTRA_COST, extra_cost_type_id: "ec-1", ...over },
      ],
    });
    expect(schema.safeParse(withCost({})).success).toBe(true);
    expect(paths(withCost({ extra_cost_type_id: "" }))).toContain(
      "extra_cost_details.0.extra_cost_type_id",
    );
    expect(paths(withCost({ amount: -1 }))).toContain(
      "extra_cost_details.0.amount",
    );
  });
});

describe("getDefaultValues", () => {
  it("ใบใหม่เริ่มที่ draft และตั้งวันครบกำหนดเป็นวันนี้ ไม่ปล่อยว่าง", () => {
    const d = getDefaultValues();
    expect(d.doc_status).toBe("draft");
    expect(d.doc_type).toBe("purchase_order");
    expect(d.exchange_rate).toBe(1);
    // ปล่อย null ไว้จะไปติด required ตอนกดบันทึกทั้งที่คนกรอกไม่รู้ว่าต้องกรอก
    expect(d.payment_due_date).not.toBeNull();
    expect(d.items).toEqual([]);
  });

  it("รับสกุลเงิน default ของ BU มาเป็นค่าตั้งต้น", () => {
    const d = getDefaultValues(undefined, {
      defaultCurrencyId: "cur-thb",
      defaultCurrencyCode: "THB",
    });
    expect(d.currency_id).toBe("cur-thb");
    expect(d.currency_name).toBe("THB");
  });
});

describe("mapDetailToPayload", () => {
  it("ฟอร์มเก็บ unit_price แต่ backend ชื่อ received_price — ต้องแปลงชื่อ", () => {
    const p = mapDetailToPayload(item({ unit_price: 25 }));
    expect(p.received_price).toBe(25);
    expect("unit_price" in p).toBe(false);
  });

  it("ไม่มีราคา ส่ง 0 ไม่ใช่ undefined — ฟิลด์นี้ backend บังคับ", () => {
    expect(
      mapDetailToPayload(item({ unit_price: undefined })).received_price,
    ).toBe(0);
  });

  it("แถวใหม่ไม่ส่ง doc_version ส่วนแถวเดิมส่งไปด้วย (optimistic lock)", () => {
    expect("doc_version" in mapDetailToPayload(item())).toBe(false);
    expect(mapDetailToPayload(item({ doc_version: 3 })).doc_version).toBe(3);
  });

  it("ไม่มีโปรไฟล์ภาษี = ไม่ส่งฟิลด์นั้นเลย ไม่ใช่ส่ง null", () => {
    expect("tax_profile_id" in mapDetailToPayload(item())).toBe(false);
    expect(
      mapDetailToPayload(item({ tax_profile_id: "tax-1" })).tax_profile_id,
    ).toBe("tax-1");
  });
});

describe("pickTouchedLineUpdates", () => {
  type Line = GrnFormValues["items"][number];
  // ค่าเดิมเรียง key ตามตัว map ตอนโหลด ส่วนค่าตอนกด Save ผ่าน zod แล้วเรียงตาม schema
  // จำลองด้วยการกลับลำดับ key ของฝั่งค่าเดิม
  const reorder = (line: Line) =>
    Object.fromEntries(Object.entries(line).reverse()) as Line;
  const loaded = [
    item({ id: "line-1", received_qty: 5, unit_price: 100 }),
    item({ id: "line-2", received_qty: 3, unit_price: 33.33 }),
  ];
  const original = loaded.map(reorder);
  const update = [{ id: "line-1" }, { id: "line-2" }];

  it("ไม่ส่งแถวที่ไม่ได้แตะ แม้ลำดับ key ต่างกันและค่าคำนวณคลาดไปเป็นสตางค์", () => {
    // แถว 2 เก็บราคา 33.33333 → ยอดเดิม 99.99999 แต่ฟอร์มคำนวณใหม่ได้ 99.99
    const current = [
      { ...loaded[0], received_qty: 6 },
      {
        ...loaded[1],
        net_amount: 99.99,
        total_price: 99.99,
        received_base_qty: 3,
      },
    ];
    const before = [
      original[0],
      { ...original[1], net_amount: 99.99999, total_price: 99.99999 },
    ];
    expect(pickTouchedLineUpdates(update, current, before)).toEqual([
      { id: "line-1" },
    ]);
  });

  it("ส่วนลด/ภาษีที่คำนวณเองไม่นับ แต่ถ้าติ๊กปรับเองแล้วแก้ ต้องส่ง", () => {
    const computed = [
      loaded[0],
      { ...loaded[1], discount_amount: 1.23, tax_amount: 4.56 },
    ];
    expect(pickTouchedLineUpdates(update, computed, original)).toBeUndefined();

    const adjusted = [
      loaded[0],
      { ...loaded[1], is_discount_adjustment: true, discount_amount: 1.23 },
    ];
    const adjustedBefore = [
      original[0],
      { ...original[1], is_discount_adjustment: true },
    ];
    expect(pickTouchedLineUpdates(update, adjusted, adjustedBefore)).toEqual([
      { id: "line-2" },
    ]);
  });

  it("ย้ายตำแหน่งแถวนับเป็นการแก้", () => {
    expect(
      pickTouchedLineUpdates(update, [loaded[1], loaded[0]], original),
    ).toEqual(update);
  });
});

/**
 * ใบรับสินค้าที่รับสินค้าตัวเดียวกันเข้าสองคลัง — หลังบ้านคืนมาเป็น **สอง detail**
 * ที่ `purchase_order_detail_id` กับ `product_id` ซ้ำกัน ต่างกันแค่คลัง
 *
 * เคยหายไปแถวหนึ่งเพราะตารางจัดกลุ่มด้วย product_id แล้วยุบสองแถวเป็นแถวเดียว
 * (ต้องกางถึงจะเห็นว่ามีสองคลัง) — ตัดมาจาก response จริงของ GRN260900005
 */
const twoLocationsOneProduct = {
  doc_status: "saved",
  doc_type: "purchase_order",
  good_received_note_detail: [
    {
      id: "detail-a",
      sequence_no: 1,
      purchase_order_detail: { id: "po-detail-1" },
      location: { id: "loc-direct", name: "Rooms-Front Office - Direct" },
      product: { id: "prod-roselle", name: "Dried Roselle 1 kg" },
      doc_version: 0,
      items: [{ received_qty: 23, sub_total_price: 1288 }],
    },
    {
      id: "detail-b",
      sequence_no: 2,
      purchase_order_detail: { id: "po-detail-1" },
      location: { id: "loc-it", name: "IT" },
      product: { id: "prod-roselle", name: "Dried Roselle 1 kg" },
      doc_version: 0,
      items: [{ received_qty: 24, sub_total_price: 1344 }],
    },
  ],
} as unknown as Parameters<typeof getDefaultValues>[0];

describe("สินค้าตัวเดียวกันเข้าสองคลัง", () => {
  it("ได้สองแถว ไม่ยุบเป็นแถวเดียว", () => {
    const values = getDefaultValues(twoLocationsOneProduct);
    expect(values.items).toHaveLength(2);
    expect(values.items.map((i) => i.location_id)).toEqual([
      "loc-direct",
      "loc-it",
    ]);
    expect(values.items.map((i) => i.received_qty)).toEqual([23, 24]);
  });

  it("แต่ละแถวถือ id ของ detail ไม่ใช่ id ของ item ข้างใน", () => {
    const values = getDefaultValues(twoLocationsOneProduct);
    expect(values.items.map((i) => i.id)).toEqual(["detail-a", "detail-b"]);
  });

  it("ราคาต่อหน่วยคิดจากยอดของแถวนั้น ไม่ใช่ของแถวแรก", () => {
    const values = getDefaultValues(twoLocationsOneProduct);
    // 1288/23 = 56 · 1344/24 = 56 — เท่ากันในเคสนี้ แต่ต้องคิดแยกแถว
    expect(values.items.map((i) => i.unit_price)).toEqual([56, 56]);
  });
});

const detailFromResponse = {
  id: "ec38f32c",
  good_received_note_id: "grn-1",
  sequence_no: 1,
  // หลังบ้านส่ง null มาทั้งที่แถวนี้อ้าง PO อยู่ — ตัวที่บอกว่าอ้าง PO คือ
  // purchase_order_detail ไม่ใช่ purchase_order
  purchase_order: null,
  purchase_order_detail: { id: "po-detail-1" },
  po_no: "PO20260300042",
  location: {
    id: "loc-direct",
    code: "2FO03",
    name: "Rooms-Front Office - Direct",
  },
  location_type: "direct",
  product: {
    id: "prod-roselle",
    code: "11140012",
    name: "Dried Roselle 1 kg",
    local_name: "กระเจี๊ยบแห้ง 1กก.",
  },
  product_sku: null,
  doc_version: 4,
  items: [
    {
      id: "item-1",
      good_received_note_detail_id: "ec38f32c",
      order_qty: 25,
      order_unit: { id: "unit-kg" },
      received_qty: 23,
      received_unit: { id: "unit-kg" },
      received_unit_conversion_factor: 1,
      received_base_qty: 23,
      received_price: 56,
      foc_qty: 2,
      foc_unit: { id: "unit-kg" },
      foc_unit_conversion_factor: 1,
      tax_profile: { id: "tax-1" },
      tax_rate: 7,
      tax_amount: 90.16,
      is_tax_adjustment: false,
      discount_rate: 5,
      discount_amount: 64.4,
      is_discount_adjustment: true,
      sub_total_price: 1288,
      net_amount: 1223.6,
      total_price: 1313.76,
      note: "ของครบ",
      // doc_version ของ item เดินคนละเลขกับของ detail — ห้ามหยิบตัวนี้ไปส่ง
      doc_version: 9,
    },
  ],
} as const;

const grnFromResponse = {
  doc_status: "saved",
  doc_type: "purchase_order",
  good_received_note_detail: [detailFromResponse],
} as unknown as Parameters<typeof getDefaultValues>[0];

describe("getDefaultValues ตาม response ใหม่", () => {
  const row = () => getDefaultValues(grnFromResponse).items[0];

  it("ค่าระดับ detail อ่านจาก detail ค่าระดับ item อ่านจาก items[0]", () => {
    const r = row();
    expect(r.location_id).toBe("loc-direct");
    expect(r.location_type).toBe("direct");
    expect(r.product_local_name).toBe("กระเจี๊ยบแห้ง 1กก.");
    expect(r.received_qty).toBe(23);
    expect(r.foc_qty).toBe(2);
    expect(r.note).toBe("ของครบ");
  });

  it("จำนวนที่สั่งของฟอร์มคือ order_qty ของ item — ฟอร์มเรียกว่า approved_qty", () => {
    expect(row().approved_qty).toBe(25);
    expect(row().approved_unit_id).toBe("unit-kg");
  });

  it("ราคาต่อหน่วยคำนวณจากยอดก่อนลดหารจำนวนที่รับ ไม่ได้อ่าน received_price", () => {
    // 1288 / 23 = 56 — response มี received_price ให้อยู่แล้วแต่โค้ดไม่ได้ใช้
    expect(row().unit_price).toBe(56);
  });

  it("doc_version ของแถวคือของ detail ไม่ใช่ของ item ข้างใน", () => {
    // ส่งเลขของ item ไปจะ 409 ทุกครั้งที่แก้ เพราะ backend ล็อกด้วยเลขของ detail
    expect(row().doc_version).toBe(4);
  });

  it("เลขที่ใบสั่งซื้ออ่านจาก po_no ส่วน purchase_order_id ที่เป็น null ไม่ทำให้พัง", () => {
    expect(row().purchase_order_no).toBe("PO20260300042");
    expect(row().purchase_order_id).toBeNull();
    // ตัวที่ตัดสินว่าแถวนี้อ้าง PO (แก้สินค้า/คลังไม่ได้) คือฟิลด์นี้
    expect(row().purchase_order_detail_id).toBe("po-detail-1");
  });

  it("ส่วนลด/ภาษีที่ override ไว้ขนธง is_*_adjustment กลับมาด้วย", () => {
    const r = row();
    expect(r.is_discount_adjustment).toBe(true);
    expect(r.discount_amount).toBe(64.4);
    expect(r.is_tax_adjustment).toBe(false);
    expect(r.tax_rate).toBe(7);
  });

  it("detail ที่ item ถูกลบไปแล้วยังเป็นแถว ค่าเป็น 0 ไม่ใช่หายไปเงียบ ๆ", () => {
    // แถวที่หายไปจะกลายเป็น remove ตอนบันทึกครั้งถัดไป ทั้งที่ผู้ใช้ไม่ได้ลบ
    const empty = {
      ...grnFromResponse,
      good_received_note_detail: [{ ...detailFromResponse, items: [] }],
    } as unknown as Parameters<typeof getDefaultValues>[0];
    const values = getDefaultValues(empty);
    expect(values.items).toHaveLength(1);
    expect(values.items[0].received_qty).toBe(0);
    expect(values.items[0].unit_price).toBe(0);
  });
});

describe("mapDetailToPayload ตาม payload ใหม่", () => {
  const payload = () =>
    mapDetailToPayload(getDefaultValues(grnFromResponse).items[0]);

  it("ส่ง doc_version ของ detail กลับไปเพื่อ optimistic lock", () => {
    expect(payload().doc_version).toBe(4);
  });

  it("ราคาที่รับส่งชื่อ received_price ไม่ใช่ unit_price ของฟอร์ม", () => {
    expect(payload().received_price).toBe(56);
    expect(payload()).not.toHaveProperty("unit_price");
  });

  it("ไม่ส่งฟิลด์ที่เป็นของฝั่งแสดงผลอย่างเดียว", () => {
    const p = payload() as unknown as Record<string, unknown>;
    for (const key of [
      "product_name",
      "product_local_name",
      "location_name",
      "location_code",
      "purchase_order_no",
      "id",
    ]) {
      expect(p).not.toHaveProperty(key);
    }
  });

  it("ธง override กับยอดที่ผู้ใช้กรอกเองถูกส่งตามนั้น", () => {
    const p = payload();
    expect(p.is_discount_adjustment).toBe(true);
    expect(p.discount_amount).toBe(64.4);
    expect(p.tax_profile_id).toBe("tax-1");
  });
});

/**
 * หัวค่าใช้จ่ายเพิ่มเติมจาก `GET .../good-received-notes/{id}` เป็น object เดียว บรรทัดซ้อนอยู่ข้างใน
 * (ยืนยันจาก live 2026-10-23) — ของเดิมอ่าน `extra_cost[0]` กับ `extra_cost_detail` ระดับบน
 * ซึ่งไม่มีจริง ฟอร์มแก้ไขจึงเปิดมาโดยไม่มีค่าใช้จ่ายเดิมเลยทุกใบ
 */
describe("ค่าใช้จ่ายเพิ่มเติมของใบเดิม", () => {
  const withExtraCost = {
    ...twoLocationsOneProduct,
    extra_cost: {
      id: "ec-1",
      allocate_extra_cost_type: "by_value",
      extra_cost_detail: [
        {
          id: "ecd-1",
          extra_cost_type: { id: "ect-freight" },
          note: "truck",
          amount: 150,
        },
      ],
    },
  } as unknown as Parameters<typeof getDefaultValues>[0];

  it("โหลดวิธีกระจายและบรรทัดจากหัวค่าใช้จ่ายของใบ", () => {
    const values = getDefaultValues(withExtraCost);
    expect(values.allocate_extra_cost_type).toBe("by_value");
    expect(values.extra_cost_details).toEqual([
      { id: "ecd-1", extra_cost_type_id: "ect-freight", note: "truck", amount: 150 },
    ]);
  });

  it("ใบที่ไม่มีหัวค่าใช้จ่ายได้ค่าเริ่มต้น", () => {
    const values = getDefaultValues({
      ...twoLocationsOneProduct,
      extra_cost: null,
    } as unknown as Parameters<typeof getDefaultValues>[0]);
    expect(values.allocate_extra_cost_type).toBe("by_qty");
    expect(values.extra_cost_details).toEqual([]);
  });
});
