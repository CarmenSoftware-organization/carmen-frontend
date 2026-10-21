/**
 * ตัวแปรที่แทรกในข้อความแจ้งเตือนได้
 *
 * รายการนี้อ่านจากเทมเพลตจริงและ **เรียงตามความถี่ที่ใช้จริงโดยประมาณ**
 * (docNo อยู่ครบทุกแถว, docType มากับเทมเพลตเวิร์กโฟลว์ของระบบ, actorName มาก,
 * recipientName/url รองลงมา, ที่เหลือใช้น้อย) ตัวที่ใช้บ่อยที่สุดจึงเป็นชิปตัวแรก — ปุ่มที่กดบ่อยอยู่ใกล้มือที่สุด
 *
 * ผู้เติมค่าจริงคือ backend ตอนส่ง — ฝั่งนี้ไม่ได้บังคับว่ามีตัวไหนได้บ้าง เป็น
 * "รายการที่รู้จัก" สำหรับปุ่มแทรกและพรีวิว ตัวแปรนอกรายการที่พิมพ์เองจะถูก
 * ทำเครื่องหมายว่าไม่รู้จักในพรีวิว ไม่ใช่เงียบหาย
 */
export const NOTIFICATION_VARIABLES = [
  "docNo",
  "docType",
  "actorName",
  "recipientName",
  "url",
  "currentStage",
  "department",
  "totalAmount",
  "reason",
] as const;

export type NotificationVariable = (typeof NOTIFICATION_VARIABLES)[number];

/** ค่าตัวอย่างสำหรับพรีวิวเท่านั้น ไม่เคยถูกส่งออกไปจริง */
export const NOTIFICATION_VARIABLE_SAMPLES: Record<string, string> = {
  docNo: "PR-2026-000412",
  docType: "PR",
  actorName: "Somchai Prasert",
  recipientName: "Alex Tan",
  url: "https://carmen.example.com/pr/PR-2026-000412",
  currentStage: "Department Head",
  department: "Food & Beverage",
  totalAmount: "125,400.00 THB",
  reason: "Budget exceeded for this period",
};

const TOKEN_RE = /\{\{(\w+)\}\}/g;

export interface TemplateSegment {
  readonly text: string;
  /** ตัวแปรที่รู้จัก = แทนค่าตัวอย่างแล้ว · unknown = ไม่มีใครเติมให้ตอนส่งจริง */
  readonly kind: "text" | "value" | "unknown";
}

/**
 * ตัดข้อความเทมเพลตเป็นชิ้น ๆ สำหรับพรีวิว
 *
 * คืน segment แทนสตริงสำเร็จรูป เพราะพรีวิวต้องย้อมสีค่าที่เติมมาให้ต่างจาก
 * ข้อความคงที่ และต้องเน้นตัวแปรที่ไม่รู้จักให้เห็นทันทีว่าจะค้างเป็น `{{...}}`
 * ไปถึงผู้รับ — งานนี้ทำด้วยสตริงเดียวไม่ได้ และการคืน ReactNode ก็ทำให้
 * ไม่ต้องแตะ `dangerouslySetInnerHTML` เลย (การแจ้งเตือนเป็นข้อความล้วนอยู่แล้ว)
 */
export function splitTemplate(template: string): TemplateSegment[] {
  const out: TemplateSegment[] = [];
  let last = 0;
  for (const m of template.matchAll(TOKEN_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: template.slice(last, at), kind: "text" });
    const sample = NOTIFICATION_VARIABLE_SAMPLES[m[1]];
    out.push(
      sample === undefined
        ? { text: m[0], kind: "unknown" }
        : { text: sample, kind: "value" },
    );
    last = at + m[0].length;
  }
  if (last < template.length) {
    out.push({ text: template.slice(last), kind: "text" });
  }
  return out;
}

/** ตัวแปรในข้อความที่ไม่มีค่าตัวอย่าง = ไม่มีใครเติมให้ตอนส่งจริง */
export function unknownVariables(template: string): string[] {
  const found = [...template.matchAll(TOKEN_RE)].map((m) => m[1]);
  return [
    ...new Set(
      found.filter((k) => NOTIFICATION_VARIABLE_SAMPLES[k] === undefined),
    ),
  ];
}
