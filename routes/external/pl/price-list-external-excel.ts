import { buildXlsxFileName } from "@/lib/xlsx-utils";
import { priceListTaxParts } from "@/lib/price-list-tax";
import type {
  PricelistExternalDto,
  PricelistExternalDetailDto,
  PricelistExternalTaxProfileOption,
} from "@/types/price-list-external";

// header ของ sheet (portal เป็น public → อังกฤษล้วนเหมือน UI ส่วนอื่น)
// "No." = sequence_no ใช้เป็น key จับคู่ตอน upload ห้ามให้ vendor แก้
// "Tax Profile" = ชื่อ tax profile (dropdown) → map กลับเป็น id + rate ตอน import
const H = {
  no: "No.",
  code: "Product Code",
  name: "Product Name",
  unit: "Unit",
  moq: "MOQ Qty",
  price: "Price",
  tax: "Tax Profile",
  lead: "Lead Time (days)",
  note: "Note",
} as const;

// ตำแหน่งคอลัมน์ Tax Profile (1-based) — ใช้ผูก data validation
const TAX_COL = 7;

function triggerDownload(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * โหลด price list external ปัจจุบันเป็น xlsx (1 แถว/product) ให้ vendor เอาไปกรอก
 * offline · คอลัมน์ Tax Profile เป็น dropdown เลือกจากรายการ tax profile จริง
 * (ผูกกับ sheet ซ่อน "TaxProfiles" เลี่ยง limit ของ inline list) เพื่อให้ import
 * map ชื่อกลับเป็น id ได้ · ใช้ exceljs เพราะ sheetjs community เขียน dropdown ไม่ได้
 */
export async function downloadExternalPricelistXlsx(
  data: PricelistExternalDto,
  taxProfiles: PricelistExternalTaxProfileOption[],
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Price List");

  ws.columns = [
    { header: H.no, key: "no", width: 6 },
    { header: H.code, key: "code", width: 16 },
    { header: H.name, key: "name", width: 32 },
    { header: H.unit, key: "unit", width: 12 },
    { header: H.moq, key: "moq", width: 10 },
    { header: H.price, key: "price", width: 12 },
    { header: H.tax, key: "tax", width: 22 },
    { header: H.lead, key: "lead", width: 16 },
    { header: H.note, key: "note", width: 32 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const d of data.tb_pricelist_detail) {
    ws.addRow({
      no: d.sequence_no,
      code: d.product_code,
      name: d.product_name,
      unit: d.unit_name ?? "",
      moq: d.moq_qty,
      price: d.price,
      tax: d.tax_profile_name ?? "",
      lead: d.lead_time_days,
      note: d.note ?? "",
    });
  }

  const names = taxProfiles.map((t) => t.name);
  if (names.length > 0) {
    // inline list (`"a,b,c"`) โชว์ dropdown ได้กว้างกว่า cross-sheet ref และ
    // ไม่พึ่ง sheet ซ่อน — ใช้ได้ถ้าไม่มีชื่อที่มี comma และรวมกันไม่เกิน 255 ตัว
    // (limit สูตร Excel) · เกินนั้นค่อย fallback ไป range บน sheet ซ่อน
    const inline = `"${names.join(",")}"`;
    const canInline =
      !names.some((n) => n.includes(",")) && inline.length <= 255;

    let formula: string;
    if (canInline) {
      formula = inline;
    } else {
      const refWs = wb.addWorksheet("TaxProfiles", { state: "hidden" });
      names.forEach((n, i) => {
        refWs.getCell(`A${i + 1}`).value = n;
      });
      formula = `TaxProfiles!$A$1:$A$${names.length}`;
    }

    const lastRow = data.tb_pricelist_detail.length + 1;
    for (let r = 2; r <= lastRow; r++) {
      ws.getCell(r, TAX_COL).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: "warning",
        error: "Please pick a tax profile from the list.",
      };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    buf as ArrayBuffer,
    `${buildXlsxFileName(data.pricelist_no || "price-list")}.xlsx`,
  );
}

function toNum(v: unknown, fallback: number): number {
  if (v === "" || v == null) return fallback;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
}

export type ExcelImportResult =
  | {
      readonly ok: false;
      readonly reason: "structure" | "no-match";
    }
  | {
      readonly ok: true;
      readonly updated: PricelistExternalDetailDto[];
      readonly applied: number;
      readonly skipped: number;
    };

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

/**
 * เอาค่าจากแถว excel (อ่านด้วย readXlsxFirstSheet) กลับเข้ารายการ detail
 *
 * validate 2 ชั้นกัน vendor วางไฟล์มั่ว:
 * 1. โครงสร้าง — ต้องมี header "Product Code" + "Price" ไม่งั้น = ไม่ใช่ไฟล์นี้
 * 2. จับคู่ด้วย **product_code** (ไม่ใช่ตำแหน่ง/No.) → apply ตามตัวสินค้า reorder
 *    ไม่พัง และเอาไฟล์ของ price list อื่นมาวางก็ไม่ทับผิดตัว · ไม่มี code ไหน
 *    match เลย = ไฟล์ไม่ใช่ของเอกสารนี้ → reject
 *
 * ช่องว่างคงค่าเดิม · Tax Profile (ชื่อ) map กลับเป็น id + rate จาก taxProfiles
 * (ไม่รู้จัก/ว่าง = คงเดิม) แล้วคำนวณ tax_amt ใหม่แบบ add VAT (price = ก่อนภาษี)
 */
export function applyExcelRows(
  rows: Record<string, unknown>[],
  details: PricelistExternalDetailDto[],
  taxProfiles: PricelistExternalTaxProfileOption[],
): ExcelImportResult {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  if (!headers.includes(H.code) || !headers.includes(H.price)) {
    return { ok: false, reason: "structure" };
  }

  const indexByCode = new Map<string, number>();
  details.forEach((d, i) => {
    if (d.product_code) indexByCode.set(norm(d.product_code), i);
  });
  const profileByName = new Map(taxProfiles.map((t) => [norm(t.name), t]));

  const updated = details.map((d) => ({ ...d }));
  let applied = 0;
  let skipped = 0;

  for (const row of rows) {
    const code = norm(row[H.code]);
    const idx = code ? indexByCode.get(code) : undefined;
    if (idx === undefined) {
      skipped++;
      continue;
    }
    const d = updated[idx];
    const price = toNum(row[H.price], d.price);

    // Tax Profile (ชื่อจาก dropdown) → resolve เป็น id + rate · ไม่ match/ว่าง = คงเดิม
    let taxProfileId = d.tax_profile_id;
    let taxProfileName = d.tax_profile_name;
    let rate = d.tax_rate;
    const taxCell = row[H.tax];
    if (typeof taxCell === "string" && taxCell.trim() !== "") {
      const prof = profileByName.get(norm(taxCell));
      if (prof) {
        taxProfileId = prof.id;
        taxProfileName = prof.name;
        rate = prof.tax_rate;
      }
    }
    const { priceWithoutTax, taxAmt } = priceListTaxParts(price, rate);
    const noteCell = row[H.note];
    updated[idx] = {
      ...d,
      moq_qty: toNum(row[H.moq], d.moq_qty),
      price,
      tax_profile_id: taxProfileId,
      tax_profile_name: taxProfileName,
      tax_rate: rate,
      price_without_tax: priceWithoutTax,
      tax_amt: taxAmt,
      lead_time_days: toNum(row[H.lead], d.lead_time_days),
      note: noteCell === "" || noteCell == null ? d.note : String(noteCell),
    };
    applied++;
  }

  if (applied === 0) return { ok: false, reason: "no-match" };
  return { ok: true, updated, applied, skipped };
}
