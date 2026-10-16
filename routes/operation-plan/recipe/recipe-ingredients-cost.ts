import type {
  IngredientCostLine,
  IngredientCostSource,
  IngredientInput,
  RecipeIngredientLine,
} from "@/types/recipe";

/** แถววัตถุดิบในฟอร์ม — ไม่มีตัวเลขต้นทุน (server คำนวณ, ฟอร์มแสดงอย่างเดียว) */
export interface IngredientDraft {
  /** id ของแถวที่บันทึกแล้ว · null = แถวใหม่ (PUT แทนทั้งชุด จึงใช้แค่อ้างอิง) */
  line_id: string | null;
  product_id: string;
  /** ชื่อสินค้าที่รู้อยู่แล้ว — ให้ lookup โชว์ได้แม้สินค้าอยู่นอกหน้าแรกของรายการ */
  product_label: string;
  qty: number;
  ingredient_unit_id: string;
  wastage_percentage: number;
  note: string;
}

export const EMPTY_INGREDIENT: IngredientDraft = {
  line_id: null,
  product_id: "",
  product_label: "",
  qty: 1,
  ingredient_unit_id: "",
  wastage_percentage: 0,
  note: "",
};

/** ต้นทุนต่อหน่วยของคู่ (สินค้า, หน่วยสูตร) — พอคำนวณต้นทุนบรรทัดได้ทุกจำนวน/% เสีย */
export interface UnitCost {
  /** ต่อหน่วย inventory */
  cost_per_unit: number;
  /** หน่วย inventory ต่อ 1 หน่วยสูตร */
  conversion_factor: number;
  cost_source: IngredientCostSource;
}

/** ผลของ preview ต่อคู่ (สินค้า, หน่วย) — error เก็บไว้ด้วยเพื่อไม่ยิงซ้ำวนไป */
export type PairCost =
  | ({ ok: true; unit_name: string | null } & UnitCost)
  | { ok: false; message: string };

export type RowCost =
  | { state: "incomplete" }
  | { state: "pending" }
  | { state: "error"; message: string }
  | { state: "ok"; unit: UnitCost; line_cost: number };

export const pairKey = (productId: string, unitId: string) =>
  `${productId}|${unitId}`;

/** แถวที่ยังไม่ลบ เรียงตาม sequence_no */
export function activeIngredients(
  lines: RecipeIngredientLine[] | null | undefined,
): RecipeIngredientLine[] {
  return (lines ?? [])
    .filter((l) => !l.deleted_at)
    .sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no));
}

export function ingredientToDraft(line: RecipeIngredientLine): IngredientDraft {
  return {
    line_id: line.id,
    product_id: line.product_id,
    product_label: line.product?.name ?? line.product?.code ?? "",
    qty: Number(line.qty) || 0,
    ingredient_unit_id: line.ingredient_unit_id,
    wastage_percentage: Number(line.wastage_percentage) || 0,
    note: line.note ?? "",
  };
}

export function draftToInput(d: IngredientDraft): IngredientInput {
  return {
    product_id: d.product_id,
    qty: Number(d.qty),
    ingredient_unit_id: d.ingredient_unit_id,
    wastage_percentage: Number(d.wastage_percentage) || 0,
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

/** สูตรเดียวกับสัญญา API: inventory_qty × cost_per_unit × (1 + % เสีย) */
export function computeLineCost(
  qty: number,
  wastagePct: number,
  unit: UnitCost,
): number {
  const net = (Number(qty) || 0) * unit.conversion_factor * unit.cost_per_unit;
  return net + (net * (Number(wastagePct) || 0)) / 100;
}

/**
 * ต้นทุนของทุกแถวบนจอ ให้ตรงกับที่ PUT จะบันทึก
 *
 * `recalculate` false (Save ปกติ): แถวที่ (สินค้า, หน่วย) ตรงกับแถวที่บันทึกไว้ —
 * จับคู่ตามลำดับถ้ามีซ้ำ แบบเดียวกับ server — คงต้นทุนต่อหน่วยเดิม (snapshot)
 * แถวอื่นใช้ต้นทุนปัจจุบันจาก preview · `recalculate` true: ทุกแถวใช้ต้นทุนปัจจุบัน
 */
export function resolveRowCosts(
  drafts: IngredientDraft[],
  saved: RecipeIngredientLine[],
  current: ReadonlyMap<string, PairCost>,
  recalculate: boolean,
): RowCost[] {
  const used = new Set<number>();
  return drafts.map((d): RowCost => {
    if (!d.product_id || !d.ingredient_unit_id) return { state: "incomplete" };
    let unit: UnitCost | null = null;
    if (!recalculate) {
      const idx = saved.findIndex(
        (s, i) =>
          !used.has(i) &&
          s.product_id === d.product_id &&
          s.ingredient_unit_id === d.ingredient_unit_id,
      );
      if (idx >= 0) {
        used.add(idx);
        unit = unitCostOf(saved[idx], "snapshot");
      }
    }
    if (!unit) {
      const pc = current.get(pairKey(d.product_id, d.ingredient_unit_id));
      if (!pc) return { state: "pending" };
      if (!pc.ok) return { state: "error", message: pc.message };
      unit = pc;
    }
    return {
      state: "ok",
      unit,
      line_cost: computeLineCost(d.qty, d.wastage_percentage, unit),
    };
  });
}

/** คู่ (สินค้า, หน่วย) ที่ยังต้องถามต้นทุนปัจจุบัน — ไม่ซ้ำ */
export function pendingPairs(
  drafts: IngredientDraft[],
  rows: RowCost[],
): { product_id: string; ingredient_unit_id: string }[] {
  const seen = new Set<string>();
  const out: { product_id: string; ingredient_unit_id: string }[] = [];
  rows.forEach((r, i) => {
    if (r.state !== "pending") return;
    const d = drafts[i];
    const key = pairKey(d.product_id, d.ingredient_unit_id);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      product_id: d.product_id,
      ingredient_unit_id: d.ingredient_unit_id,
    });
  });
  return out;
}

export function pairCostsFrom(
  lines: IngredientCostLine[],
): [string, PairCost][] {
  return lines.map((l) => [
    pairKey(l.product_id, l.ingredient_unit_id),
    { ok: true, unit_name: l.ingredient_unit?.name ?? null, ...unitCostOf(l) },
  ]);
}

/** ตัดศูนย์ท้ายทศนิยม — 2.50000 → "2.5" */
export function formatQty(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return String(Number(v.toFixed(5)));
}
