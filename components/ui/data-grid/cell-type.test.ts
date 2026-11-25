import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * เซลล์ตารางมีแค่สองขั้น (docs/DESIGN.md §typography-roles): บรรทัดหลักสืบทอด `text-xs`
 * จาก DataGrid · บรรทัดรองใช้ `CellSub` / `CELL_SUB_CLASS` (11px) · หัวคอลัมน์ `text-xs`
 * เทสต์นี้สแกน body ของ `cell:` และ `header:` ใน column definition แล้วฟ้องเมื่อมี class
 * ขนาดอื่น — เคยมีราว 40 ไฟล์ตั้ง 10/11/14/16 เองจนแถวเดียวกันมี 3–4 ขนาด
 *
 * ขอบเขตของ body ใช้การเยื้อง (prettier): บรรทัด `cell:` กับทุกบรรทัดถัดไปที่เยื้องลึกกว่า
 * เซลล์ส่วนใหญ่ไม่ได้เขียน inline แต่แยกเป็น component (`pr-item-cells/`, `*-cell.tsx`,
 * `*-cells.tsx`) ไฟล์กลุ่มนี้จึงถูกสแกนทั้งไฟล์ — popover/dialog ที่เปิดจากเซลล์ไม่ใช่
 * บรรทัดของเซลล์ ให้ใส่ allowlist พร้อมเหตุผล
 * `text-micro-eyebrow` อนุญาต (role eyebrow: ชิปตัวพิมพ์ใหญ่ 9px)
 */

const ROOT = join(import.meta.dirname, "../../..");

/** size class ที่ห้ามใน cell/header — `text-micro` เปล่าก็ห้าม ต้องผ่าน CellSub */
const SIZE =
  /(?<![\w-])text-(?:sm|base|lg|xl|[2-9]xl|micro-legal|micro-floor|micro|\[[^\]\s]+\])(?![\w-])/;

/** ไฟล์ที่ยังตั้งขนาดเองได้ — ต้องมีเหตุผลทุกรายการ */
const ALLOWLIST: Record<string, string> = {
  "routes/procurement/purchase-order/po-item-cells/pr-source-button.tsx":
    "popover content opened from the cell, not a cell line (uppercase section eyebrow)",
  "routes/procurement/purchase-request/pr-item-cells/location-cell.tsx":
    "popover content opened from the cell (location detail card), not a cell line",
  "routes/procurement/purchase-request/pr-item-cells/product-cell.tsx":
    "popover content opened from the cell (product detail card), not a cell line",
  "routes/procurement/purchase-request/pr-pricelist-dialog.tsx":
    "Badge chips inside cells — chip size, not cell text",
  "routes/vendor-management/price-list/pl-period-cell.tsx":
    "validity status pill — chip size, not cell text",
};

function tsxFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return tsxFiles(rel);
    return e.name.endsWith(".tsx") && !e.name.endsWith(".test.tsx")
      ? [rel]
      : [];
  });
}

const indent = (line: string) => line.length - line.trimStart().length;

/** body ของ `cell:` / `header:` ทุกตัวในไฟล์ (รวมบรรทัดที่ประกาศ) */
export function columnBodies(src: string): string[] {
  const lines = src.split("\n");
  const bodies: string[] = [];
  lines.forEach((line, i) => {
    if (!/^\s*(?:cell|header)\s*:/.test(line)) return;
    const base = indent(line);
    const body = [line];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (next.trim() === "") continue;
      if (indent(next) <= base) break;
      body.push(next);
    }
    bodies.push(body.join("\n"));
  });
  return bodies;
}

/** ตัด CELL_SUB_CLASS ออกก่อนตรวจ — `text-micro` ที่มาจากค่าคงที่นี้ถูกกติกา */
export function hasOwnSize(body: string): boolean {
  return SIZE.test(body.replaceAll("CELL_SUB_CLASS", ""));
}

/** ไฟล์ที่เป็น cell component ทั้งไฟล์ */
export const CELL_FILE = /(?:-cells\/[^/]+|-cells?)\.tsx$/;

const offenders = (): string[] =>
  ["routes", "components"]
    .flatMap(tsxFiles)
    .filter((file) => !file.endsWith("data-grid/cell-text.tsx"))
    .filter((file) => {
      const src = readFileSync(join(ROOT, file), "utf-8");
      return CELL_FILE.test(file)
        ? hasOwnSize(src)
        : columnBodies(src).some(hasOwnSize);
    });

describe("table cells use the two role sizes only", () => {
  it("no cell:/header: sets its own font size outside the allowlist", () => {
    expect(offenders().filter((f) => !(f in ALLOWLIST))).toEqual([]);
  });

  it("allowlist has no stale entries", () => {
    const live = new Set(offenders());
    expect(Object.keys(ALLOWLIST).filter((f) => !live.has(f))).toEqual([]);
  });

  it("has no pending-migration entries", () => {
    expect(
      Object.entries(ALLOWLIST)
        .filter(([, why]) => why === "pending migration")
        .map(([f]) => f),
    ).toEqual([]);
  });

  it("detects the pattern it guards", () => {
    const flag = (src: string) => columnBodies(src).some(hasOwnSize);
    expect(
      flag(`  cell: ({ row }) => <span className="text-sm">x</span>,`),
    ).toBe(true);
    expect(
      flag(
        `  cell: () => (\n    <div className="font-mono text-micro-legal">x</div>\n  ),`,
      ),
    ).toBe(true);
    expect(flag(`  cell: () => <span className="text-micro">x</span>,`)).toBe(
      true,
    );
    expect(flag(`  cell: () => <CellSub>x</CellSub>,`)).toBe(false);
    expect(
      flag(`  cell: () => <span className={CELL_SUB_CLASS}>x</span>,`),
    ).toBe(false);
    expect(
      flag(`  cell: () => <span className="text-xs font-semibold">x</span>,`),
    ).toBe(false);
    expect(
      flag(`  cell: () => <b className="text-micro-eyebrow uppercase">x</b>,`),
    ).toBe(false);
  });

  it("treats cell component files as whole-file cells", () => {
    expect(
      CELL_FILE.test(
        "routes/procurement/purchase-request/pr-item-cells/product-cell.tsx",
      ),
    ).toBe(true);
    expect(CELL_FILE.test("components/share/audit-cell.tsx")).toBe(true);
    expect(
      CELL_FILE.test(
        "routes/vendor-management/request-price-list/rfp-vendor-cells.tsx",
      ),
    ).toBe(true);
    expect(
      CELL_FILE.test("routes/procurement/purchase-request/pr-form.tsx"),
    ).toBe(false);
    expect(CELL_FILE.test("components/ui/data-grid/data-grid-table.tsx")).toBe(
      false,
    );
  });

  it("covers header renderers but not code outside column defs", () => {
    const flag = (src: string) => columnBodies(src).some(hasOwnSize);
    expect(flag(`  header: () => <span className="text-sm">H</span>,`)).toBe(
      true,
    );
    expect(flag(`  return <p className="text-sm">x</p>;`)).toBe(false);
    // body จบที่บรรทัดเยื้องเท่าเดิม — property ถัดไปไม่ถูกนับเป็นของ cell
    expect(
      flag(
        `    cell: () => <span>x</span>,\n    meta: { className: "text-sm" },`,
      ),
    ).toBe(false);
  });
});
