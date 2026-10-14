import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { PERMISSION_KEYS } from "@/constant/permissions";

const ROOT = join(import.meta.dirname, "../../..");

/**
 * ลายเซ็นของโครง/หัวฟอร์มที่ประกอบเอง — ต้องมาจาก FormPageShell / FormToolbar /
 * BackButton เท่านั้น (spec 2026-10-01-form-page-shell-design.md §5)
 *
 * - `<ArrowLeft` — ปุ่มย้อนกลับต้องเป็น BackButton (doc ของ back-button.tsx)
 * - `navigate(-1)` — ปลายทางย้อนกลับต้องเป็น path ของ list ไม่ใช่ history
 * - padding safe-area ของโครง — มาจาก FormPageShell ไม่เขียนที่หน้า
 * - `<DocFormHeader` เรียกตรง — หัวฟอร์มผ่าน FormToolbar (ยกเว้นที่ระบุเหตุผล)
 *
 * `ChevronLeft` ไม่อยู่ในนี้: ใช้ถูกต้องเป็นลูกศรเลื่อนใน gallery/lightbox/timeline
 */
const SIGNATURES = [
  /<ArrowLeft\b/g,
  /navigate\(-1\)/g,
  /p-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/g,
  /<DocFormHeader\b/g,
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
 * หน้าที่ยังไม่ย้าย — หดลงทุก PR ของงานนี้ ค่า = จำนวนลายเซ็นที่พบในไฟล์
 * (เปลี่ยนเมื่อแตะไฟล์ = ต้องมาอัปเดตที่นี่)
 */
const ALLOWED: Record<string, number> = {
  // ── ถาวร
  "routes/legal/legal-page.tsx": 1, // ArrowLeft ลิงก์กลับแอป ไม่ใช่ฟอร์ม
  "routes/inventory-management/period-end/pe-review.tsx": 1, // DFH ตรงใน FormPageShell — ไม่ใช่ฟอร์ม ไม่มีชุด Edit/Save
  // ลิงก์มีป้าย "← Purchase Orders" บนหน้าสำเร็จ ไม่ใช่ปุ่ม back แบบไอคอน — BackButton จะทำป้ายหาย
  "routes/procurement/purchase-order/from-pr/step-result.tsx": 1,
  // ลิงก์มีป้าย "← Interfaces" ในหน้าว่างของ brand ที่หมดอายุจนอ่าน config ไม่ได้ ไม่ใช่ปุ่ม back ของฟอร์ม
  "routes/system-admin/interface/interface-detail.route.tsx": 1,
  // ── ชั่วคราว — accounting รอ spec accounting i18n (documents spec §0/§8)
  "routes/accounting/accounts-payable/invoice/ap-invoice-detail.tsx": 1,
  "routes/accounting/accounts-payable/payment/ap-payment-detail.tsx": 1,
  "routes/accounting/accounts-receivable/ar-invoice-detail.tsx": 1,
  "routes/accounting/documents/accounting-document-detail.tsx": 1,
  // ── orphan: ไม่ได้ลงทะเบียนใน router (spec §8 — ลบหรือลงทะเบียนเป็นการตัดสินใจแยก)
  "routes/system-admin/config-email/config-email-component.tsx": 2,
};

function countSignatures(src: string): number {
  return SIGNATURES.reduce((n, re) => n + (src.match(re)?.length ?? 0), 0);
}

describe("form pages go through FormPageShell / FormToolbar / BackButton", () => {
  it("only hand-built form shells listed with a reason remain", () => {
    const counts: Record<string, number> = {};
    for (const { file, src } of sources) {
      const n = countSignatures(src);
      if (n > 0) counts[file] = n;
    }
    expect(counts).toEqual(ALLOWED);
  });

  it("still finds every signature it claims to guard", () => {
    // กัน regex ตาบอดเงียบ ๆ — แก้ class ใน shell แล้วลืมมาแก้ที่นี่ เทสต์บนจะเขียว
    // เพราะไม่ match อะไรเลย ไม่ใช่เพราะย้ายครบ
    const probe = [
      `<ArrowLeft className="size-4" />`,
      `onClick={() => navigate(-1)}`,
      `<div className="mx-auto w-full max-w-4xl p-[max(1rem,env(safe-area-inset-bottom))]">`,
      `<DocFormHeader title="x" backLabel="y" onBack={fn} />`,
    ].join("\n");
    expect(countSignatures(probe)).toBe(4);
  });

  it("every permissionPrefix literal in routes/ names keys that exist in the catalog", () => {
    // FormToolbar gate เฉพาะ key ที่อยู่ใน PERMISSIONS — prefix ที่พิมพ์ผิดจึงไม่ทำให้
    // non-admin โดน denied อีก แต่กลายเป็น "ไม่ gate เงียบ ๆ" แทน เทสต์นี้คือตัวดัก
    const bad: string[] = [];
    for (const { file, src } of sources) {
      for (const m of src.matchAll(/permissionPrefix="([^"]+)"/g)) {
        const prefix = m[1];
        if (
          !PERMISSION_KEYS.has(`${prefix}.update`) &&
          !PERMISSION_KEYS.has(`${prefix}.create`)
        )
          bad.push(`${file}: ${prefix}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("matches the padding as the shell actually writes it", () => {
    const shell = readFileSync(
      join(ROOT, "components/share/form-page-shell.tsx"),
      "utf-8",
    );
    expect(shell).toMatch(SIGNATURES[2]);
  });
});
