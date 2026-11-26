import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");

/**
 * ลายเซ็นของหัวหน้า list ที่ประกอบเอง — ทั้งหมดต้องมาจาก ListPageShell /
 * DisplayModeToggle เท่านั้น (spec 2026-10-01-list-page-shell-design.md §5)
 *
 * - `<DocumentListHeader` — ห้ามเรียกตรงจาก routes/ (shell เรียกให้)
 * - ลายเซ็น sticky แบบเต็มของ ConfigListTemplate ที่ถูกก๊อป 29 หน้า
 *   (จงใจเป็น string เต็ม: `routes/profile/user-profile-setting.tsx` มี
 *   `sticky top-0 z-20` ของตัวเองคนละเรื่อง ไม่ใช่หน้า list)
 * - `<LayoutList` / `<LayoutGrid` — ปุ่มคู่ต้องผ่าน DisplayModeToggle
 */
const SIGNATURES = [
  /<DocumentListHeader\b/g,
  /sticky top-0 z-20 space-y-3 pb-3 sm:static sm:bg-transparent sm:pb-0/g,
  /<Layout(?:List|Grid)\b/g,
];

function tsxFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return tsxFiles(rel);
    return e.name.endsWith(".tsx") && !e.name.endsWith(".test.tsx")
      ? [rel]
      : [];
  });
}

const sources = tsxFiles("routes").map((file) => ({
  file,
  src: readFileSync(join(ROOT, file), "utf-8"),
}));

/**
 * หน้าที่ยังไม่ย้าย — หดลงทุก PR ของงานนี้ จบงานเหลือบรรทัดเดียว
 * ค่า = จำนวนลายเซ็นที่พบในไฟล์ (เปลี่ยนเมื่อแตะไฟล์ = ต้องมาอัปเดตที่นี่)
 */
const ALLOWED: Record<string, number> = {
  // ── ถาวร — หัว dashboard ยืม DocumentListHeader ไม่ใช่หน้า list (งาน landing คนละ spec)
  "routes/accounting/dashboard/accounting-dashboard-page.tsx": 1,
};

function countSignatures(src: string): number {
  return SIGNATURES.reduce((n, re) => n + (src.match(re)?.length ?? 0), 0);
}

describe("list pages go through ListPageShell", () => {
  it("only hand-built list headers listed with a reason remain", () => {
    const counts: Record<string, number> = {};
    for (const { file, src } of sources) {
      const n = countSignatures(src);
      if (n > 0) counts[file] = n;
    }
    expect(counts).toEqual(ALLOWED);
  });

  it("still finds every signature it claims to guard", () => {
    // กัน regex ตาบอดเงียบ ๆ — ถ้าแก้ class ใน shell แล้วลืมมาแก้ที่นี่ เทสต์บน
    // จะเขียวเพราะไม่ match อะไรเลย ไม่ใช่เพราะย้ายครบ
    const probe = [
      `<DocumentListHeader title="x" description="y" />`,
      `<div className="sticky top-0 z-20 space-y-3 pb-3 sm:static sm:bg-transparent sm:pb-0">`,
      `<LayoutList className="size-4" />`,
      `<LayoutGrid className="size-4" />`,
    ].join("\n");
    expect(countSignatures(probe)).toBe(4);
  });

  it("matches the sticky block as the shell actually writes it", () => {
    // probe ข้างบนป้อน string ที่ก๊อปจาก regex เอง จึงพิสูจน์ไม่ได้ว่า regex ยังตรง
    // กับของจริง — ถ้าใครแก้ class ใน list-page-shell.tsx แล้วหน้าใหม่ก๊อปชุดใหม่ไป
    // regex ตัวนี้จะไม่ match อะไรอีกเลยโดยไม่มีใครรู้
    const shell = readFileSync(
      join(ROOT, "components/share/list-page-shell.tsx"),
      "utf-8",
    );
    expect(shell).toMatch(SIGNATURES[1]);
  });
});
