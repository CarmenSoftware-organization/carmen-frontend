/**
 * ข้อมูล item ที่ส่งให้ AI
 *
 * ส่ง **จำนวน หน่วย และราคาที่จะจ่าย** ไปด้วยเสมอ ไม่ใช่แค่ชื่อสินค้า — คำถามคือ
 * "ราคานี้สมเหตุสมผลไหม" ซึ่งตอบไม่ได้เลยถ้าไม่รู้ว่าซื้อกี่หน่วยและจ่ายเท่าไหร่
 * (ราคาตลาดของ 1 ขวดกับ 100 ลังคนละเรื่อง)
 *
 * **ไม่ส่งชื่อคลัง** — ไม่ช่วยให้คำตอบดีขึ้นเลย แต่บอกโครงสร้างภายในโรงแรมออกไป
 * ให้บริการภายนอกฟรี ๆ
 */
export interface PrAiQueryItem {
  readonly productName: string;
  readonly productLocalName?: string;
  readonly qty?: number;
  readonly unitName?: string;
  readonly price?: number;
  readonly currencyCode?: string;
}

function money(value: number | undefined, currency: string | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "—";
  }
  return `${value.toFixed(2)}${currency ? ` ${currency}` : ""}`;
}

/** URL ที่แทนแล้วยาวเกินนี้ → คัดลอกลง clipboard แทน (เบราว์เซอร์/เซิร์ฟเวอร์ตัดที่ราว ๆ นี้) */
const MAX_URL_LENGTH = 8000;

/**
 * สร้าง prompt จาก template ของ provider + ตาราง item
 * `{items}` แทนทุกจุดด้วย function replacer (กัน `$&` ใน prompt) — ไม่มี `{items}`
 * ต่อตารางท้าย prompt หลังบรรทัดว่าง
 */
export function buildPrAiQuery(
  template: string,
  items: readonly PrAiQueryItem[],
): string {
  const rows = items
    .filter((it) => it.productName)
    .map((it, i) => {
      const name = it.productLocalName
        ? `${it.productName} (${it.productLocalName})`
        : it.productName;
      const qty =
        typeof it.qty === "number" && it.qty > 0
          ? `${it.qty}${it.unitName ? ` ${it.unitName}` : ""}`
          : "—";
      return `| ${i + 1} | ${name} | ${qty} | ${money(it.price, it.currencyCode)} |`;
    });

  const table = [
    "| # | Item | Qty | Quoted price |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");

  return template.includes("{items}")
    ? template.replace(/\{items\}/g, () => table)
    : `${template}\n\n${table}`;
}

/**
 * แทน `{query}` ใน url_template — `copy: true` = ผู้เรียกต้องคัดลอก prompt ลง clipboard
 * (provider ไม่รับ prefill หรือ URL ยาวเกิน)
 */
export function buildProviderUrl(
  urlTemplate: string,
  query: string,
): { url: string; copy: boolean } {
  if (!urlTemplate.includes("{query}")) {
    return { url: urlTemplate, copy: true };
  }
  const encoded = encodeURIComponent(query);
  const url = urlTemplate.replace(/\{query\}/g, () => encoded);
  if (url.length <= MAX_URL_LENGTH) return { url, copy: false };
  return { url: urlTemplate.replace(/\{query\}/g, ""), copy: true };
}
