import { describe, it, expect } from "vitest";
import type { RecipePreparationStep } from "@/types/recipe";
import {
  diffSteps,
  draftToItem,
  stepToDraft,
  hasImageChanges,
  type StepDraft,
} from "./recipe-steps-sync";

const yt = (token: string) => ({ provider: "youtube", token, sort_order: 0 });

const step = (over: Partial<RecipePreparationStep> = {}) =>
  ({
    id: "step-1",
    doc_version: 3,
    sequence_no: 1,
    title: "Sear",
    description: "Sear the beef",
    duration: null,
    temperature: null,
    temperature_unit: null,
    equipment: [],
    chef_notes: null,
    safety_warnings: null,
    videos: [],
    ...over,
  }) as RecipePreparationStep;

const edit = (s: RecipePreparationStep, over: Partial<StepDraft>) => ({
  ...stepToDraft(s),
  ...over,
});

describe("วิดีโอรายขั้นตอนของเดิม (videos) — ฟอร์มเลิกใช้แล้ว", () => {
  const legacy = step({ videos: [yt("dQw4w9WgXcQ")] });

  it("ขั้นใหม่/ขั้นที่แก้ ไม่ส่ง videos ไป API", () => {
    expect(draftToItem(stepToDraft(legacy))).not.toHaveProperty("videos");
  });

  it("แก้ฟิลด์อื่นของขั้นที่เคยมีวิดีโอ → PATCH เฉพาะฟิลด์นั้น ไม่ทับ videos ที่เก็บไว้", () => {
    const diff = diffSteps([legacy], [edit(legacy, { title: "Sear well" })]);
    expect(diff.toPatch).toEqual([
      { step_id: "step-1", body: { title: "Sear well", doc_version: 3 } },
    ]);
  });

  it("ไม่แก้อะไร → ไม่มีอะไรต้องส่ง (ไม่ล้างวิดีโอเก่าเองเงียบ ๆ)", () => {
    expect(diffSteps([legacy], [stepToDraft(legacy)]).toPatch).toEqual([]);
  });
});

describe("รูปของขั้นตอน — ฟอร์มถือเฉพาะส่วนที่เปลี่ยน", () => {
  const file = new File(["x"], "a.png", { type: "image/png" });

  it("ขั้นที่โหลดมา = ยังไม่มีรูปที่ต้องเขียน", () => {
    const d = stepToDraft(step());
    expect(d.image_files).toEqual([]);
    expect(d.removed_image_ids).toEqual([]);
    expect(hasImageChanges(d)).toBe(false);
  });

  it.each([
    ["เลือกไฟล์ใหม่", { image_files: [file] }],
    ["กดลบรูปเดิม", { removed_image_ids: ["img-1"] }],
  ])("%s → มีรูปที่ต้องเขียน", (_label, over) => {
    expect(hasImageChanges(edit(step(), over))).toBe(true);
  });

  it("เปลี่ยนแต่รูป → ไม่ PATCH ตัวขั้น (รูปเขียนผ่าน endpoint ของรูปแยกต่างหาก)", () => {
    const diff = diffSteps(
      [step()],
      [edit(step(), { image_files: [file], removed_image_ids: ["img-1"] })],
    );
    expect(diff.toPatch).toEqual([]);
    expect(
      draftToItem(edit(step(), { image_files: [file] })),
    ).not.toHaveProperty("image_files");
  });
});
