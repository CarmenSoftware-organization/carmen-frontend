import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { FormToolbar } from "@/components/share/form-toolbar";
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import {
  DocAuditButton,
  DocAuditLine,
} from "@/components/share/doc-audit-line";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import type { Audit } from "@/types/audit";

import type { FormMode } from "@/types/form";
import type { RecipeCategoryFormValues } from "./recipe-category-form-schema";

interface RecipeCategoryToolbarProps {
  readonly form: UseFormReturn<RecipeCategoryFormValues>;
  readonly mode: FormMode;
  readonly isPending: boolean;
  readonly isDeleting: boolean;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onDelete?: () => void;
  /**
   * id ของรายการที่บันทึกไว้แล้ว — เปิดปุ่ม Activity
   *
   * toolbar เห็นแต่ค่าในฟอร์ม ไม่เห็นตัว record จึงต้องรับ id มาจากฟอร์มแม่
   * (ไม่ส่ง = โหมด add ที่ยังไม่มีประวัติให้ดู)
   */
  readonly activityId?: string;
  /** เปิด sheet comment + ไฟล์แนบ (ไม่ส่ง = โหมด add ที่ยังไม่มี record ให้ comment) */
  readonly onComment?: () => void;
  /** ช่อง General — วางเป็น ribbon ของการ์ดหัว (ทรงหัวเอกสาร PR) */
  readonly generalFields: ReactNode;
  /** สถานะของ record ที่บันทึกไว้ (ไม่ส่ง = โหมด add ไม่มีป้ายสถานะ) */
  readonly isActive?: boolean;
  readonly audit?: Audit;
  readonly docVersion?: number;
}

export function RecipeCategoryToolbar({
  form,
  mode,
  isPending,
  isDeleting,
  onBack,
  onEdit,
  onCancel,
  onDelete,
  activityId,
  onComment,
  generalFields,
  isActive,
  audit,
  docVersion,
}: RecipeCategoryToolbarProps) {
  const tr = useTranslations("operationPlan.recipeCategory");
  const ts = useTranslations("status");

  const code = useWatch({ control: form.control, name: "code" });
  const name = useWatch({ control: form.control, name: "name" });

  const isAdd = mode === "add";
  const isView = mode === "view";
  const status = isActive ? "active" : "inactive";

  const codePill = (
    <span
      className={cn(
        "text-micro-legal inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tracking-wider uppercase",
        code
          ? "bg-foreground text-background"
          : "text-muted-foreground border border-dashed",
      )}
    >
      {code && (
        <span
          className="bg-background/70 size-1 rounded-full"
          aria-hidden="true"
        />
      )}
      {code || tr("noCode")}
    </span>
  );

  // หัวอยู่ในการ์ดมีพื้น ทรงเดียวกับหัวเอกสาร PR: ชื่อ + รหัส + สถานะ + ปุ่ม · ช่อง General
  // เป็น ribbon + ตาราง audit ชิดขวาล่าง (โหมดดู) — ช่อง General อยู่นอก <form> (แบบ PR)
  // RHF ยังเก็บค่าครบ แค่กด Enter ในช่องหัวไม่ submit
  return (
    <div className={DOC_HEADER_CARD}>
      <FormToolbar
        inlineBack
        mode={mode}
        formId="recipe-category-form"
        isPending={isPending}
        title={isAdd ? tr("add") : name || tr("untitledCategory")}
        badges={
          <>
            {codePill}
            {isActive !== undefined && (
              <StatusChip status={status} label={ts(status)} />
            )}
            {/* มือถือ: ตาราง audit เต็มซ่อนอยู่ เหลือไอคอนข้างสถานะ */}
            {isView && (
              <DocAuditButton
                audit={audit}
                docVersion={docVersion}
                className="-my-1 sm:hidden"
              />
            )}
          </>
        }
        onBack={onBack}
        onCancel={onCancel}
        onEdit={onEdit}
        onDelete={onDelete}
        deleteIsPending={isDeleting}
        onComment={onComment}
        activity={
          activityId ? { id: activityId, label: code || name } : undefined
        }
        // ml-4 หักล้าง -ml-4 ของ DocFormHeader (เหมือนหัว PR) · ตาราง audit เฉพาะโหมดดู
        ribbon={
          isView ? (
            <div className="ml-4 flex min-w-0 flex-1 flex-wrap items-end gap-x-5 gap-y-3">
              <div className="min-w-0 flex-1 basis-72">{generalFields}</div>
              <DocAuditLine
                audit={audit}
                docVersion={docVersion}
                className="ms-auto hidden sm:table"
              />
            </div>
          ) : (
            <div className="ml-4 min-w-0 flex-1">{generalFields}</div>
          )
        }
      />
    </div>
  );
}
