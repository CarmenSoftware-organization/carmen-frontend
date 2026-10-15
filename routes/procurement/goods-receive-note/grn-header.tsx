import { useTranslations } from "use-intl";
import { Building2, FileText, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocActionsMenu } from "@/components/share/doc-actions-menu";
import { useGoodsReceiveNoteComments } from "@/hooks/use-goods-receive-note";
import type { FormMode } from "@/types/form";
import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { GRN_FORM_STATUS_CONFIG } from "@/constant/goods-receive-note";
import { getGrnDocTypeLabel } from "@/constant/grn-doc-type";
import { FormToolbar } from "@/components/share/form-toolbar";

interface GrnHeaderProps {
  readonly goodsReceiveNote?: GoodsReceiveNote;
  readonly mode: FormMode;
  readonly isPending: boolean;
  readonly isCommitted: boolean;
  readonly isVoid: boolean;
  readonly deleteIsPending: boolean;
  readonly receivedByName: string;
  readonly departmentName: string;
  readonly onBack: () => void;
  readonly onEnterEdit: () => void;
  readonly onCancel: () => void;
  readonly onShowComment: () => void;
  readonly onShowDelete: () => void;
  readonly onSaveDraft: () => void;
  readonly onSave: () => void;
}

export function GrnHeader({
  goodsReceiveNote,
  mode,
  isPending,
  isCommitted,
  isVoid,
  deleteIsPending,
  receivedByName,
  departmentName,
  onBack,
  onEnterEdit,
  onCancel,
  onShowComment,
  onShowDelete,
  onSaveDraft,
  onSave,
}: GrnHeaderProps) {
  const t = useTranslations("procurement.goodsReceiveNote");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const { total: commentCount } = useGoodsReceiveNoteComments(
    goodsReceiveNote?.id,
  );

  const isView = mode === "view";
  const isEdit = mode === "edit";
  // ใบ saved/committed ยังแก้ได้ — saved แก้ได้เกือบทุกช่อง (หลังบ้านลงสต๊อกใหม่ให้),
  // committed แก้ได้เฉพาะข้อมูลใบแจ้งหนี้จนกว่า AP จะดึงไป · ช่องที่ล็อกอยู่ที่
  // GrnFormHeader ส่วนด่านจริงอยู่ที่ update() ของหลังบ้าน
  const isSaved = goodsReceiveNote?.doc_status === "saved";
  const apInvoiceNos = (goodsReceiveNote?.ap_invoices ?? []).map(
    (a) => a.doc_no,
  );
  const apLocked = isCommitted && apInvoiceNos.length > 0;
  const canEdit = !isVoid && !apLocked;
  // ใบที่ถอยกลับเป็นร่างไม่ได้ ไม่มีปุ่มเก็บร่าง
  const isPastDraft = isSaved || isCommitted;

  const statusCfg = goodsReceiveNote
    ? GRN_FORM_STATUS_CONFIG[goodsReceiveNote.doc_status]
    : null;

  // แยกเป็นคนละกลุ่มกับเลขที่ใบด้วยเส้นคั่น + ระยะห่าง — เลขที่ใบคือตัวตนของ
  // เอกสาร ส่วนสถานะ/ชนิดใบ/รุ่นคือ "ตอนนี้มันอยู่ตรงไหน" คนละคำถามกัน
  const badges = (
    <div className="border-border/60 ms-1 flex items-center gap-2 border-s ps-3">
      {statusCfg && goodsReceiveNote && (
        <StatusIconLabel
          status={goodsReceiveNote.doc_status}
          label={statusCfg.label ?? goodsReceiveNote.doc_status}
          // เบากว่าในตาราง: ตัวเอกของแถบนี้คือเลขที่ใบ สถานะเป็นข้อมูลประกอบ
          // เหลือสีไว้ที่ไอคอนจุดเดียวซึ่งเป็นสัญญาณที่ต้องเห็นจริง ๆ
          className="text-muted-foreground text-micro [&>svg]:size-3"
        />
      )}
      {goodsReceiveNote && (
        <StatusIconLabel
          status={goodsReceiveNote.doc_type}
          label={getGrnDocTypeLabel(t, goodsReceiveNote.doc_type)}
          className="text-muted-foreground text-micro [&>svg]:size-3"
        />
      )}
      {/* เลขที่ใบ · สถานะ · ชนิดใบ · รุ่น = ตัวตนของเอกสาร อยู่บรรทัดเดียวกันหมด
          (ทรงเดียวกับใบลดหนี้) — ไม่ใช่ Badge เพราะรุ่นเป็นตัวเลขอ้างอิง ไม่ใช่
          สถานะที่ต้องสะดุดตา */}
      {goodsReceiveNote?.doc_version != null && (
        <span className="text-muted-foreground text-micro">
          {tfl("version")} {goodsReceiveNote.doc_version}
        </span>
      )}
    </div>
  );

  /**
   * ผู้รับ + แผนก อยู่ใต้เลขที่ใบเป็นข้อความ ไม่ใช่ช่องกรอกที่จางทั้งแถว (ทรง
   * เดียวกับใบลดหนี้) — สองค่านี้อ่านอย่างเดียว ไม่เข้า payload การทำเป็นช่อง
   * disabled กินพื้นที่เท่าช่องที่กรอกได้จริงและชวนให้เข้าใจผิดว่าแก้ได้
   *
   * วันที่ย้ายไปเป็นช่องกรอกในฟอร์มแล้ว (ต่อจากวันที่รับของ) จึงไม่โชว์ซ้ำที่นี่
   */
  const subtitle = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      {receivedByName && (
        <span className="flex items-center gap-1">
          <User className="size-3 shrink-0" aria-hidden="true" />
          {receivedByName}
        </span>
      )}
      {departmentName && (
        <span className="flex items-center gap-1">
          <Building2 className="size-3 shrink-0" aria-hidden="true" />
          {departmentName}
        </span>
      )}
    </span>
  );

  // ใบ saved/committed ถอยกลับเป็นร่างไม่ได้ จึงไม่มีปุ่มเก็บร่าง · ปุ่มบันทึกของ
  // ใบพวกนี้ยิงแค่ PATCH ไม่ยิง /save ซ้ำ (willCallSave ใน use-grn-form-actions
  // เป็นจริงเฉพาะใบร่าง) เลยไม่ชน "Only draft GRN can be saved"
  //
  // Save ของ GRN เป็น handler (ส่งสถานะเอง) ไม่ใช่ submit ของ <form> และมี Save draft
  // นำหน้าสำหรับใบร่าง — จึงเป็น submitSlot (ไม่ผ่าน gate license เหมือนเดิม)
  const submitSlot = (
    <>
      {!isPastDraft && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onSaveDraft}
        >
          <FileText aria-hidden="true" />
          {tc("saveDraft")}
        </Button>
      )}
      <Button type="button" size="sm" disabled={isPending} onClick={onSave}>
        <Save aria-hidden="true" />
        {isEdit ? tc("save") : tc("create")}
      </Button>
    </>
  );

  return (
    <FormToolbar
      mode={mode}
      formId="grn-form"
      isPending={isPending}
      title={goodsReceiveNote?.grn_no ?? t("entity")}
      subtitle={subtitle}
      badges={badges}
      submitSlot={submitSlot}
      onBack={onBack}
      onCancel={onCancel}
      // AP ดึงใบ committed ไปแล้ว = ปุ่ม Edit ยังโชว์แต่กดไม่ได้พร้อมเหตุผล คนที่เคยแก้
      // ใบ committed ได้จะได้ไม่งงว่าทำไมใบนี้แก้ไม่ได้ (commit/void อยู่ที่ footer)
      onEdit={
        goodsReceiveNote && (canEdit || apLocked) ? onEnterEdit : undefined
      }
      writeDisabledReason={
        isView && apLocked
          ? t("editLockedByAp", { docNos: apInvoiceNos.join(", ") })
          : undefined
      }
      // หลังบ้านลบได้เฉพาะใบร่าง และลบจากโหมดแก้เท่านั้น
      onDelete={
        isEdit && goodsReceiveNote && !isPastDraft ? onShowDelete : undefined
      }
      deleteIsPending={deleteIsPending}
    >
      {/* comment / activity / print ยุบอยู่ในเมนู ⋯ — ไม่ส่ง activity ให้ toolbar ซ้ำ */}
      {goodsReceiveNote && (
        <DocActionsMenu
          onComment={onShowComment}
          commentCount={commentCount}
          activity={{
            id: goodsReceiveNote.id,
            label: goodsReceiveNote.grn_no,
          }}
          print={
            isView && goodsReceiveNote.id
              ? {
                  documentType: "GRN",
                  documentId: goodsReceiveNote.id,
                  filters: goodsReceiveNote.grn_no
                    ? { DocumentNo: goodsReceiveNote.grn_no }
                    : undefined,
                }
              : undefined
          }
        />
      )}
    </FormToolbar>
  );
}
