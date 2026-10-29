import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Copy, History, MessageSquare, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openActivity } from "@/components/share/activity-sheet-host";
import { usePrintDocument } from "@/hooks/use-print-document";
import type {
  PrintDocumentOptions,
  PrintDocumentType,
} from "@/lib/print-document";

interface DocActionsProps {
  readonly onDuplicate?: () => void;
  readonly onComment?: () => void;
  readonly commentCount?: number;
  readonly activity?: { id: string; label?: string };
  readonly print?: {
    documentType: PrintDocumentType;
    documentId?: string;
    filters?: PrintDocumentOptions["filters"];
  };
}

interface ActionButtonProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly ariaLabel?: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
}

/**
 * ปุ่มรองหนึ่งตัว — ชื่อปุ่มเห็นตั้งแต่ xl ขึ้นไป ต่ำกว่านั้นเหลือไอคอน + tooltip
 * ชื่อซ่อนด้วย sr-only ไม่ใช่ hidden เพื่อให้ยังเป็น accessible name ของปุ่ม
 */
function ActionButton({
  icon,
  label,
  ariaLabel,
  onClick,
  disabled,
  children,
}: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel}
        >
          {icon}
          <span className="max-xl:sr-only">{label}</span>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="xl:hidden">
        {ariaLabel ?? label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * action รองบนหัวเอกสาร เรียง Duplicate · Print · Comment · Activity ใช้ร่วมกัน PR/PO/GRN/CN/SR/JV
 * caller ต้องวางไว้ท้ายสุดของแถบ เพื่อให้ Comment · Activity ปิดท้ายเสมอ
 *
 * เคยยุบอยู่ในเมนู ⋯ เพราะแถบยาวเกินจอ แต่ผู้ใช้หาไม่เจอ จึงกลับมาเป็นปุ่มบนแถบ
 * แล้วแก้ความยาวด้วยการตัดชื่อปุ่มเหลือไอคอนเมื่อจอแคบกว่า xl แทน
 * ปุ่มไหนไม่ส่ง callback มาก็ไม่แสดง ไม่มีสักปุ่มก็ไม่ render อะไร
 *
 * @param props - คุณสมบัติของแถบปุ่ม
 * @param props.onDuplicate - callback สร้างใบใหม่จากใบนี้
 * @param props.onComment - callback เปิด comment sheet
 * @param props.commentCount - จำนวน comment ของเอกสาร
 * @param props.activity - id/เลขที่เอกสารสำหรับเปิด activity sheet
 * @param props.print - ชนิด/id/filters ของเอกสารที่จะพิมพ์
 * @returns ปุ่มเรียงกัน หรือ `null` เมื่อไม่มีปุ่มให้แสดง
 * @example
 * <DocActions
 *   onComment={onShowComment}
 *   commentCount={comments?.length}
 *   activity={{ id: po.id, label: po.po_no }}
 *   print={isView ? { documentType: "PO", documentId: po.id } : undefined}
 * />
 */
export function DocActions({
  onDuplicate,
  onComment,
  commentCount = 0,
  activity,
  print: printDoc,
}: DocActionsProps) {
  const tc = useTranslations("common");
  const tActivity = useTranslations("activity");
  const { print, isPrinting } = usePrintDocument();

  if (!onDuplicate && !onComment && !activity && !printDoc) return null;

  // ห่อ provider เองเหมือน field.tsx — หัวเอกสารถูก render ในเทสต์โดยไม่มี providers ของแอป
  return (
    <TooltipProvider>
      {onDuplicate && (
        <ActionButton
          icon={<Copy aria-hidden="true" />}
          label={tc("duplicate")}
          onClick={onDuplicate}
        />
      )}
      {printDoc && (
        <ActionButton
          icon={<Printer aria-hidden="true" />}
          label={tc("print")}
          disabled={isPrinting}
          onClick={() =>
            void print(printDoc.documentType, {
              documentId: printDoc.documentId,
              filters: printDoc.filters,
            })
          }
        />
      )}
      {/* Comment · Activity ปิดท้ายแถบเสมอ — ลำดับเดียวกับ FormToolbar */}
      {onComment && (
        <ActionButton
          icon={<MessageSquare aria-hidden="true" />}
          label={tc("comment")}
          ariaLabel={
            commentCount > 0 ? `${tc("comment")} (${commentCount})` : undefined
          }
          onClick={onComment}
        >
          {/* ตัวเลขอยู่นอก sr-only — จอแคบที่เหลือแต่ไอคอนก็ยังรู้ว่ามีคนคอมเมนต์ */}
          {commentCount > 0 && (
            <span
              aria-hidden="true"
              className="bg-primary/10 text-primary rounded-sm px-1 tabular-nums"
            >
              {commentCount}
            </span>
          )}
        </ActionButton>
      )}
      {activity && (
        <ActionButton
          icon={<History aria-hidden="true" />}
          label={tActivity("title")}
          onClick={() => openActivity(activity.id, activity.label)}
        />
      )}
    </TooltipProvider>
  );
}
