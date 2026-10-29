import { useTranslations } from "use-intl";
import { User } from "lucide-react";
import { DocActions } from "@/components/share/doc-actions";
import { useCreditNoteComments } from "./use-credit-note";
import type { FormMode } from "@/types/form";
import type { CreditNoteDetail } from "@/types/credit-note";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { CN_STATUS_CONFIG } from "@/constant/credit-note";
import { FormToolbar } from "@/components/share/form-toolbar";

interface CnHeaderProps {
  readonly creditNote?: CreditNoteDetail;
  readonly mode: FormMode;
  readonly isPending: boolean;
  readonly deleteIsPending: boolean;
  readonly isLocked: boolean;
  readonly createdByName: string;
  readonly onBack: () => void;
  readonly onEnterEdit: () => void;
  readonly onCancel: () => void;
  readonly onShowDelete: () => void;
  readonly onShowComment: () => void;
}

export function CnHeader({
  creditNote,
  mode,
  isPending,
  deleteIsPending,
  isLocked,
  createdByName,
  onBack,
  onEnterEdit,
  onCancel,
  onShowDelete,
  onShowComment,
}: CnHeaderProps) {
  const t = useTranslations("procurement.creditNote");
  const tfl = useTranslations("field");
  const { total: commentCount } = useCreditNoteComments(creditNote?.id);

  const isView = mode === "view";

  const statusCfg = creditNote ? CN_STATUS_CONFIG[creditNote.doc_status] : null;

  // แยกเป็นคนละกลุ่มกับเลขที่ใบด้วยเส้นคั่น + ระยะห่าง — เลขที่ใบคือตัวตนของ
  // เอกสาร ส่วนสถานะกับรุ่นคือ "ตอนนี้มันอยู่ตรงไหน" คนละคำถามกัน
  const badges = (
    <div className="border-border/60 ms-1 flex items-center gap-2 border-s ps-3">
      {statusCfg && creditNote && (
        <StatusIconLabel
          status={creditNote.doc_status}
          label={statusCfg.label ?? creditNote.doc_status}
          // เบากว่าในตาราง: ตัวเอกของแถบนี้คือเลขที่ใบ สถานะเป็นข้อมูลประกอบ
          // เหลือสีไว้ที่ไอคอนจุดเดียวซึ่งเป็นสัญญาณที่ต้องเห็นจริง ๆ
          className="text-muted-foreground text-micro [&>svg]:size-3"
        />
      )}
      {creditNote?.doc_version != null && (
        <span className="text-muted-foreground text-micro">
          {tfl("version")} {creditNote.doc_version}
        </span>
      )}
    </div>
  );

  // ไอคอนบอกว่าอันไหนคือคนสร้าง อันไหนคือวันที่สร้าง — บรรทัดนี้ไม่มี label
  // กำกับ ถ้าปล่อยเป็นข้อความเปล่าสองก้อนคั่นด้วยจุด คนอ่านต้องเดาเอง
  // (ไอคอนขนาดเท่าตัวอักษร สีเดียวกับข้อความ ไม่ใช่ signal สีแยก)
  const subtitle = createdByName ? (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      {createdByName && (
        <span className="flex items-center gap-1">
          <User className="size-3 shrink-0" aria-hidden="true" />
          {createdByName}
        </span>
      )}
    </span>
  ) : undefined;

  return (
    <FormToolbar
      mode={mode}
      formId="cn-form"
      isPending={isPending}
      title={creditNote?.cn_no ?? t("entity")}
      subtitle={subtitle}
      badges={badges}
      onBack={onBack}
      onCancel={onCancel}
      // ส่งใบย้ายไป footer ขวาล่าง (CnFooterAction) — หัวมีแค่ Edit
      onEdit={isLocked ? undefined : onEnterEdit}
      // ลบได้เฉพาะตอนแก้ใบที่ยังไม่ล็อก — หน้าดูเป็นที่ทำงาน workflow
      onDelete={!isView && creditNote && !isLocked ? onShowDelete : undefined}
      deleteIsPending={deleteIsPending}
    >
      {/* comment / activity / print อยู่ใน DocActions — ไม่ส่ง activity ให้ toolbar ซ้ำ */}
      {creditNote && (
        <DocActions
          onComment={onShowComment}
          commentCount={commentCount}
          activity={{ id: creditNote.id, label: creditNote.cn_no }}
          print={
            isView && creditNote.id
              ? {
                  documentType: "CN",
                  documentId: creditNote.id,
                  filters: creditNote.cn_no
                    ? { DocumentNo: creditNote.cn_no }
                    : undefined,
                }
              : undefined
          }
        />
      )}
    </FormToolbar>
  );
}
