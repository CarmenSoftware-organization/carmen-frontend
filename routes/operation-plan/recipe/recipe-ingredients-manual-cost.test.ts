import { describe, expect, it } from "vitest";
import type { IngredientCostLine, RecipeIngredientLine } from "@/types/recipe";
import {
  draftToInput,
  EMPTY_INGREDIENT,
  ingredientsChanged,
  ingredientToDraft,
  manualCostOf,
  pairCostsFrom,
  pairKey,
  pendingPairs,
  resolveRowCosts,
  type IngredientDraft,
  type PairCost,
} from "./recipe-ingredients-cost";

const P = "prod-1";
const GRAM = "unit-gram";
const KEY = pairKey(`p:${P}`, GRAM);
// 1 KG = 1000 GRAM
const RATIOS = new Map([[KEY, 1000]]);

const draft = (over: Partial<IngredientDraft> = {}): IngredientDraft => ({
  ...EMPTY_INGREDIENT,
  product_id: P,
  product_label: "กุ้ง",
  ingredient_unit_id: GRAM,
  qty: 400,
  wastage_percentage: 10,
  ...over,
});

const savedLine = (over: Partial<RecipeIngredientLine> = {}) =>
  ({
    id: "line-1",
    sequence_no: 1,
    ingredient_type: "product",
    product_id: P,
    product: { id: P, code: "P-1", name: "กุ้ง" },
    qty: 400,
    ingredient_unit_id: GRAM,
    ingredient_unit: { id: GRAM, name: "GRAM" },
    inventory_qty: 0.4,
    inventory_unit_id: "unit-kg",
    conversion_factor: 0.001,
    cost_per_unit: 70,
    wastage_percentage: 10,
    net_cost: 28,
    wastage_cost: 2.8,
    line_cost: 30.8,
    note: null,
    ...over,
  }) as RecipeIngredientLine;

describe("manualCostOf", () => {
  it("ไม่ได้กรอก (null / ว่าง / ไม่ใช่ตัวเลข / ติดลบ) = null", () => {
    expect(manualCostOf({ line_cost: null })).toBeNull();
    expect(manualCostOf({ line_cost: "" as unknown as number })).toBeNull();
    expect(manualCostOf({ line_cost: Number.NaN })).toBeNull();
    expect(manualCostOf({ line_cost: -1 })).toBeNull();
  });

  it("0 นับเป็นค่าที่กรอก และปัด 5 ตำแหน่ง", () => {
    expect(manualCostOf({ line_cost: 0 })).toBe(0);
    expect(manualCostOf({ line_cost: 12.3456789 })).toBe(12.34568);
  });
});

describe("draftToInput — line_cost", () => {
  it("ไม่ได้กรอก = ไม่ส่งคีย์ (server คิดต้นทุนเอง)", () => {
    expect(draftToInput(draft())).not.toHaveProperty("line_cost");
  });

  it("กรอกแล้ว = ส่งต้นทุนของบรรทัดนั้น ไม่ส่งต้นทุนต่อหน่วย", () => {
    const input = draftToInput(draft({ line_cost: 20 }));
    expect(input.line_cost).toBe(20);
    expect(input).not.toHaveProperty("cost_per_unit");
  });

  it("กรอกต้นทุนในแถวที่บันทึกไว้ = วัตถุดิบเปลี่ยน ต้อง PUT", () => {
    const saved = [savedLine()];
    const loaded = saved.map(ingredientToDraft);
    expect(loaded[0].line_cost).toBeNull();
    expect(ingredientsChanged(loaded, saved)).toBe(false);
    expect(ingredientsChanged([{ ...loaded[0], line_cost: 20 }], saved)).toBe(
      true,
    );
  });
});

describe("resolveRowCosts — ต้นทุนบรรทัดที่กรอกเอง", () => {
  it("400 GRAM = 20 บาท: ต้นทุนบรรทัดคือ 20 ตรง ๆ ต้นทุนต่อหน่วยหารย้อนเป็น 50 ต่อ KG", () => {
    const [row] = resolveRowCosts(
      [draft({ line_cost: 20, wastage_percentage: 0 })],
      [savedLine()],
      new Map(),
      false,
      RATIOS,
    );
    expect(row).toMatchObject({
      state: "ok",
      line_cost: 20,
      unit: { cost_per_unit: 50, cost_source: "manual" },
    });
  });

  it("ค่าที่กรอกรวมของเสียแล้ว — ต้นทุนต่อหน่วยหารย้อนจากส่วนสุทธิ (สูตรเดียวกับ server)", () => {
    // 33 ÷ 1.1 = 30 สุทธิ · 30 ÷ 0.4 KG = 75 ต่อ KG
    const [row] = resolveRowCosts(
      [draft({ line_cost: 33 })],
      [],
      new Map(),
      false,
      RATIOS,
    );
    expect(row).toMatchObject({
      state: "ok",
      line_cost: 33,
      unit: { cost_per_unit: 75 },
    });
  });

  it("แถวใหม่ที่ยังไม่ได้ผล preview ก็แสดงได้เลย — ไม่ต้องรอ ไม่ต้องถามต้นทุน", () => {
    const drafts = [draft({ line_cost: 20 })];
    const rows = resolveRowCosts(drafts, [], new Map(), false, RATIOS);
    expect(rows[0]).toMatchObject({ state: "ok", line_cost: 20 });
    expect(pendingPairs(drafts, rows)).toEqual([]);
  });

  it("ยังไม่รู้อัตราส่วนแปลงหน่วย = รอก่อน ไม่เดาต้นทุนต่อหน่วย", () => {
    const rows = resolveRowCosts(
      [draft({ line_cost: 20 })],
      [],
      new Map(),
      false,
    );
    expect(rows[0]).toEqual({ state: "pending" });
  });

  it("ล้างค่าที่กรอก = กลับไปใช้ต้นทุนของระบบ", () => {
    const current = new Map<string, PairCost>([
      [
        KEY,
        {
          ok: true,
          unit_name: "GRAM",
          cost_per_unit: 50,
          conversion_factor: 0.001,
          cost_source: "average",
        },
      ],
    ]);
    const [row] = resolveRowCosts([draft()], [], current, false, RATIOS);
    expect(row).toMatchObject({
      state: "ok",
      line_cost: 22,
      unit: { cost_source: "average" },
    });
  });

  it("แถวกรอกเองยังกินคู่ snapshot ของตัวเอง แถวซ้ำถัดไปจับคู่กับแถวที่บันทึกไว้ตัวที่สอง", () => {
    const rows = resolveRowCosts(
      [draft({ line_cost: 20 }), draft()],
      [savedLine(), savedLine({ id: "line-2", cost_per_unit: 90 })],
      new Map(),
      false,
      RATIOS,
    );
    expect(rows[1]).toMatchObject({
      state: "ok",
      unit: { cost_per_unit: 90, cost_source: "snapshot" },
    });
  });

  it("บรรทัดสูตร (1:1) กรอกเองได้โดยไม่ต้องมีอัตราส่วน", () => {
    const [row] = resolveRowCosts(
      [
        draft({
          ingredient_type: "recipe",
          product_id: "",
          sub_recipe_id: "rcp-1",
          qty: 2,
          wastage_percentage: 0,
          line_cost: 160,
        }),
      ],
      [],
      new Map(),
      false,
    );
    expect(row).toMatchObject({
      state: "ok",
      line_cost: 160,
      unit: { cost_per_unit: 80 },
    });
  });
});

describe("pairCostsFrom", () => {
  it("ไม่จำต้นทุนของบรรทัดที่ผู้ใช้กรอกเองเป็นต้นทุนปัจจุบันของคู่ (สินค้า, หน่วย)", () => {
    const line = (over: Partial<IngredientCostLine>) =>
      ({ ...savedLine(), ...over }) as IngredientCostLine;
    const pairs = pairCostsFrom([
      line({ cost_source: "manual", cost_per_unit: 320 }),
      line({
        product_id: "prod-2",
        cost_source: "average",
        cost_per_unit: 50,
      }),
    ]);
    expect(pairs.map(([k]) => k)).toEqual([pairKey("p:prod-2", GRAM)]);
  });
});
