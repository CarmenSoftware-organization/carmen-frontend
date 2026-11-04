import type { ComponentType } from "react";
import {
  Archive,
  ArrowLeftRight,
  BadgePercent,
  Ban,
  Check,
  CircleSmall,
  Clock,
  FileText,
  Flag,
  Handshake,
  Hourglass,
  Lock,
  Minus,
  PackageOpen,
  PenLine,
  Percent,
  Save,
  Send,
  SquarePen,
  Tags,
  Truck,
  Undo2,
  Unlock,
  Warehouse,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * จุดสีทึบขนาดเท่าจุดของชิปเดิม (`CircleSmall` r=6 + fill = 8px ที่กล่อง 14px)
 * — ใช้แทนไอคอนสำหรับสถานะที่เป็น "เปิด/ปิด" ซึ่งมีแค่สองค่าตรงข้ามกัน ไม่มี
 * รูปทรงให้แยก ต่างจากสถานะเอกสารที่ไล่เป็นลำดับเจ็ดแปดค่า
 */
const FilledDot = (props: LucideProps) => (
  <CircleSmall {...props} fill="currentColor" />
);

/**
 * ไอคอนกับสีของแต่ละสถานะ — สัญลักษณ์เปล่า ไม่มีวงกลมกำกับ เพราะวงกลมกินพื้นที่
 * ไปกับเส้นขอบที่ไม่ได้บอกอะไร เหลือแต่ตัวสัญลักษณ์ที่พนักงานหน้างานอ่านออกทันที:
 * ดินสอ = ยังร่าง · นาฬิกา = รออยู่ · เครื่องบิน = ส่งออกไปแล้ว · เปอร์เซ็นต์ = มา
 * บางส่วน · ติ๊ก = ผ่านแล้ว · ธง = ถึงปลายทางแล้ว · กล่องเก็บ = ปิดใบแล้ว ·
 * แผ่นบันทึก = บันทึกไว้ · กุญแจ = ยืนยันแล้วแก้ไม่ได้ · นาฬิกาทราย = เข้าคิวรอ ·
 * ห้าม = ยกเลิก · กากบาท = ไม่อนุมัติ/ล้มเหลว
 *
 * `completed` ใช้ธงไม่ใช่ติ๊กซ้อน เพราะมันไม่ใช่ "อนุมัติแรงกว่า approved" แต่เป็น
 * คนละเรื่อง — จบทั้งกระบวนการแล้ว ติ๊กสองอันข้างติ๊กอันเดียวอ่านเป็นระดับของ
 * สิ่งเดียวกัน ซึ่งทำให้เข้าใจผิด
 *
 * สีอ้าง custom property ชุดเดียวกับ dot chip เดิมใน `styles/badge-status.css`
 * ตัวสถานะจึงไม่เปลี่ยนสีเมื่อสลับไปหน้าที่ยังใช้ chip
 */
const STATUS_ICON: Record<
  string,
  { icon: ComponentType<LucideProps>; color?: string }
> = {
  draft: { icon: PenLine, color: "var(--status-draft)" },
  in_progress: { icon: Clock, color: "var(--status-in-progress)" },
  approved: { icon: Check, color: "var(--status-approved)" },
  completed: { icon: Flag, color: "var(--status-completed)" },
  /* PO — ใบสั่งซื้อเดินต่อจากอนุมัติแล้ว: ส่งให้ผู้ขาย → ของมาบางส่วน → ปิดใบ */
  sent: { icon: Send, color: "var(--status-sent)" },
  partial: { icon: Percent, color: "var(--status-partial)" },
  closed: { icon: Archive, color: "var(--status-closed)" },
  /* GRN — ใบรับของไม่มี workflow: บันทึกไว้ก่อน แล้วค่อยยืนยันตัดสต๊อกจริง */
  saved: { icon: Save, color: "var(--status-save)" },
  save: { icon: Save, color: "var(--status-save)" },
  committed: { icon: Lock, color: "var(--status-committed)" },
  /* รอบบัญชี — เปิดรับรายการ → ปิดรอบ → ล็อกถาวร */
  open: { icon: Unlock, color: "var(--status-open)" },
  locked: { icon: Lock, color: "var(--status-locked)" },
  /* ใบสำคัญ GL (JV) — ร่าง → ตรวจ → ตั้งเวลา post → post แล้ว (ล็อก) · void ใช้ร่วมกับ voided */
  in_review: { icon: Clock, color: "var(--status-in-progress)" },
  scheduled: { icon: Hourglass, color: "var(--status-pending)" },
  posted: { icon: Lock, color: "var(--status-committed)" },
  void: { icon: Ban, color: "var(--status-voided)" },
  /* งานเบื้องหลัง (ออกรายงาน) — เข้าคิว → กำลังทำ → เสร็จ/ล้มเหลว */
  queued: { icon: Hourglass, color: "var(--status-pending)" },
  processing: { icon: Clock, color: "var(--status-in-progress)" },
  failed: { icon: X, color: "var(--status-rejected)" },
  voided: { icon: Ban, color: "var(--status-voided)" },
  rejected: { icon: X, color: "var(--status-rejected)" },
  cancelled: { icon: Ban, color: "var(--status-cancelled)" },
  /* ตีกลับให้แก้ — API ส่งมาสองรูป (`review` เป็นกริยาที่ frontend ยิงไป,
     `send_back`/`sendback` เป็นรูปที่อ่านกลับมา ดู constant/item-history.ts)
     สีเดียวกับชิปในไทม์ไลน์ประวัติ คนจะได้โยงสองที่เข้าด้วยกันได้ */
  review: { icon: Undo2, color: "var(--status-review)" },
  send_back: { icon: Undo2, color: "var(--status-review)" },
  sendback: { icon: Undo2, color: "var(--status-review)" },
  /* สถานะระดับ "รายการ" (PR/PO/SR) — คำกริยาคือสิ่งที่คนกดส่งไป ส่วนรูปอดีตข้างบน
     คือสิ่งที่บันทึกแล้ว ทั้งคู่โผล่บนจอได้ทั้งคู่แล้วแต่ว่าอ่านจากฟอร์มหรือจาก
     server จึงต้องมีไอคอนเหมือนกัน ไม่งั้นแถวที่เพิ่งติ๊กจะกลายเป็นขีดของ FALLBACK
     ทั้งที่แถวข้าง ๆ ที่โหลดมามีไอคอนปกติ */
  pending: { icon: Clock, color: "var(--status-pending)" },
  approve: { icon: Check, color: "var(--status-approved)" },
  reject: { icon: X, color: "var(--status-rejected)" },
  submit: { icon: Send, color: "var(--status-submitted)" },
  submitted: { icon: Send, color: "var(--status-submitted)" },
  /* price list / template — เปิด/ปิดใช้งานเป็นจุดสี ไม่ใช่รูปทรง (ดู FilledDot)
     สีตามชิปเดิมใน STATUS_CLASSNAMES: active = เขียวเดียวกับ approved ·
     inactive = เทาเดียวกับ closed */
  active: { icon: FilledDot, color: "var(--status-approved)" },
  inactive: { icon: FilledDot, color: "var(--status-closed)" },
};

/**
 * ชนิดของเอกสาร — **ไม่มีสี** โดยตั้งใจ มันคือคุณสมบัติของใบ ไม่ใช่ความคืบหน้า
 * ให้สีเมื่อไรก็แย่งสายตาไปจากสถานะซึ่งเป็นสิ่งที่คนกวาดตาหาจริง ๆ
 * (ไอคอนรับสีจากข้อความรอบตัวแทน)
 */
const TYPE_ICON: Record<string, { icon: LucideIcon; color?: string }> = {
  // สร้างจากเอกสารต้นทาง — ใบขอซื้อ (PO) กับใบสั่งซื้อ (GRN) เป็นเรื่องเดียวกัน
  // ในสายตาคนอ่าน จึงใช้ไอคอนเดียวกัน
  purchase_request: { icon: FileText },
  purchase_order: { icon: FileText },
  manual: { icon: SquarePen },
  pricelist: { icon: Tags },
  // ใบลดหนี้ — คืนของ (ของไหลกลับ) กับ ลดเงิน (ตัวเงินอย่างเดียว ของไม่ขยับ)
  quantity_return: { icon: Undo2 },
  amount_discount: { icon: BadgePercent },
  // ใบเบิก — โอน (ของย้ายไปอีกคลัง ยังอยู่ในระบบ) กับ เบิกใช้ (ของออกจากคลังไปใช้จริง)
  transfer: { icon: ArrowLeftRight },
  issue: { icon: PackageOpen },
  // ประเภทคลัง — เก็บสต๊อกจริง · ซื้อมาใช้เลยไม่ผ่านคลัง · ของฝากขายของผู้ขาย
  inventory: { icon: Warehouse },
  direct: { icon: Truck },
  consignment: { icon: Handshake },
};

const FALLBACK = { icon: Minus, color: "var(--status-draft)" };

/**
 * ไอคอน + สีของสถานะหนึ่งค่า — ให้ที่อื่นหยิบไปใช้โดยไม่ต้องผ่าน `StatusIconLabel`
 * (ตัวกรองในรายการใช้ตัวนี้เพื่อให้ไอคอนในเมนูตรงกับที่เห็นในตาราง)
 *
 * @param status - ค่า status ดิบ
 * @returns ไอคอนกับสีของสถานะนั้น หรือค่าสำรองเมื่อไม่รู้จัก
 */
export function getStatusIcon(status: string) {
  return lookupIcon(status) ?? FALLBACK;
}

/**
 * เหมือน `getStatusIcon` แต่คืน `undefined` เมื่อไม่รู้จักคีย์นั้น — ใช้กับที่ที่
 * ยังไม่รู้ว่าค่าที่ได้มาเป็นสถานะ/ชนิดใบหรือไม่ (ตัวกรองมีทั้ง field ที่เป็นสถานะ
 * และ field อย่างผู้ขาย/แผนก ซึ่งไม่ควรมีไอคอนโผล่มา)
 *
 * @param key - ค่า status หรือ doc type ดิบ
 * @returns ไอคอนกับสี หรือ `undefined` ถ้าไม่อยู่ในตารางทั้งสองชุด
 */
export function lookupIcon(key: string) {
  return STATUS_ICON[key] ?? TYPE_ICON[key];
}

interface StatusIconLabelProps {
  readonly status: string;
  readonly label: string;
  readonly className?: string;
}

/**
 * สถานะแบบ **ไอคอน + ป้ายตัวใหญ่ ไม่มีกรอบ chip**
 *
 * ต่างจาก `StatusDotBadge` ตรงที่ไม่มีพื้น `bg-muted` ล้อม — ตารางสิบแถวจึงไม่กลาย
 * เป็นก้อนเทาสิบก้อน และแยกสถานะได้จาก **รูปทรงของไอคอน** ไม่ใช่สีอย่างเดียว
 * (จุดสีล้วนพึ่งสี 100% คนแยกสีไม่ออกอ่านไม่ได้ถ้าไม่อ่านตัวหนังสือ)
 *
 * สีอยู่ที่ไอคอนจุดเดียวตาม DESIGN.md ("avoid neon") ส่วนป้ายเป็นสีกลางเสมอ
 *
 * @param props.status - ค่า status ดิบ ใช้เลือกไอคอน/สี
 * @param props.label - ป้ายที่แสดง (มาจาก `createStatusConfig` ซึ่ง uppercase ให้แล้ว)
 * @returns React element ของสถานะ
 * @example
 * <StatusIconLabel status={pr.pr_status} label={config.label} />
 */
export function StatusIconLabel({
  status,
  label,
  className,
}: StatusIconLabelProps) {
  const { icon: Icon, color } = getStatusIcon(status);

  return (
    <span
      // `data-slot` ไม่ใช่ของประดับ — กล่อง clamp ของ DataGrid ยกเว้นลูกที่มี
      // attribute นี้ (ดู data-grid-table.tsx) ถ้าไม่มี span ตัวนี้จะโดนเปลี่ยนเป็น
      // -webkit-box แล้วไอคอนกับป้ายแยกกันคนละบรรทัด
      data-slot="status"
      className={cn(
        "text-foreground text-micro inline-flex items-center gap-1.5 tracking-wide whitespace-nowrap",
        className,
      )}
    >
      <Icon
        className="size-3.5 shrink-0"
        style={{ color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
