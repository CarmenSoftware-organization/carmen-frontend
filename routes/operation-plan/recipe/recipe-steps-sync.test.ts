import { describe, it, expect } from "vitest";
import type { RecipePreparationStep } from "@/types/recipe";
import {
  diffSteps,
  draftToItem,
  stepToDraft,
  stepVideoUrl,
  type StepDraft,
} from "./recipe-steps-sync";

const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
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

describe("stepVideoUrl — อ่านวิดีโอของขั้นจาก videos (JSONB)", () => {
  it("วิดีโอ YouTube → ลิงก์ watch?v= รูปแบบเดียวกับวิดีโอของสูตร", () => {
    expect(stepVideoUrl([yt("dQw4w9WgXcQ")])).toBe(WATCH);
  });

  it.each([
    ["ไม่มีฟิลด์ (backend เก่า)", undefined],
    ["null", null],
    ["ว่าง", []],
    ["ไม่ใช่ array", { provider: "youtube", token: "dQw4w9WgXcQ" }],
    ["provider อื่น", [{ provider: "vimeo", token: "76979871" }]],
    ["token ผิดรูป", [yt("https://youtu.be/dQw4w9WgXcQ")]],
    ["รายการไม่ใช่ object", ["dQw4w9WgXcQ"]],
  ])("%s → ไม่มีวิดีโอ", (_label, videos) => {
    expect(stepVideoUrl(videos)).toBe("");
  });

  it("ข้ามรายการที่ใช้ไม่ได้ แล้วเอาตัวแรกที่ใช้ได้", () => {
    expect(stepVideoUrl([yt("bad"), yt("dQw4w9WgXcQ")])).toBe(WATCH);
  });
});

describe("draftToItem — videos ที่ส่งไป API", () => {
  it("ลิงก์รูปแบบใดก็ได้ → token = รหัสวิดีโอ 1 ตัว", () => {
    const d = stepToDraft(step());
    expect(
      draftToItem({ ...d, video_url: " https://youtu.be/dQw4w9WgXcQ?si=x " })
        .videos,
    ).toEqual([yt("dQw4w9WgXcQ")]);
  });

  it("ช่องว่าง → [] (ขั้นใหม่ไม่มีวิดีโอ / ลบวิดีโอเดิม)", () => {
    expect(draftToItem(stepToDraft(step())).videos).toEqual([]);
  });
});

describe("diffSteps — วิดีโอของขั้น", () => {
  const withVideo = step({ videos: [yt("dQw4w9WgXcQ")] });

  it("ใส่วิดีโอให้ขั้นเดิม → PATCH เฉพาะ videos + doc_version", () => {
    const diff = diffSteps([step()], [edit(step(), { video_url: WATCH })]);
    expect(diff.toPatch).toEqual([
      {
        step_id: "step-1",
        body: { videos: [yt("dQw4w9WgXcQ")], doc_version: 3 },
      },
    ]);
  });

  it("เปลี่ยนเป็นวิดีโออื่น → PATCH videos ใหม่", () => {
    const diff = diffSteps(
      [withVideo],
      [edit(withVideo, { video_url: "https://youtu.be/aqz-KE-bpKQ" })],
    );
    expect(diff.toPatch[0].body).toEqual({
      videos: [yt("aqz-KE-bpKQ")],
      doc_version: 3,
    });
  });

  it("ลบลิงก์ออก → PATCH videos: []", () => {
    const diff = diffSteps([withVideo], [edit(withVideo, { video_url: "" })]);
    expect(diff.toPatch[0].body).toEqual({ videos: [], doc_version: 3 });
  });

  it("วางลิงก์ของวิดีโอเดิมในรูปแบบอื่น → ไม่มีอะไรต้องส่ง", () => {
    const diff = diffSteps(
      [withVideo],
      [edit(withVideo, { video_url: "https://youtu.be/dQw4w9WgXcQ?t=5" })],
    );
    expect(diff.toPatch).toEqual([]);
  });

  it("แก้ฟิลด์อื่น → ไม่ส่ง videos (ไม่ทับ title หรือรายการเก่าที่เก็บไว้)", () => {
    const legacy = step({
      videos: [
        { ...yt("dQw4w9WgXcQ"), title: "Knife skills" },
        yt("aqz-KE-bpKQ"),
      ],
    });
    const diff = diffSteps([legacy], [edit(legacy, { title: "Sear well" })]);
    expect(diff.toPatch).toEqual([
      { step_id: "step-1", body: { title: "Sear well", doc_version: 3 } },
    ]);
  });

  it("ขั้นใหม่ที่มีวิดีโอ → POST พร้อม videos", () => {
    const diff = diffSteps(
      [],
      [{ ...stepToDraft(step()), step_id: null, video_url: WATCH }],
    );
    expect(diff.toAdd.map(draftToItem)[0].videos).toEqual([yt("dQw4w9WgXcQ")]);
  });
});
