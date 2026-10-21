import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { cn } from "@/lib/utils";
import { isSentBack } from "@/constant/last-action";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { AuditEntry } from "@/types/audit";
import type { LastAction } from "@/types/last-action";

export function ListCardSkeleton({
  rows = 5,
  hasFooter = true,
}: {
  readonly rows?: number;
  readonly hasFooter?: boolean;
}) {
  return (
    <div className="bg-card animate-pulse overflow-hidden rounded-xl border">
      <div className="flex items-start justify-between gap-2 px-3.5 py-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <div className="border-t" />
      <div className="space-y-2 px-3.5 py-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={`row-${i}`}
            className="flex items-center justify-between gap-3"
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {hasFooter && (
        <>
          <div className="border-t" />
          <div className="flex items-center justify-end px-2 py-1.5">
            <Skeleton className="size-6" />
          </div>
        </>
      )}
    </div>
  );
}

interface ListCardProps {
  readonly title: ReactNode;
  readonly badge?: ReactNode;
  readonly onOpen: () => void;
  /**
   * ส่งมาแล้วได้ปุ่มลบมาตรฐานท้าย footer; ไม่ส่ง = ลบไม่ได้
   *
   * สิทธิ์ถูกเช็คให้ในนี้แล้วด้วย `useDeleteGate()` — ผู้เรียกส่ง handler ดิบมาได้เลย
   * ไม่ต้องห่อ guard เอง (ไม่มีสิทธิ์ = ไม่ถูกเรียก เด้ง dialog แทน)
   */
  readonly onDelete?: () => void;
  /** เหตุผลที่การ์ดนี้ลบไม่ได้ (ปุ่มลบปิด + title) — กติกาเดียวกับ `DataGridRowActions` */
  readonly deleteDisabledTitle?: string;
  /** tooltip/aria-label ของปุ่มลบแทน `common.delete` — ไม่ส่ง = เดิม */
  readonly deleteLabel?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

/**
 * แถวข้อมูล label/value ในการ์ดรายการ — label ชิดซ้าย ค่าชิดขวา
 *
 * ค่าตัดบรรทัดได้ (ไม่ truncate) เพราะข้อมูลในการ์ดต้องครบเท่าคอลัมน์ในตาราง
 */
export function ListCardRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0 text-end font-medium break-words">{children}</div>
    </div>
  );
}

/**
 * สามแถวท้ายการ์ด: วันที่สร้าง · ผู้สร้าง · วันที่แก้ล่าสุด
 *
 * ทุกโมดูลปิดท้ายการ์ดด้วยชุดนี้เหมือนกันหมด จึงเป็น component เดียวไม่ใช่ children
 * (ต่างจากแถวข้อมูลอื่นที่รูปแบบค่าเป็นของใครของมัน) — อ่าน `dateTimeFormat` ของ BU
 * กับ label เอง ผู้เรียกส่งมาแค่ `audit`
 *
 * @param audit - `item.audit` ของแถวนั้น (ไม่มีข้อมูล = ไม่ render อะไรเลย)
 * @example
 * <ListCard title={item.name} onOpen={…}>
 *   <ListCardRow label={tfl("code")}>{item.code}</ListCardRow>
 *   <ListCardAuditRows audit={item.audit} />
 * </ListCard>
 */
export function ListCardAuditRows({
  audit,
}: {
  readonly audit?: { created?: AuditEntry; updated?: AuditEntry };
}) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  return (
    <>
      {audit?.created?.at && (
        <ListCardRow label={tfl("created")}>
          <span className="tabular-nums">
            {formatDate(audit.created.at, dateTimeFormat)}
          </span>
        </ListCardRow>
      )}
      {audit?.created?.name && (
        <ListCardRow label={tfl("by")}>{audit.created.name}</ListCardRow>
      )}
      {audit?.updated?.at && (
        <ListCardRow label={tfl("updated")}>
          <span className="tabular-nums">
            {formatDate(audit.updated.at, dateTimeFormat)}
          </span>
        </ListCardRow>
      )}
    </>
  );
}

/**
 * แถว **สถานะ** หัวเนื้อการ์ด
 *
 * เดิมสถานะอยู่ในช่อง `badge` มุมขวาบนของหัวการ์ด ซึ่งทำให้มันเป็นข้อมูลชิ้นเดียว
 * ในการ์ดที่ไม่มี label กำกับ คนต้องเดาเอาเองว่าคำที่เห็นคือสถานะ — พอย้ายลงมา
 * เป็นแถวเหมือนข้อมูลอื่น มันอ่านคู่กับ label ได้ตรง ๆ และการ์ดทุกใบมีโครงเดียวกัน
 *
 * @param status - ค่า status ดิบ (ไม่มี = ไม่ render เช่น PO ที่ยังไม่มีสถานะ)
 * @param label - ป้ายสถานะที่แสดง (มาจาก config ของโมดูลเอง)
 * @param className - class เสริมของโมดูลที่ตกลงกันแล้วว่าสถานะไม่ต้องมีสี
 */
export function ListCardStatusRow({
  status,
  label,
  className,
}: {
  readonly status?: string | null;
  readonly label?: string | null;
  readonly className?: string;
}) {
  const tfl = useTranslations("field");

  if (!status || !label) return null;

  return (
    <ListCardRow label={tfl("status")}>
      <StatusIconLabel
        status={status}
        label={label}
        // ป้ายของบางโมดูลมาจาก i18n ตรง ๆ ไม่ได้ผ่าน createStatusConfig ที่
        // uppercase ให้ — บังคับที่นี่ทีเดียวจะได้ไม่ต้องจำเป็นราย ๆ ไป
        className={cn("uppercase", className)}
      />
    </ListCardRow>
  );
}

/**
 * แถว **สถานะ** ของข้อมูลตั้งต้น (เปิด/ปิดใช้งาน)
 *
 * ย้ายลงมาจากช่อง `badge` หัวการ์ดด้วยเหตุผลเดียวกับสถานะเอกสาร — ของที่ลอยอยู่
 * มุมขวาบนโดยไม่มี label กำกับ คนต้องเดาเองว่ามันคืออะไร
 *
 * ยังเป็นชิปจุดสี (`StatusBadge`) ไม่ใช่ไอคอน+ข้อความแบบเอกสาร โดยตั้งใจ:
 * เปิด/ปิดใช้งานมีแค่สองค่าที่ตรงข้ามกัน ไม่ใช่ความคืบหน้าที่ไล่เป็นลำดับ จึงไม่มี
 * รูปทรงให้แยกด้วยไอคอน — ต่างจากสถานะเอกสารที่มีเจ็ดแปดค่าและคนแยกด้วยรูปไอคอน
 *
 * @param active - `item.is_active` ของรายการนั้น
 */
export function ListCardActiveRow({ active }: { readonly active: boolean }) {
  const tfl = useTranslations("field");

  return (
    <ListCardRow label={tfl("status")}>
      <StatusBadge active={active} />
    </ListCardRow>
  );
}

/**
 * แถว **ส่งกลับ** — เอกสารใบนี้ถูกตีกลับให้กลับไปแก้อยู่หรือไม่
 *
 * **แถวนี้โผล่เสมอเมื่อ render** ไม่ถูกตีกลับก็ขึ้นขีด ไม่ใช่หายไปทั้งแถว —
 * การ์ดในกริดเดียวกันจึงมีจำนวนแถวเท่ากันทุกใบ ตาไล่ลงตรง ๆ ได้โดยไม่ต้องนับใหม่
 * ทุกใบ (แถวที่หายไปบ้างโผล่บ้างทำให้ข้อมูลบรรทัดเดียวกันของสองใบอยู่คนละระดับ)
 *
 * ให้ render เฉพาะโมดูลที่**มีเส้นทางตีกลับจริง** คือ PR / PO / SR เท่านั้น —
 * GRN/CN/IA ไม่มี `buildReviewWorkflow` ฝั่ง backend จึงไม่มีแถวนี้เลย ไม่ใช่มีแล้ว
 * ขึ้นขีดตลอดกาล (ดู `constant/last-action.ts`)
 *
 * @param lastAction - `item.last_action` จาก list/detail endpoint
 */
export function ListCardSendBackRow({
  lastAction,
}: {
  readonly lastAction?: LastAction | null;
}) {
  const tc = useTranslations("common");

  return (
    <ListCardRow label={tc("sendBack")}>
      {isSentBack(lastAction) ? (
        <StatusIconLabel
          status="send_back"
          label={tc("sendBack").toUpperCase()}
        />
      ) : (
        "—"
      )}
    </ListCardRow>
  );
}

/**
 * การ์ด 1 รายการในหน้า list (โหมด grid/mobile) — โครงกลางของ PR/SR/IA
 *
 * ตัวนี้ถือเฉพาะ "เปลือก" ที่ทุกโมดูลเหมือนกันและเป็นที่ที่พลาดกันซ้ำ ๆ:
 * - chrome ของการ์ด + `role="button"`/tabIndex/Enter-Space และ guard
 *   `closest("button")` (กดปุ่มใน footer แล้วไม่เด้งเข้าหน้ารายละเอียด)
 * - header: title `min-w-0 truncate` + badge ชิดขวา — ฝั่งซ้ายยุบเองเวลาการ์ด
 *   แคบ badge จึงไม่ทะลุขอบ (เคยเป็นบั๊กในการ์ด SR)
 * - body: `flex-1 content-start` ให้เนื้ออมที่ว่างของการ์ดที่ถูกกริดยืดสูงเท่า
 *   ใบสูงสุดในแถว ไม่งั้น footer ลอยค้างคนละระดับกันทุกใบ
 * - footer: โผล่เฉพาะเมื่อมี action จริง
 *
 * ส่วนแถวข้อมูลปล่อยเป็น children ไม่ทำเป็น prop `rows[]` เพราะค่าแต่ละแถวมี
 * รูปแบบของตัวเอง (สี/semibold/tabular-nums/สกุลเงินต่อท้าย) และมีเงื่อนไขว่า
 * จะโชว์หรือไม่ — ยัดเป็น array แล้วต้อง filter ทิ้งเอง เขียนยากกว่าเดิม
 *
 * @example
 * <ListCard title={item.sr_no} badge={<Badge …/>} onOpen={…} onDelete={…}>
 *   <ListCardRow label={tfl("date")}>{formatDate(item.sr_date, dateFormat)}</ListCardRow>
 * </ListCard>
 */
export function ListCard({
  title,
  badge,
  onOpen,
  onDelete,
  deleteDisabledTitle,
  deleteLabel,
  actions,
  children,
}: ListCardProps) {
  const tc = useTranslations("common");
  const { deleteDenied, deletePermission, writeDisabled, writeDisabledTitle } =
    useDeleteGate();

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    onOpen();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  const hasFooter = !!actions || !!onDelete;
  const deleteDisabled = writeDisabled || !!deleteDisabledTitle;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="hover:border-primary/40 focus-visible:ring-ring cursor-pointer gap-0 overflow-hidden py-0 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <CardHeader className="gap-0 px-3.5 py-3">
        {/* min-w-0 ต้องมีทั้งตัวนี้และตัว title — CardHeader เป็น grid ที่คอลัมน์
            กว้างตาม min-content ของลูก ถ้าแถวนี้ไม่ยอมยุบ ชื่อยาว ๆ จะดันทั้งแถว
            กว้างเกินการ์ด (badge ถูกเบียดหลุดไปขวา) แล้ว truncate ของ title
            ก็ไม่มีโอกาสทำงานเลย */}
        <div className="flex min-w-0 items-start justify-between gap-2">
          {/* ยาวเกินการ์ด = ตัดท้ายด้วย … (ไม่ตัดคำขึ้นบรรทัดใหม่ ไม่งั้นความสูง
              หัวการ์ดไม่เท่ากันทั้งกริด) · ชื่อที่เป็น string ใส่ title ให้ hover
              อ่านเต็มได้ เพราะไม่มีทางอื่นให้เห็นส่วนที่ถูกตัด */}
          <CardTitle
            className="min-w-0 truncate text-sm"
            title={typeof title === "string" ? title : undefined}
          >
            {title}
          </CardTitle>
          {badge}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="grid flex-1 content-start gap-1.5 px-3.5 py-3 text-xs">
        {children}
      </CardContent>

      {hasFooter && (
        <>
          <Separator />
          <CardFooter className="justify-end gap-1.5 px-2 py-1.5">
            {actions}
            {onDelete && (
              /* license มาก่อน permission เสมอ — สัญญาหมดอายุปิดปุ่มจริง ส่วนไม่มีสิทธิ์
                 ยังกดได้แต่ไปจบที่ dialog ไม่ใช่กล่องยืนยันลบ (กติกาเดียวกับ
                 DataGridRowActions ของแถวในตาราง จะได้ไม่คุมคนละแบบในหน้าเดียวกัน) ·
                 ปุ่มไอคอน ghost สีจาง แดงเฉพาะตอนชี้ — การลบเป็นเรื่องนาน ๆ ครั้ง
                 เดิมปุ่มแดงเต็มทุกการ์ดกลายเป็นสิ่งเด่นที่สุดในกริด */
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={deleteDisabled}
                title={
                  writeDisabled
                    ? writeDisabledTitle
                    : (deleteDisabledTitle ?? deleteLabel ?? tc("delete"))
                }
                aria-label={deleteLabel ?? tc("delete")}
                aria-disabled={
                  !deleteDisabled && deleteDenied ? true : undefined
                }
                className={cn(
                  "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                  deleteDenied && "opacity-50",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (deleteDenied) {
                    dispatchPermissionDenied(deletePermission);
                    return;
                  }
                  onDelete();
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </CardFooter>
        </>
      )}
    </Card>
  );
}
