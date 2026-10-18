/**
 * ตรวจคำแปลไทยของเอกสาร API ขาเข้า (`lib/external-api/openapi.th.json`) เทียบกับ spec ปัจจุบัน
 *
 *   bun run docs:i18n-check              รายงานอย่างเดียว
 *   bun run docs:i18n-check -- --scaffold เขียน entry ที่ขาดลง overlay เป็น { en, th: "" } ให้แปลต่อ
 *
 * ใช้หลัง copy openapi.json ใหม่จาก BE — ไม่ใช่เทสต์ จึง exit 0 เสมอ (ไม่บล็อก build/CI)
 * - missing: ข้อความใน spec ที่ยังไม่มีคำแปล (รวม entry ที่ `th` ว่าง)
 * - stale:   มีคำแปลแต่ต้นฉบับเปลี่ยนแล้ว (`en` ≠ ข้อความปัจจุบัน) — หน้าเอกสารแสดงอังกฤษแทน
 * - orphan:  คำแปลของ pointer ที่ไม่มีใน spec แล้ว
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  baseSpec,
  collectTranslatableStrings,
  type SpecOverlay,
} from "../lib/external-api/localized-spec";

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERLAY_PATH = resolve(HERE, "../lib/external-api/openapi.th.json");

const overlay = JSON.parse(readFileSync(OVERLAY_PATH, "utf8")) as SpecOverlay;
const current = collectTranslatableStrings(baseSpec());

const missing: string[] = [];
const stale: string[] = [];
for (const [pointer, text] of current) {
  const entry = overlay[pointer];
  if (!entry || !entry.th) missing.push(pointer);
  else if (entry.en !== text) stale.push(pointer);
}
const orphan = Object.keys(overlay).filter((p) => !current.has(p));

const list = (title: string, items: string[]) => {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length})`);
  for (const p of items) console.log(`  ${p}`);
};
list("missing", missing);
list("stale", stale);
list("orphan", orphan);

if (process.argv.includes("--scaffold") && missing.length > 0) {
  // เรียงตามลำดับใน spec — แปลไล่จากบนลงล่างได้ตรงกับหน้าเอกสาร
  const next: SpecOverlay = {};
  for (const [pointer, text] of current) {
    next[pointer] = overlay[pointer] ?? { en: text, th: "" };
  }
  for (const p of orphan) next[p] = overlay[p];
  writeFileSync(OVERLAY_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`\nscaffolded ${missing.length} entries → ${OVERLAY_PATH}`);
}

console.log(
  `\nmissing=${missing.length} stale=${stale.length} orphan=${orphan.length}`,
);
