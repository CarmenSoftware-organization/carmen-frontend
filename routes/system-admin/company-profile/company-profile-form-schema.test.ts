import { describe, it, expect } from "vitest";
import type {
  BusinessUnitDetail,
  BusinessUnitConfigItem,
} from "@/types/business-unit";
import {
  toFormValues,
  buildPatch,
  mergeSeededConfig,
  normalizeConfig,
  toPatchPayload,
} from "./company-profile-form-schema";

const baseData: BusinessUnitDetail = {
  id: "bu-1",
  cluster_id: "cl-1",
  code: "PP01",
  name: "PP @ PP",
  alias_name: "PP",
  description: null,
  info: null,
  is_hq: true,
  is_active: true,
  db_connection: null,
  config: {},
  default_currency_id: "cur-1",
  calculation_method: "average",
  branch_no: null,
  company_name: null,
  company_address_line1: null,
  company_address_line2: null,
  company_sub_district: null,
  company_district: null,
  company_city: null,
  company_province: null,
  company_postal_code: null,
  company_country: null,
  company_latitude: null,
  company_longitude: null,
  company_email: null,
  company_tel: null,
  tax_no: null,
  hotel_name: null,
  hotel_address_line1: null,
  hotel_address_line2: null,
  hotel_sub_district: null,
  hotel_district: null,
  hotel_city: null,
  hotel_province: null,
  hotel_postal_code: null,
  hotel_country: null,
  hotel_latitude: null,
  hotel_longitude: null,
  hotel_email: null,
  hotel_tel: null,
  date_format: "yyyy-MM-dd",
  date_time_format: "yyyy-MM-dd HH:mm:ss",
  time_format: "HH:mm:ss",
  short_time_format: "HH:mm",
  long_time_format: "HH:mm:ss",
  timezone: "Asia/Bangkok",
  amount_format: { locales: "th-TH", minimumIntegerDigits: 2 },
  quantity_format: { locales: "th-TH", minimumIntegerDigits: 2 },
  recipe_format: { locales: "th-TH", minimumIntegerDigits: 2 },
  doc_version: 1,
  cluster_name: "ZEBRA",
  logo: null,
  avatar: null,
  audit: null,
};

describe("buildPatch", () => {
  it("ส่งเฉพาะ field ที่แก้ (name + company_name)", () => {
    const original = toFormValues(baseData);
    const values = {
      ...original,
      name: "New name",
      company_name: "ACME",
    };
    expect(buildPatch(values, original)).toEqual({
      name: "New name",
      company_name: "ACME",
    });
  });

  // max_license_users ถูกถอดออกทั้งจาก type และหน้าจอแล้ว (ที่นั่งมาจากใบ license ที่ carmen-backstage)
  // การ assert ว่ามันเป็น undefined จึงเป็นเทสต์ที่ผ่านโดยไม่พิสูจน์อะไร
  // max_license_users is gone from both the type and the screen, so asserting it is undefined
  // would be a test that passes without proving anything.
  it("costing method ไม่อยู่ในฟอร์ม จึงไม่มีทางถูกส่ง (read-only)", () => {
    const values = toFormValues(baseData) as Record<string, unknown>;
    expect(values.calculation_method).toBeUndefined();
  });

  it("คืน patch ว่างเมื่อไม่มีอะไรเปลี่ยน", () => {
    const original = toFormValues(baseData);
    expect(buildPatch({ ...original }, original)).toEqual({});
  });

  it("แปลง text field ว่างกลับเป็น null", () => {
    const original = toFormValues(baseData);
    const values = { ...original, alias_name: "" };
    expect(buildPatch(values, original)).toEqual({ alias_name: null });
  });

  it("ส่งทั้ง object เมื่อ number-format เปลี่ยนส่วนใดส่วนหนึ่ง", () => {
    const original = toFormValues(baseData);
    const values = {
      ...original,
      amount_format: { locales: "en-US", minimumIntegerDigits: 2 },
    };
    expect(buildPatch(values, original)).toEqual({
      amount_format: { locales: "en-US", minimumIntegerDigits: 2 },
    });
  });
});

describe("mergeSeededConfig", () => {
  it("seeds the PR item when backend config is empty ({})", () => {
    const merged = mergeSeededConfig(normalizeConfig({}));
    // assert per-key (registry may seed other items too, e.g. SI)
    expect(merged.find((i) => i.key === "pr.allow-duplicate.product")).toEqual({
      key: "pr.allow-duplicate.product",
      label: "Allow selecting duplicate products",
      datatype: "boolean",
      value: "false",
    });
  });

  it("does not duplicate when backend already has the key", () => {
    const backend: BusinessUnitConfigItem[] = [
      {
        key: "pr.allow-duplicate.product",
        label: "L",
        datatype: "boolean",
        value: "true",
      },
    ];
    const merged = mergeSeededConfig(backend);
    // the backend key is kept as-is (not re-seeded), exactly once
    expect(
      merged.filter((i) => i.key === "pr.allow-duplicate.product"),
    ).toEqual(backend);
  });

  it("keeps unknown backend items first, then appends seeded items", () => {
    const backend: BusinessUnitConfigItem[] = [
      { key: "x.unknown", label: "X", datatype: "string", value: "1" },
    ];
    const merged = mergeSeededConfig(backend);
    // backend item stays first; seeded items (e.g. PR) appended after
    expect(merged[0]).toEqual(backend[0]);
    expect(merged.some((i) => i.key === "pr.allow-duplicate.product")).toBe(
      true,
    );
    expect(merged.length).toBeGreaterThan(1);
  });
});

describe("buildPatch — seeded config", () => {
  it("does not send config when the seeded item is untouched", () => {
    const original = toFormValues(baseData); // baseData.config = {} → seeded to [pr false]
    expect(buildPatch({ ...original }, original).config).toBeUndefined();
  });

  // ค่าที่ handleSubmit ส่งมาผ่าน zod แล้ว key เรียงตาม configItemSchema ส่วนค่าเดิมมาจาก
  // jsonb ซึ่ง Postgres เรียงตามความยาวชื่อ key (key, label, value, datatype)
  it("does not send config when only the key order differs from the stored jsonb", () => {
    const original = toFormValues({
      ...baseData,
      config: [
        {
          key: "si.cost-from",
          label: "Default price",
          value: "last_cost",
          datatype: "enum",
        },
      ] as unknown as BusinessUnitDetail["config"],
    });
    const values = {
      ...original,
      config: original.config.map(({ key, label, datatype, value }) => ({
        key,
        label,
        datatype,
        value,
      })),
    };
    expect(buildPatch(values, original).config).toBeUndefined();
  });

  it("sends the whole config array when the PR switch is toggled on", () => {
    const original = toFormValues(baseData);
    const values = {
      ...original,
      config: [{ ...original.config[0], value: "true" }],
    };
    expect(buildPatch(values, original)).toEqual({
      config: [
        {
          key: "pr.allow-duplicate.product",
          label: "Allow selecting duplicate products",
          datatype: "boolean",
          value: "true",
        },
      ],
    });
  });
});

// PATCH api/business-units ไม่มี bu_code — backend เขียนลง BU default ของผู้ใช้ ถ้ามีการสลับ BU จากที่อื่น
// ระหว่างที่หน้านี้เปิดอยู่ id ที่แนบไปจะไม่ตรง แล้ว backend ตอบ 409 BUSINESS_UNIT_NOT_CURRENT แทนการเขียนผิด BU
describe("toPatchPayload", () => {
  it("sends the loaded BU id and its doc_version with the patch", () => {
    const loaded = { ...baseData, id: "bu-loaded", doc_version: 7 };
    expect(toPatchPayload({ name: "New name" }, loaded)).toEqual({
      name: "New name",
      id: "bu-loaded",
      doc_version: 7,
    });
  });

  it("takes the loaded BU over anything the patch carries", () => {
    const loaded = { ...baseData, id: "bu-loaded", doc_version: 7 };
    expect(toPatchPayload({ id: "bu-other", doc_version: 1 }, loaded)).toEqual({
      id: "bu-loaded",
      doc_version: 7,
    });
  });
});
