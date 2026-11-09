import { type ReactNode } from "react";
import { Clock, Check, X, Eye, type LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * ไอคอนในวงกลมพื้นสีอ่อน + ขอบ + ไอคอนสี ink — สีจาก semantic token ใน globals.css
 *
 * เดิมเป็นพื้นทึบ + ไอคอนดำ: บน `--info` (น้ำเงินกลาง) ไอคอนดำแทบหายไป จุดทั้งเม็ด
 * อ่านเป็นก้อนสีเดียว แยกนาฬิกา/ถูก/กากบาทไม่ออก · `*-ink` ถูกจูนให้ผ่าน AA บน
 * พื้นสว่าง (มีชุดของ .dark แยก) จึงอ่านออกทั้งสองธีม ส่วน destructive ไม่มี ink
 * แยก ตัวมันเองเข้มพอแล้ว
 */
const STATUS_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  pending: { icon: Clock, className: "bg-info/15 text-info-ink ring-info/50" },
  approved: {
    icon: Check,
    className: "bg-success/15 text-success-ink ring-success/50",
  },
  rejected: {
    icon: X,
    className: "bg-destructive/15 text-destructive ring-destructive/50",
  },
  review: {
    icon: Eye,
    className: "bg-warning/15 text-warning-ink ring-warning/50",
  },
};

/**
 * สถานะรายการในตารางเอกสาร — จุดกลมมีไอคอน ชื่อสถานะอยู่ใน tooltip
 *
 * ใช้ร่วมกันระหว่าง PR กับ PO ซึ่งมีชุดสถานะเดียวกัน (pending/approved/
 * rejected/review) · เป็นจุดไม่ใช่ badge ข้อความ เพราะคอลัมน์นี้อยู่ในแถวที่
 * หนาแน่นและถูกกวาดตาผ่านเป็นสิบ ๆ แถว — ป้ายข้อความยาวกินที่และดังกว่าตัวเลข
 * ที่คนกำลังหาอยู่ ส่วนชื่อเต็มยังอ่านได้เมื่อต้องการจริง ๆ
 *
 * @param status - สถานะที่ normalize แล้ว (pending/approved/rejected/review)
 * @param label - ชื่อสถานะสำหรับ tooltip และ aria-label
 * @param tooltipExtra - ปุ่มเสริมใน tooltip (เช่นปุ่มล้างสถานะของ PR)
 */
export function ItemStatusDot({
  status,
  label,
  tooltipExtra,
}: {
  readonly status: string;
  readonly label: string;
  readonly tooltipExtra?: ReactNode;
}) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  const Icon = style.icon;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
              style.className,
            )}
            aria-label={label}
          >
            <Icon className="size-2.5" strokeWidth={2.75} aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          <span>{label}</span>
          {tooltipExtra}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
