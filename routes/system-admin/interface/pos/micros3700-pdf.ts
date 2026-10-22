/** ชนิดที่เปิด PDF ไม่ได้: `password` = ไฟล์มีรหัสผ่าน, `unreadable` = ไฟล์เสีย/ไม่ใช่ PDF */
export type Micros3700PdfErrorKind = "password" | "unreadable";

/** ข้อผิดพลาดตอนเปิด PDF ด้วย pdf.js — ให้ UI แยกข้อความตาม `kind` */
export class Micros3700PdfError extends Error {
  readonly kind: Micros3700PdfErrorKind;

  constructor(kind: Micros3700PdfErrorKind, message?: string) {
    super(message ?? kind);
    this.name = "Micros3700PdfError";
    this.kind = kind;
  }
}

/** ผลการดึงข้อความ: `lines[i]` = ช่วงข้อความของบรรทัดที่ i (ต่อทุกหน้า เรียงบน→ล่าง) */
export interface Micros3700PdfText {
  lines: string[][];
  page_count: number;
  extract_ms: number;
}

/** y ต่างกันไม่เกินนี้ = บรรทัดเดียวกัน */
const LINE_Y_TOLERANCE = 4;
/** ช่องว่างระหว่าง item ไม่เกินนี้ = ช่วงเดียวกัน */
const SEGMENT_GAP = 20;

interface RawItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

interface RawLine {
  y: number;
  items: RawItem[];
}

function groupIntoLines(items: RawItem[]): RawLine[] {
  const lines: RawLine[] = [];
  for (const item of items) {
    const line = lines.find((l) => Math.abs(l.y - item.y) <= LINE_Y_TOLERANCE);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

function toSegments(line: RawLine): string[] {
  const sorted = [...line.items].sort((a, b) => a.x - b.x);
  const groups: RawItem[][] = [];
  let prev: RawItem | null = null;
  for (const item of sorted) {
    if (prev && item.x - (prev.x + prev.width) <= SEGMENT_GAP) {
      groups[groups.length - 1].push(item);
    } else {
      groups.push([item]);
    }
    prev = item;
  }
  return groups
    .map((g) =>
      g
        .map((i) => i.str.trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((s) => s !== "");
}

/**
 * ดึงข้อความจาก PDF รายงาน Micros 3700 ในเบราว์เซอร์ (PDF ไม่ออกจากเครื่อง)
 * pdf.js และ worker โหลดแบบ lazy — worker ถูก emit เป็น asset ของ bundle (`worker-src 'self'`)
 */
export async function extractMicros3700Lines(file: File): Promise<Micros3700PdfText> {
  const started = performance.now();
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false });
  let pdf: Awaited<typeof loadingTask.promise>;
  try {
    pdf = await loadingTask.promise;
  } catch (e) {
    // เปิดไม่สำเร็จ = ไม่มี pdf ให้ destroy — ต้องปิด loading task (และ worker) เอง
    void loadingTask.destroy();
    if (e instanceof Error && e.name === "PasswordException") throw new Micros3700PdfError("password");
    throw new Micros3700PdfError("unreadable", e instanceof Error ? e.message : undefined);
  }

  try {
    const lines: string[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      try {
        const content = await page.getTextContent();
        const items: RawItem[] = [];
        for (const it of content.items) {
          if (!("str" in it) || it.str.trim() === "") continue;
          items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width });
        }
        for (const line of groupIntoLines(items)) {
          const segments = toSegments(line);
          if (segments.length > 0) lines.push(segments);
        }
      } finally {
        page.cleanup();
      }
    }
    return { lines, page_count: pdf.numPages, extract_ms: Math.round(performance.now() - started) };
  } finally {
    await pdf.destroy();
  }
}
