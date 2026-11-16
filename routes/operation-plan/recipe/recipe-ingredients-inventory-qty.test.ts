import { describe, it, expect } from "vitest";
import {
  inventoryEquivalentOf,
  type UnitCost,
} from "./recipe-ingredients-cost";

// จำนวนในหน่วย inventory ที่โชว์ใต้ช่องจำนวนของแถววัตถุดิบ (ratio = หน่วยสูตรต่อ 1 หน่วย inventory)
describe("inventoryEquivalentOf", () => {
  it("500 G ที่ 1 KG = 1000 G → 0.5 KG", () => {
    expect(inventoryEquivalentOf(500, 1000)).toBe(0.5);
  });

  it("หน่วยสูตรคือหน่วย inventory เอง (1:1) → จำนวนเดิม", () => {
    expect(inventoryEquivalentOf(2, 1)).toBe(2);
  });

  it("ปัด 5 ตำแหน่งแบบเดียวกับคอลัมน์ inventory_qty", () => {
    expect(inventoryEquivalentOf(1, 3)).toBe(0.33333);
  });

  it("ค่าจากช่องกรอกเป็น string ก็คิดได้", () => {
    expect(inventoryEquivalentOf("250", 1000)).toBe(0.25);
  });

  it.each([
    ["ไม่มีอัตราส่วน (ยังโหลดหน่วยไม่เสร็จ)", 5, undefined],
    ["อัตราส่วน 0 (conversion ถูกปิด)", 5, 0],
    ["จำนวนว่าง", "", 1000],
    ["จำนวน 0", 0, 1000],
    ["จำนวนไม่ใช่ตัวเลข", "abc", 1000],
  ])("%s → ไม่โชว์", (_label, qty, ratio) => {
    expect(inventoryEquivalentOf(qty, ratio)).toBeUndefined();
  });

  it("รู้ต้นทุนของแถวแล้ว → คิดทางเดียวกับ server (อัตราส่วนไม่ตรง factor ใช้ค่าที่บันทึกไว้)", () => {
    const unit: UnitCost = {
      cost_per_unit: 10,
      conversion_factor: 0.002,
      cost_source: "average",
      saved_inventory_per_qty: 0.002,
    };
    // ratio 1000 → 1/1000 = 0.001 ≠ factor 0.002 จึงไม่เชื่อ ratio
    expect(inventoryEquivalentOf(500, 1000, unit)).toBe(1);
  });
});
