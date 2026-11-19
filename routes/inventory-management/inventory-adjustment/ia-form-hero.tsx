import type { ReactNode } from "react";
import { type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormToolbar } from "@/components/share/form-toolbar";
import { useFormPrimaryClaimed } from "@/components/share/form-primary-action";
import { DocActions } from "@/components/share/doc-actions";
import {
  DocAuditButton,
  DocAuditLine,
} from "@/components/share/doc-audit-line";
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { IA_TYPE_CONFIG } from "@/constant/inventory-adjustment";
import type {
  InventoryAdjustment,
  InventoryAdjustmentType,
} from "@/types/inventory-adjustment";
import type { FormMode } from "@/types/form";
import type { AdjFormValues } from "./ia-form-schema";
import { stockInCommentCrud, stockOutCommentCrud } from "./use-ia-comments";

interface IaFormHeroProps {
  readonly adjustmentType: InventoryAdjustmentType;
  readonly inventoryAdjustment?: InventoryAdjustment;
  readonly form: UseFormReturn<AdjFormValues>;
  readonly typeLabel: string;
  readonly mode: FormMode;
  readonly isReadOnly: boolean;
  readonly isPending: boolean;
  readonly deleteIsPending: boolean;
  readonly formId: string;
  readonly onBack: () => void;
  readonly onCancel: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onComment?: () => void;
  /** ช่องข้อมูลหัวใบ — อยู่ในการ์ดเดียวกับหัวเอกสาร (ส่งต่อ FormToolbar.ribbon) */
  readonly ribbon?: ReactNode;
}

export function IaFormHero({
  adjustmentType,
  inventoryAdjustment,
  form,
  typeLabel,
  mode,
  isReadOnly,
  isPending,
  deleteIsPending,
  formId,
  onBack,
  onCancel,
  onEdit,
  onDelete,
  onComment,
  ribbon,
}: IaFormHeroProps) {
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const isView = mode === "view";
  const docNo = inventoryAdjustment?.si_no ?? inventoryAdjustment?.so_no ?? "";
  const canDelete = !!inventoryAdjustment && !isReadOnly;
  const canPrint = isView && !!inventoryAdjustment?.id;
  // stock-in/stock-out คนละตาราง comment — เรียกทั้งคู่ (กฎของ hook) แต่เปิดเฉพาะชนิดของหน้า
  const { total: stockInComments } = stockInCommentCrud.useComments(
    adjustmentType === "stock-in" ? inventoryAdjustment?.id : undefined,
  );
  const { total: stockOutComments } = stockOutCommentCrud.useComments(
    adjustmentType === "stock-out" ? inventoryAdjustment?.id : undefined,
  );
  const commentCount =
    adjustmentType === "stock-in" ? stockInComments : stockOutComments;

  const saveAsDraft = () => form.setValue("doc_status", "draft");

  // เบากว่าในตาราง: ตัวเอกของแถบนี้คือเลขที่ใบ สถานะเป็นข้อมูลประกอบ เหลือสีไว้ที่
  // ไอคอนจุดเดียวซึ่งเป็นสัญญาณที่ต้องเห็นจริง ๆ (ทรงเดียวกับ PR/PO/GRN/CN/SR)
  // ป้ายทิศ (รับเข้า/จ่ายออก) นำหน้า — เลขที่ SI/SO บอกทิศได้เฉพาะคนที่จำ prefix ได้
  const badges = inventoryAdjustment ? (
    // หัวแคบ (มือถือ) กลุ่มนี้มักตกไปบรรทัดใต้เลขที่ใบ เส้นคั่นจะค้างหัวบรรทัด จึงเอาออก
    <div className="border-border/60 ms-1 flex items-center gap-2 border-s ps-3 @max-md/doc-header:ms-0 @max-md/doc-header:border-s-0 @max-md/doc-header:ps-0">
      <Badge size="sm" className={IA_TYPE_CONFIG[adjustmentType]?.className}>
        {typeLabel}
      </Badge>
      <StatusChip
        status={inventoryAdjustment.doc_status}
        // แปลตามภาษา — ป้ายใน IA_STATUS_CONFIG เป็นอังกฤษเสมอ
        label={ts(inventoryAdjustment.doc_status)}
      />
    </div>
  ) : undefined;

  // Save ตั้ง doc_status=draft ตอนคลิกก่อน submit จึงเป็น submitSlot (ไม่ผ่าน gate
  // license/permission ของ FormToolbar — Edit ยัง gate; โหมด add ตกที่ backend)
  // submitSlot ไม่ผ่านสีของ FormToolbar — ลดเป็น outline เองเมื่อ footer มี Commit
  const saveVariant = useFormPrimaryClaimed() ? "outline" : "default";
  const submitSlot = (
    <Button
      type="submit"
      variant={saveVariant}
      size="sm"
      form={formId}
      disabled={isPending}
      onClick={saveAsDraft}
    >
      <Save />
      {tc("save")}
    </Button>
  );

  // หัวเอกสารอยู่ในการ์ดมีพื้นทรงเดียวกับ PR/PO/GRN/CN/SR — ช่องหัวใบอยู่ในการ์ดเดียวกัน
  // ตาราง audit (สร้างโดย/แก้ไขล่าสุด/rev.) ชิดขวาล่างเฉพาะโหมดดู · มือถือซ่อน
  return (
    <div className={DOC_HEADER_CARD}>
      <FormToolbar
        inlineBack
        mode={mode}
        formId={formId}
        isPending={isPending}
        title={docNo || typeLabel}
        badges={badges}
        ribbon={
          ribbon ? (
            <div className="ml-4 flex min-w-0 flex-1 flex-wrap items-end gap-x-5 gap-y-3">
              <div className="min-w-0 flex-1 basis-72">{ribbon}</div>
              {isView && (
                <DocAuditLine
                  audit={inventoryAdjustment?.audit}
                  docVersion={inventoryAdjustment?.doc_version}
                  className="ms-auto hidden sm:table"
                />
              )}
            </div>
          ) : undefined
        }
        submitSlot={submitSlot}
        onBack={onBack}
        onCancel={onCancel}
        onEdit={isReadOnly ? undefined : onEdit}
        onDelete={canDelete ? onDelete : undefined}
        deleteIsPending={deleteIsPending}
      >
        {/* comment / activity / print อยู่ใน DocActions (ทรงเดียวกับ PR) — ไม่ส่ง activity
          ให้ toolbar ซ้ำ · Print เฉพาะโหมดดู (ตอนแก้ค่าบนจออาจยังไม่ save) */}
        {/* มือถือ: ตาราง audit เต็มซ่อนอยู่ เหลือไอคอนในแถวปุ่ม — ถ้าวางข้างป้ายสถานะ
          กลุ่มป้ายจะตกไปบรรทัดใต้เลขที่ใบ */}
        {isView && inventoryAdjustment && (
          <DocAuditButton
            audit={inventoryAdjustment.audit}
            docVersion={inventoryAdjustment.doc_version}
            className="sm:hidden"
          />
        )}
        {inventoryAdjustment && (
          <DocActions
            onComment={onComment}
            commentCount={commentCount}
            activity={{ id: inventoryAdjustment.id, label: docNo || undefined }}
            print={
              canPrint
                ? {
                    documentType: adjustmentType === "stock-in" ? "SI" : "SO",
                    documentId: inventoryAdjustment.id,
                    filters: docNo ? { DocumentNo: docNo } : undefined,
                  }
                : undefined
            }
          />
        )}
      </FormToolbar>
    </div>
  );
}
