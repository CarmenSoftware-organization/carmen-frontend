import { format as formatDate } from "date-fns";

/**
 * แปลง config ของ running code ไป-กลับระหว่าง JSON ที่ backend ใช้ กับ "รายการ
 * ส่วนประกอบ" ที่ฟอร์มให้คนกรอก
 *
 * รูปแบบฝั่ง backend เป็นภาษาเล็ก ๆ ของตัวเอง: ช่องชื่อ `A`/`B`/`C`… เก็บส่วนประกอบ
 * ชิ้นละช่อง แล้ว `format` ประกอบเรียงกัน
 *
 * ```json
 * { "A": "GRN", "B": "date('yyMM')", "C": "running(5, '0')", "format": "{A}{B}{C}" }
 * ```
 *
 * ฟอร์มไม่ให้คนกรอกเห็นตัวอักษร A/B/C หรือคำว่า format เลย — มันคือรายละเอียดการ
 * เก็บข้อมูล ไม่ใช่สิ่งที่คนตั้งเลขเอกสารต้องรู้ ชื่อช่องถูกไล่ใหม่ตามลำดับทุกครั้ง
 * ที่บันทึก
 */

export type PartKind = "text" | "date" | "running" | "token";

export interface CodePart {
  kind: PartKind;
  text?: string;
  pattern?: string;
  digits?: number;
  pad?: string;
  token?: string;
}

export interface ParsedConfig {
  parts: CodePart[];
  /**
   * คีย์อื่นใน config ที่ไม่ได้ถูกอ้างใน `format`
   *
   * **ต้องเก็บกลับไปตอนบันทึกเสมอ** — backend รับคีย์อะไรก็ได้ ถ้าฟอร์มเขียนทับด้วย
   * เฉพาะคีย์ที่ตัวเองรู้จัก แอดมินที่เปิดมาแก้แค่คำนำหน้าจะทำคีย์อื่นหายทั้งหมด
   * โดยไม่มีอะไรเตือน
   */
  extra: Record<string, unknown>;
}

const RUNNING_RE = /^running\(\s*(\d+)\s*,\s*'(.)'\s*\)$/;
const DATE_RE = /^date\(\s*'([^']+)'\s*\)$/;
const TOKEN_RE = /^\{(.+)\}$/;
const SLOT_RE = /\{([^{}]+)\}/g;

export function slotName(index: number): string {
  let n = index;
  let name = "";
  do {
    name = String.fromCodePoint(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

function parseValue(raw: unknown): CodePart {
  const value = typeof raw === "string" ? raw : String(raw ?? "");
  const running = RUNNING_RE.exec(value);
  if (running) {
    return { kind: "running", digits: Number(running[1]), pad: running[2] };
  }
  const date = DATE_RE.exec(value);
  if (date) return { kind: "date", pattern: date[1] };
  const token = TOKEN_RE.exec(value);
  if (token) return { kind: "token", token: token[1] };
  return { kind: "text", text: value };
}

/**
 * อ่าน config เป็นรายการส่วนประกอบ
 *
 * คืน `null` เมื่ออ่านไม่ออก (ไม่มี `format` หรือ `format` อ้างช่องที่ไม่มีจริง) —
 * ผู้เรียกต้องถอยไปให้แก้เป็น JSON ดิบแทน ดีกว่าเดาแล้วเขียนทับของเดิมพัง
 */
export function parseConfig(
  config: Record<string, unknown> | undefined | null,
): ParsedConfig | null {
  // ไม่มีอะไรเลย = ของใหม่ เริ่มจากรายการเปล่า ไม่ใช่ "อ่านไม่ออก"
  if (!config || Object.keys(config).length === 0) {
    return { parts: [], extra: {} };
  }
  const template = config.format;
  if (typeof template !== "string" || !template.trim()) return null;

  const used = new Set<string>(["format"]);
  const parts: CodePart[] = [];
  for (const match of template.matchAll(SLOT_RE)) {
    const key = match[1];
    if (!(key in config)) return null; // format อ้างช่องที่ไม่มี — อ่านไม่ออก
    used.add(key);
    parts.push(parseValue(config[key]));
  }
  // `format` ที่ไม่มี `{...}` เลย = ข้อความล้วน ไม่ใช่ template ที่ฟอร์มนี้แก้ได้
  if (parts.length === 0) return null;

  const extra = Object.fromEntries(
    Object.entries(config).filter(([k]) => !used.has(k)),
  );
  return { parts, extra };
}

function serializeValue(part: CodePart): string {
  switch (part.kind) {
    case "running":
      return `running(${part.digits ?? 1}, '${part.pad ?? "0"}')`;
    case "date":
      return `date('${part.pattern ?? "yyMM"}')`;
    case "token":
      return `{${part.token ?? ""}}`;
    default:
      return part.text ?? "";
  }
}

export function serializeConfig(
  parts: CodePart[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const slots: Record<string, unknown> = {};
  let template = "";
  parts.forEach((part, i) => {
    const key = slotName(i);
    slots[key] = serializeValue(part);
    template += `{${key}}`;
  });
  // extra มาก่อนเพื่อไม่ให้คีย์เก่าที่ชื่อชนกับ A/B/C ทับของใหม่
  return { ...extra, ...slots, format: template };
}

/**
 * ตัวอย่างเลขที่เอกสารจากรายการส่วนประกอบ
 *
 * นี่คือหัวใจของฟอร์ม — คนตั้งค่าไม่ได้อยากรู้ว่า `running(5,'0')` แปลว่าอะไร
 * เขาอยากรู้ว่าเลขบนใบจะออกมาหน้าตายังไง
 *
 * @param parts - ส่วนประกอบตามลำดับ
 * @param now - วันที่ใช้เรนเดอร์ส่วนที่เป็นวันที่ (ส่งเข้ามาเพื่อให้เทสต์คงที่)
 * @param seq - เลขลำดับที่จะโชว์ในตัวอย่าง (default 1)
 */
export function previewCode(parts: CodePart[], now: Date, seq = 1): string {
  return parts
    .map((part) => {
      switch (part.kind) {
        case "running": {
          const pad = part.pad ?? "0";
          return String(seq).padStart(part.digits ?? 1, pad || "0");
        }
        case "date":
          try {
            return formatDate(now, part.pattern ?? "yyMM");
          } catch {
            // รูปแบบที่ date-fns ไม่รู้จัก — โชว์ของดิบไว้ ดีกว่าตัวอย่างหายทั้งบรรทัด
            return part.pattern ?? "";
          }
        case "token":
          // ค่าจริงมาตอนออกเอกสาร ตัวอย่างจึงโชว์ชื่อค่าไว้ให้รู้ว่าตรงนี้จะมีอะไรมาแทน
          return `‹${part.token ?? ""}›`;
        default:
          return part.text ?? "";
      }
    })
    .join("");
}

/**
 * ตัวอย่างเลขที่เอกสารจาก config ดิบของแถว — ใช้ในตาราง/การ์ดของหน้า list
 *
 * คืน `null` เมื่อ config ว่างหรือตัวช่วยอ่านไม่ออก (ผู้เรียกโชว์ — แทนการเดา)
 */
export function exampleCode(
  config: Record<string, unknown> | undefined | null,
  now: Date,
): string | null {
  const parsed = parseConfig(config);
  if (!parsed || parsed.parts.length === 0) return null;
  return previewCode(parsed.parts, now);
}
