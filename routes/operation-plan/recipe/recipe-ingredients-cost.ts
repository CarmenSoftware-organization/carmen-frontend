import type {
  IngredientCostLine,
  IngredientCostSource,
  IngredientInput,
  IngredientType,
  RecipeIngredientLine,
} from "@/types/recipe";

/** แถววัตถุดิบในฟอร์ม — ต้นทุนเป็นของ server ฟอร์มแสดงอย่างเดียว เว้นแต่ผู้ใช้กรอก `line_cost` เอง */
export interface IngredientDraft {
  /** id ของแถวที่บันทึกแล้ว · null = แถวใหม่ (PUT แทนทั้งชุด จึงใช้แค่อ้างอิง) */
  line_id: string | null;
  ingredient_type: IngredientType;
  /** ใช้เมื่อ `ingredient_type` = "product" · ประเภทอื่นเป็น "" */
  product_id: string;
  /** ใช้เมื่อ `ingredient_type` = "recipe" · ประเภทอื่นเป็น "" */
  sub_recipe_id: string;
  /** ชื่อของสินค้า/สูตรที่รู้อยู่แล้ว — ให้ lookup โชว์ได้แม้รายการอยู่นอกหน้าแรกของรายการ */
  product_label: string;
  qty: number;
  ingredient_unit_id: string;
  wastage_percentage: number;
  /**
   * ต้นทุนของทั้งบรรทัดที่ผู้ใช้กรอกเองตามจำนวนนั้น (รวมของเสียแล้ว เช่น 400 GRAM = 20) · null = ให้ server คิด
   * แถวที่โหลดมาเป็น null เสมอ — ต้นทุนที่บันทึกไว้ (รวมที่เคยกรอกเอง) คงอยู่ด้วยกฎ snapshot ของ server
   */
  line_cost: number | null;
  note: string;
}

export const EMPTY_INGREDIENT: IngredientDraft = {
  line_id: null,
  ingredient_type: "product",
  product_id: "",
  sub_recipe_id: "",
  product_label: "",
  qty: 1,
  ingredient_unit_id: "",
  wastage_percentage: 0,
  line_cost: null,
  note: "",
};

/** ต้นทุนต่อหน่วยของคู่ (สินค้า, หน่วยสูตร) — พอคำนวณต้นทุนบรรทัดได้ทุกจำนวน/% เสีย */
export interface UnitCost {
  /** ต่อหน่วย inventory */
  cost_per_unit: number;
  /** หน่วย inventory ต่อ 1 หน่วยสูตร — ค่าที่ server ปัด 5 ตำแหน่งแล้ว ใช้เป็นตัวสำรองเท่านั้น */
  conversion_factor: number;
  cost_source: IngredientCostSource;
  /**
   * แถวที่บันทึกไว้: inventory_qty / qty ของแถวนั้น — ตัวสำรองเมื่อยังไม่รู้อัตราส่วนแปลงหน่วย
   * แบบไม่ปัด (qty เดิม = ได้ inventory_qty เดิมเป๊ะ)
   */
  saved_inventory_per_qty?: number;
}

/** ผลของ preview ต่อคู่ (สินค้า, หน่วย) — error เก็บไว้กันยิงซ้ำวนไป (ลบออกเมื่อกดลองใหม่) */
export type PairCost =
  | ({ ok: true; unit_name: string | null } & UnitCost)
  | { ok: false; message: string };

export type RowCost =
  | { state: "incomplete" }
  | { state: "pending" }
  | { state: "error"; message: string }
  | { state: "ok"; unit: UnitCost; line_cost: number };

/** ตัวอ้างอิงวัตถุดิบ: "p:<id>" (สินค้า) · "r:<id>" (สูตร) · "" เมื่อยังไม่เลือก */
export function refOf(d: {
  ingredient_type?: IngredientType | null;
  product_id?: string | null;
  sub_recipe_id?: string | null;
}): string {
  if (d.ingredient_type === "recipe")
    return d.sub_recipe_id ? `r:${d.sub_recipe_id}` : "";
  return d.product_id ? `p:${d.product_id}` : "";
}

/** กุญแจของคู่ (ตัวอ้างอิง, หน่วย) — ref มี ":" แต่ไม่มี "|" จึงแยกกลับได้ */
export const pairKey = (ref: string, unitId: string) => `${ref}|${unitId}`;

/** แปลง pairKey กลับเป็นบรรทัดสำหรับยิง preview (qty 1, เสีย 0) */
export function parsePairKey(key: string): IngredientInput {
  const [ref = "", unitId = ""] = key.split("|");
  const id = ref.slice(2);
  if (ref.startsWith("r:")) {
    return {
      ingredient_type: "recipe",
      sub_recipe_id: id,
      qty: 1,
      wastage_percentage: 0,
    };
  }
  return {
    ingredient_type: "product",
    product_id: id,
    ingredient_unit_id: unitId,
    qty: 1,
    wastage_percentage: 0,
  };
}

/** ทั้งสองประเภทต้องมีตัวอ้างอิงและหน่วย — บรรทัดสูตรใช้หน่วยผลผลิตของสูตรฐาน (server คืนหน่วยนี้เสมอ) */
export const isDraftComplete = (d: IngredientDraft) =>
  !!refOf(d) && !!d.ingredient_unit_id;

/** แถวที่ยังไม่ลบ เรียงตาม sequence_no */
export function activeIngredients(
  lines: RecipeIngredientLine[] | null | undefined,
): RecipeIngredientLine[] {
  return (lines ?? [])
    .filter((l) => !l.deleted_at)
    .sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no));
}

export function ingredientToDraft(line: RecipeIngredientLine): IngredientDraft {
  const type: IngredientType = line.ingredient_type ?? "product";
  const ref = type === "recipe" ? line.sub_recipe : line.product;
  return {
    line_id: line.id,
    ingredient_type: type,
    product_id: type === "product" ? (line.product_id ?? "") : "",
    sub_recipe_id: type === "recipe" ? (line.sub_recipe_id ?? "") : "",
    product_label: ref?.name ?? ref?.code ?? "",
    qty: Number(line.qty) || 0,
    ingredient_unit_id: line.ingredient_unit_id ?? "",
    wastage_percentage: Number(line.wastage_percentage) || 0,
    line_cost: null,
    note: line.note ?? "",
  };
}

/**
 * ต้นทุนบรรทัดที่ผู้ใช้กรอกเองของแถว — null เมื่อไม่ได้กรอก (ช่องว่าง/ไม่ใช่ตัวเลข/ติดลบ = ไม่ได้กรอก)
 * 0 นับเป็นค่าที่กรอก (ของแถม/ของที่ไม่คิดต้นทุน)
 */
export function manualCostOf(
  d: Pick<IngredientDraft, "line_cost">,
): number | null {
  const v = d.line_cost;
  if (v === null || v === undefined || (v as unknown) === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? round5(n) : null;
}

export function draftToInput(d: IngredientDraft): IngredientInput {
  const isRecipe = d.ingredient_type === "recipe";
  return {
    ingredient_type: isRecipe ? "recipe" : "product",
    ...(isRecipe
      ? { sub_recipe_id: d.sub_recipe_id }
      : { product_id: d.product_id }),
    qty: Number(d.qty),
    // บรรทัดสูตรไม่ส่งหน่วย — backend ตั้งจากหน่วยผลผลิตของสูตรฐานเอง (กัน gateway .uuid() ตีกลับ
    // 400 ทั่วไปเมื่อหน่วยเป็นค่าเก่าที่ไม่ใช่ UUID) draft/pairKey ยังเก็บหน่วยไว้จับคู่ snapshot
    ...(d.ingredient_unit_id && !isRecipe
      ? { ingredient_unit_id: d.ingredient_unit_id }
      : {}),
    wastage_percentage: Number(d.wastage_percentage) || 0,
    ...(manualCostOf(d) === null ? {} : { line_cost: manualCostOf(d)! }),
    note: d.note.trim() || null,
  };
}

/** วัตถุดิบในฟอร์มต่างจากที่บันทึกไว้ไหม — ไม่ต่าง = ไม่ต้อง PUT */
export function ingredientsChanged(
  drafts: IngredientDraft[],
  saved: RecipeIngredientLine[],
): boolean {
  const a = drafts.map(draftToInput);
  const b = saved.map((l) => draftToInput(ingredientToDraft(l)));
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function unitCostOf(
  line: IngredientCostLine,
  source?: IngredientCostSource,
): UnitCost {
  return {
    cost_per_unit: Number(line.cost_per_unit) || 0,
    conversion_factor: Number(line.conversion_factor) || 0,
    cost_source: source ?? line.cost_source ?? "average",
  };
}

/** หน่วยสูตรต่อ 1 หน่วย inventory (ค่า `conversion` ของ ingredient-units) ต่อ pairKey */
export type UnitRatios = ReadonlyMap<string, number>;

/** ปัด half-up ที่ 5 ตำแหน่ง — สเกลคอลัมน์ Decimal(20, 5) แบบเดียวกับ server */
export function round5(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  // toPrecision(15) ล้างเศษ float ก่อนปัด — 1.000005 * 1e5 = 100000.49999999999 ต้องปัดขึ้น
  const shifted = Number((Math.abs(n) * 1e5).toPrecision(15));
  return (sign * Math.round(shifted)) / 1e5;
}

/**
 * inventory_qty ของบรรทัด — ลำดับเดียวกับ server: qty (ปัด) ÷ อัตราส่วนแบบไม่ปัด แล้วค่อยปัด
 *
 * `ratio` (หน่วยสูตรต่อ 1 หน่วย inventory จาก ingredient-units) ใช้ได้เมื่อ 1/ratio ปัดแล้วตรงกับ
 * conversion_factor ที่ server ส่งมา — ไม่ตรง (เช่น from_unit_qty ≠ 1 หรือ endpoint หน่วยเลือกแถว
 * conversion คนละแถว) ถือว่าเชื่อไม่ได้ · ไม่มี ratio → แถวที่บันทึกไว้ใช้ inventory_qty/qty เดิม ·
 * สุดท้ายใช้ factor ที่ปัดแล้ว (อาจคลาดหลักที่ 5 จาก server)
 */
export function inventoryQtyOf(
  qty: number,
  unit: UnitCost,
  ratio?: number,
): number {
  const q = round5(Number(qty) || 0);
  if (
    ratio !== undefined &&
    Number.isFinite(ratio) &&
    ratio > 0 &&
    round5(1 / ratio) === round5(unit.conversion_factor)
  ) {
    return round5(q / ratio);
  }
  if (unit.saved_inventory_per_qty !== undefined) {
    return round5(q * unit.saved_inventory_per_qty);
  }
  return round5(q * unit.conversion_factor);
}

/**
 * จำนวนในหน่วย inventory ที่โชว์ใต้ช่องจำนวนของแถววัตถุดิบ
 *
 * - `ratio` (หน่วยสูตรต่อ 1 หน่วย inventory) ไม่มี/ไม่เป็นบวก → undefined = ไม่โชว์
 *   (หน่วยที่ conversion ถูกปิด หรือยังโหลดหน่วยไม่เสร็จ) · หน่วย inventory เอง = ratio 1
 * - จำนวนว่าง/ไม่ใช่ตัวเลข/ไม่เป็นบวก → undefined
 * - รู้ต้นทุนของแถวแล้ว → คิดแบบเดียวกับ server ผ่าน `inventoryQtyOf` · ยังไม่รู้ → qty ÷ ratio
 */
export function inventoryEquivalentOf(
  qty: unknown,
  ratio: number | undefined,
  unit?: UnitCost,
): number | undefined {
  const r = Number(ratio);
  if (ratio === undefined || !Number.isFinite(r) || r <= 0) return undefined;
  const q = Number(qty);
  if (qty === "" || qty === null || !Number.isFinite(q) || q <= 0)
    return undefined;
  return unit ? inventoryQtyOf(q, unit, r) : round5(round5(q) / r);
}

/**
 * สูตรเดียวกับ server: net = round5(inventory_qty × cost_per_unit) ·
 * wastage = round5(net × % เสีย / 100) · line = net + wastage
 */
export function computeLineCost(
  qty: number,
  wastagePct: number,
  unit: UnitCost,
  ratio?: number,
): number {
  const net = round5(inventoryQtyOf(qty, unit, ratio) * unit.cost_per_unit);
  const wastage = round5((net * round5(Number(wastagePct) || 0)) / 100);
  return round5(net + wastage);
}

/**
 * ต้นทุนของทุกแถวบนจอ ให้ตรงกับที่ PUT จะบันทึก
 *
 * `recalculate` false (Save ปกติ): แถวที่ (สินค้า, หน่วย) ตรงกับแถวที่บันทึกไว้ —
 * จับคู่ตามลำดับถ้ามีซ้ำ แบบเดียวกับ server — คงต้นทุนต่อหน่วยเดิม (snapshot)
 * แถวอื่นใช้ต้นทุนปัจจุบันจาก preview · `recalculate` true: ทุกแถวใช้ต้นทุนปัจจุบัน
 *
 * แถวที่ผู้ใช้กรอกต้นทุนของบรรทัดเอง (`line_cost`) คงค่านั้นเป็นต้นทุนบรรทัดเสมอ (ที่มา "manual") แล้วหารย้อน
 * เป็นต้นทุนต่อหน่วยด้วยสูตรเดียวกับ server: net = line ÷ (1 + % เสีย / 100) · ต่อหน่วย = net ÷ inventory_qty
 * ยังกินคู่ snapshot ของตัวเองไป แถวถัดไปจึงจับคู่เหมือนเดิม · ไม่ต้องรอ preview: รู้อัตราส่วนแปลงหน่วย
 * (หรือเป็นบรรทัดสูตร 1:1) ก็แสดงได้เลย
 */
export function resolveRowCosts(
  drafts: IngredientDraft[],
  saved: RecipeIngredientLine[],
  current: ReadonlyMap<string, PairCost>,
  recalculate: boolean,
  ratios: UnitRatios = new Map(),
): RowCost[] {
  const used = new Set<number>();
  return drafts.map((d): RowCost => {
    if (!isDraftComplete(d)) return { state: "incomplete" };
    const dRef = refOf(d);
    let unit: UnitCost | null = null;
    if (!recalculate) {
      const idx = saved.findIndex(
        (s, i) =>
          !used.has(i) &&
          refOf(s) === dRef &&
          s.ingredient_unit_id === d.ingredient_unit_id,
      );
      if (idx >= 0) {
        used.add(idx);
        const s = saved[idx];
        const savedQty = Number(s.qty) || 0;
        unit = {
          ...unitCostOf(s, "snapshot"),
          ...(savedQty > 0
            ? {
                saved_inventory_per_qty:
                  (Number(s.inventory_qty) || 0) / savedQty,
              }
            : {}),
        };
      }
    }
    const key = pairKey(dRef, d.ingredient_unit_id);
    const ratio = ratios.get(key);
    const pc = unit ? undefined : current.get(key);
    if (!unit && pc?.ok) unit = pc;
    const manual = manualCostOf(d);
    if (manual !== null) {
      const factor =
        unit?.conversion_factor ??
        (d.ingredient_type === "recipe"
          ? 1
          : ratio !== undefined && ratio > 0
            ? round5(1 / ratio)
            : undefined);
      // ยังไม่รู้ว่า 1 หน่วยสูตร = กี่หน่วย inventory — รอ preview/รายการหน่วยก่อน
      if (factor !== undefined) {
        const base: UnitCost = {
          ...unit,
          cost_per_unit: 0,
          conversion_factor: factor,
          cost_source: "manual",
        };
        const inventoryQty = inventoryQtyOf(d.qty, base, ratio);
        const net = round5(
          manual / (1 + round5(Number(d.wastage_percentage) || 0) / 100),
        );
        return {
          state: "ok",
          unit: {
            ...base,
            cost_per_unit: inventoryQty > 0 ? round5(net / inventoryQty) : 0,
          },
          line_cost: manual,
        };
      }
    }
    if (!unit) {
      if (!pc) return { state: "pending" };
      return { state: "error", message: pc.ok ? "" : pc.message };
    }
    return {
      state: "ok",
      unit,
      line_cost: computeLineCost(d.qty, d.wastage_percentage, unit, ratio),
    };
  });
}

/** pairKey ของคู่ (วัตถุดิบ, หน่วย) ที่ยังต้องถามต้นทุนปัจจุบัน — ไม่ซ้ำ (ใช้ `parsePairKey` แปลงกลับ) */
export function pendingPairs(
  drafts: IngredientDraft[],
  rows: RowCost[],
): string[] {
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (r.state !== "pending") return;
    const d = drafts[i];
    seen.add(pairKey(refOf(d), d.ingredient_unit_id));
  });
  return [...seen];
}

export function pairCostsFrom(
  lines: IngredientCostLine[],
): [string, PairCost][] {
  // บรรทัดที่ผู้ใช้กรอกต้นทุนเอง server ส่งค่านั้นกลับมา — ไม่ใช่ต้นทุนปัจจุบันของคู่นี้ ห้ามจำ
  return lines
    .filter((l) => l.cost_source !== "manual")
    .map((l) => [
      pairKey(refOf(l), l.ingredient_unit_id),
      {
        ok: true,
        unit_name: l.ingredient_unit?.name ?? null,
        ...unitCostOf(l),
      },
    ]);
}

/**
 * จำนวนทศนิยมที่คอลัมน์ตัวเลขหนึ่งคอลัมน์ต้องใช้ = ของแถวที่ละเอียดที่สุด (ไม่เกิน 5 ตามสเกลคอลัมน์ใน DB)
 * ทุกแถวในคอลัมน์เดียวกันแสดงทศนิยมเท่ากัน — เดิมแต่ละแถวตัดศูนย์ท้ายเอง ได้ 0.4 / 0.04 / 0.005 ปนกัน
 * หลักทศนิยมไม่ตรงแนว (ผู้ใช้สั่งแก้ 2026-11-16) · ค่าว่าง/ไม่ใช่ตัวเลขไม่นับ
 */
export function decimalsFor(
  values: readonly (number | string | null | undefined)[],
): number {
  let max = 0;
  for (const v of values) {
    const text = formatQty(v);
    const dot = text.indexOf(".");
    if (dot >= 0) max = Math.max(max, text.length - dot - 1);
  }
  return Math.min(max, 5);
}

/** ตัวเลขที่ทศนิยมคงที่ `decimals` ตำแหน่ง (เติมศูนย์ท้าย) — ใช้คู่กับ `decimalsFor` ของคอลัมน์ */
export function formatQtyFixed(
  n: number | string | null | undefined,
  decimals: number,
): string {
  const v = Number(n);
  if (n === null || n === undefined || n === "" || !Number.isFinite(v))
    return "";
  return v.toFixed(decimals);
}

/** ตัดศูนย์ท้ายทศนิยม — 2.50000 → "2.5" */
export function formatQty(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return String(Number(v.toFixed(5)));
}
