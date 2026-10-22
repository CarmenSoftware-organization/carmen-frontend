import { type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormToolbar } from "@/components/share/form-toolbar";
import { useFormPrimaryClaimed } from "@/components/share/form-primary-action";
import { PrintDocumentButton } from "@/components/print-document-button";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { Badge } from "@/components/ui/badge";
import {
  IA_STATUS_CONFIG,
  IA_TYPE_CONFIG,
  IA_TYPE_ICON,
} from "@/constant/inventory-adjustment";
import type {
  InventoryAdjustment,
  InventoryAdjustmentType,
} from "@/types/inventory-adjustment";
import type { FormMode } from "@/types/form";
import type { AdjFormValues } from "./ia-form-schema";

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
}: IaFormHeroProps) {
  const tc = useTranslations("common");
  const isView = mode === "view";
  const TypeIcon = IA_TYPE_ICON[adjustmentType];
  const docNo = inventoryAdjustment?.si_no ?? inventoryAdjustment?.so_no ?? "";
  const canDelete = !!inventoryAdjustment && !isReadOnly;
  const canPrint = isView && !!inventoryAdjustment?.id;

  const saveAsDraft = () => form.setValue("doc_status", "draft");

  const statusConfig = inventoryAdjustment
    ? IA_STATUS_CONFIG[inventoryAdjustment.doc_status]
    : null;

  const leading = (
    <TypeIcon
      className="text-muted-foreground size-5 shrink-0"
      aria-hidden="true"
    />
  );

  // เบากว่าในตาราง: ตัวเอกของแถบนี้คือเลขที่ใบ สถานะเป็นข้อมูลประกอบ เหลือสีไว้ที่
  // ไอคอนจุดเดียวซึ่งเป็นสัญญาณที่ต้องเห็นจริง ๆ (ทรงเดียวกับ PR/PO/GRN/CN/SR)
  // ป้ายทิศ (รับเข้า/จ่ายออก) นำหน้า — เลขที่ SI/SO บอกทิศได้เฉพาะคนที่จำ prefix ได้
  const badges =
    statusConfig && inventoryAdjustment ? (
      <div className="border-border/60 ms-1 flex items-center gap-2 border-s ps-3">
        <Badge size="sm" className={IA_TYPE_CONFIG[adjustmentType]?.className}>
          {typeLabel}
        </Badge>
        <StatusIconLabel
          status={inventoryAdjustment.doc_status}
          label={statusConfig.label}
          className="text-muted-foreground text-micro [&>svg]:size-3"
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

  return (
    <FormToolbar
      mode={mode}
      formId={formId}
      isPending={isPending}
      title={docNo || typeLabel}
      leading={leading}
      badges={badges}
      submitSlot={submitSlot}
      onBack={onBack}
      onCancel={onCancel}
      onEdit={isReadOnly ? undefined : onEdit}
      onDelete={canDelete ? onDelete : undefined}
      deleteIsPending={deleteIsPending}
      activity={
        inventoryAdjustment
          ? { id: inventoryAdjustment.id, label: docNo || undefined }
          : undefined
      }
    >
      {canPrint && (
        <PrintDocumentButton
          documentType={adjustmentType === "stock-in" ? "SI" : "SO"}
          documentId={inventoryAdjustment!.id}
        />
      )}
    </FormToolbar>
  );
}
