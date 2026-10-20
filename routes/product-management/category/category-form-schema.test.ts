import { describe, it, expect } from "vitest";
import {
  createCategorySchema,
  stripAutoCode,
  type CategoryFormValues,
} from "./category-form-schema";

// schema รับตัวแปลมาแล้วคืนคีย์ดิบ — เทสต์สนใจว่ากฎไหนไม่ผ่าน ไม่ใช่สำนวนภาษาไทย
const t = ((key: string) => key) as never;
const categorySchema = createCategorySchema(t, t);

const baseValues: CategoryFormValues = {
  code: "",
  name: "Beverage",
  description: "",
  is_active: true,
  price_deviation_limit: 0,
  qty_deviation_limit: 0,
  is_used_in_recipe: false,
  is_sold_directly: false,
  tax_profile_id: "tax-1",
  tax_rate: 0,
};

describe("categorySchema — code is optional (server-assigned)", () => {
  it("parses successfully with an empty code (add mode)", () => {
    const result = categorySchema.safeParse(baseValues);
    expect(result.success).toBe(true);
  });

  it("parses successfully with no code key at all", () => {
    const { code: _code, ...withoutCode } = baseValues;
    const result = categorySchema.safeParse(withoutCode);
    expect(result.success).toBe(true);
  });
});

describe("categorySchema — เพดานส่วนเบี่ยงเบน", () => {
  it("เกิน 100% ไม่ผ่าน และได้ข้อความจากระบบแปล ไม่ใช่ของ zod", () => {
    const result = categorySchema.safeParse({
      ...baseValues,
      price_deviation_limit: 150,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("maxNumber");
  });

  it("ติดลบไม่ผ่านเหมือนกัน", () => {
    const result = categorySchema.safeParse({
      ...baseValues,
      qty_deviation_limit: -1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("minZero");
  });

  it("0–100 ผ่าน", () => {
    expect(
      categorySchema.safeParse({ ...baseValues, price_deviation_limit: 100 })
        .success,
    ).toBe(true);
  });
});

describe("stripAutoCode", () => {
  it("removes code in add mode so the server assigns it", () => {
    const payload = stripAutoCode("add", { ...baseValues, code: "typed" });
    expect(payload.code).toBeUndefined();
    expect(payload.name).toBe("Beverage");
  });

  it("keeps code unchanged in edit mode", () => {
    const payload = stripAutoCode("edit", { ...baseValues, code: "C01" });
    expect(payload.code).toBe("C01");
  });
});
