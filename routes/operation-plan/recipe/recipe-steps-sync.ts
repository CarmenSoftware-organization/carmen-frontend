import type { RecipeEquipmentRef, RecipePreparationStep } from "@/types/recipe";

/** ค่าของขั้นตอนหนึ่งในฟอร์ม (item ของ useFieldArray) */
export interface StepDraft {
  /** null = ขั้นใหม่ · ห้ามชื่อ `id` เพราะชนกับ key ที่ useFieldArray สร้าง */
  step_id: string | null;
  doc_version: number | null;
  title: string;
  description: string;
  duration: number | null;
  temperature: number | null;
  temperature_unit: "c" | "f";
  equipment: RecipeEquipmentRef[];
  chef_notes: string;
  safety_warnings: string;
}

export interface StepsDiff {
  toDelete: string[];
  toPatch: { step_id: string; body: Record<string, unknown> }[];
  toAdd: StepDraft[];
  needsReorder: boolean;
}

/** ของใหม่เป็น {id,name}[] ของเก่า/ที่พิมพ์มือเป็น string[] — อ่านได้ทั้งคู่ */
export function normalizeEquipment(raw: unknown): RecipeEquipmentRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e): RecipeEquipmentRef[] => {
    if (typeof e === "string") return e.trim() ? [{ id: null, name: e }] : [];
    if (e && typeof e === "object" && "name" in e) {
      const name = String((e as { name: unknown }).name ?? "").trim();
      const id = (e as { id?: unknown }).id;
      return name ? [{ id: typeof id === "string" ? id : null, name }] : [];
    }
    return [];
  });
}

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * ขั้นที่ยังใช้งาน เรียงตามลำดับ — recipe detail (findOne) ไม่ได้กรอง deleted_at
 * ของขั้นตอน (แก้ฝั่ง backend แล้วแต่ FE อาจขึ้นก่อน) ทุกจุดที่อ่าน
 * `recipe.preparation_steps` ต้องผ่านตัวนี้
 */
export function activeSteps(
  steps: RecipePreparationStep[] | null | undefined,
): RecipePreparationStep[] {
  return (steps ?? [])
    .filter((s) => !s.deleted_at)
    .sort((a, b) => a.sequence_no - b.sequence_no);
}

export function stepToDraft(s: RecipePreparationStep): StepDraft {
  return {
    step_id: s.id,
    doc_version: s.doc_version,
    title: s.title ?? "",
    description: s.description,
    duration: toNum(s.duration),
    temperature: toNum(s.temperature),
    temperature_unit: s.temperature_unit ?? "c",
    equipment: normalizeEquipment(s.equipment),
    chef_notes: s.chef_notes ?? "",
    safety_warnings: s.safety_warnings ?? "",
  };
}

/** draft → body ของ API (StepItem) — ข้อความว่างเป็น null, หน่วยส่งเฉพาะเมื่อมีอุณหภูมิ */
export function draftToItem(d: StepDraft): Record<string, unknown> {
  const text = (v: string) => (v.trim() ? v : null);
  const temperature = toNum(d.temperature);
  return {
    title: text(d.title),
    description: d.description,
    duration: toNum(d.duration),
    temperature,
    temperature_unit: temperature == null ? null : d.temperature_unit,
    equipment: d.equipment.map(({ id, name }) => ({ id, name })),
    chef_notes: text(d.chef_notes),
    safety_warnings: text(d.safety_warnings),
  };
}

/**
 * เทียบขั้นตอนที่โหลดมากับที่อยู่ในฟอร์ม → สิ่งที่ต้องยิง
 * ลำดับใช้ตำแหน่งใน drafts เป็นความจริง (sequence_no ฝั่ง server ถูกเขียนใหม่ตอน reorder)
 */
export function diffSteps(
  original: RecipePreparationStep[],
  drafts: StepDraft[],
): StepsDiff {
  const kept = new Set(drafts.map((d) => d.step_id).filter(Boolean));
  const byId = new Map(original.map((s) => [s.id, s]));

  const toDelete = original.filter((s) => !kept.has(s.id)).map((s) => s.id);

  const toPatch: StepsDiff["toPatch"] = [];
  for (const d of drafts) {
    if (!d.step_id) continue;
    const orig = byId.get(d.step_id);
    if (!orig) continue;
    const before = draftToItem(stepToDraft(orig));
    const after = draftToItem(d);
    const body: Record<string, unknown> = {};
    for (const key of Object.keys(after)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        body[key] = after[key];
      }
    }
    if (Object.keys(body).length > 0) {
      toPatch.push({
        step_id: d.step_id,
        body: { ...body, doc_version: orig.doc_version },
      });
    }
  }

  const toAdd = drafts.filter((d) => !d.step_id);

  // ขั้นใหม่ถูก POST ต่อท้ายเสมอ — ถ้าไม่ได้อยู่ท้ายฟอร์ม หรือขั้นเดิมสลับกัน ต้อง reorder
  const originalOrder = [...original]
    .sort((a, b) => a.sequence_no - b.sequence_no)
    .map((s) => s.id)
    .filter((id) => kept.has(id));
  const draftExisting = drafts.flatMap((d) => (d.step_id ? [d.step_id] : []));
  const firstNew = drafts.findIndex((d) => !d.step_id);
  const newNotAtEnd =
    firstNew !== -1 && drafts.slice(firstNew).some((d) => d.step_id);
  const needsReorder =
    newNotAtEnd ||
    originalOrder.length !== draftExisting.length ||
    originalOrder.some((id, i) => id !== draftExisting[i]);

  return { toDelete, toPatch, toAdd, needsReorder };
}

export function isEmptyDiff(d: StepsDiff): boolean {
  return (
    d.toDelete.length === 0 &&
    d.toPatch.length === 0 &&
    d.toAdd.length === 0 &&
    !d.needsReorder
  );
}
