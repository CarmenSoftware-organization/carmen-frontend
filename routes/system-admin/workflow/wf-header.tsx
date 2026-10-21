import { useState } from "react";
import { useListReturn } from "@/hooks/use-list-return";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { WarningDialog } from "@/components/ui/warning-dialog";
import { FormToolbar } from "@/components/share/form-toolbar";
import { useDeleteWorkflow } from "./use-wf-mutations";
import { useWorkflowEditAvailability } from "./use-wf-availability";
import type { Workflow } from "@/types/workflows";
import { getWorkflowTypeLabels } from "@/constant/workflow";

interface WfHeaderProps {
  readonly workflow: Workflow;
  readonly isEditing: boolean;
  readonly isPending: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly formId: string;
}

export function WfHeader({
  workflow,
  isEditing,
  isPending,
  onEdit,
  onCancel,
  formId,
}: WfHeaderProps) {
  const { toList } = useListReturn("/system-admin/workflow");
  const deleteWorkflow = useDeleteWorkflow();
  const [showDelete, setShowDelete] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const t = useTranslations("systemAdmin.workflow");
  const tc = useTranslations("common");
  const tw = useTranslations("systemAdmin.workflow.documents");
  const tt = useTranslations("toast");

  const typeLabels = getWorkflowTypeLabels(t);
  const { data: availability } = useWorkflowEditAvailability(workflow.id);

  // จำนวนเอกสารแยกตามสถานะ — in_progress คือตัวที่ทำให้แก้โครงสร้าง workflow ไม่ได้ จึงเป็นชิปเตือน
  // พร้อมกุญแจ ผู้ใช้จะได้รู้ตั้งแต่ก่อนกด Edit ว่าติดอะไรและติดอยู่เท่าไร ส่วนถังที่เป็น 0 ไม่ต้องโชว์
  // (workflow ใหม่ที่ยังไม่มีเอกสารเลย บรรทัดนี้หายไปทั้งบรรทัด)
  const docCounts = availability?.documents;
  const quietCounts = docCounts
    ? [
        { key: "draft", label: tw("draft"), count: docCounts.draft },
        { key: "done", label: tw("done"), count: docCounts.done },
      ].filter((c) => c.count > 0)
    : [];
  const hasInProgress = (docCounts?.in_progress ?? 0) > 0;
  const docBadges =
    docCounts && (hasInProgress || quietCounts.length > 0) ? (
      <>
        <Separator orientation="vertical" className="mx-0.5 h-3.5" />
        {hasInProgress && (
          <Badge
            variant="warning-light"
            size="sm"
            className="gap-1 tabular-nums"
            title={tw("inProgressBlocksEdit")}
          >
            <Lock className="size-3" aria-hidden="true" />
            {tw("inProgress")}: {docCounts.in_progress}
          </Badge>
        )}
        {quietCounts.map((c) => (
          <span
            key={c.key}
            className="text-muted-foreground text-sm tabular-nums"
          >
            {c.label}: {c.count}
          </span>
        ))}
      </>
    ) : null;

  // status + type-label (คั่นด้วย separator) แสดงข้าง title
  const badges = !isEditing ? (
    <>
      <StatusBadge active={workflow.is_active} />
      <Separator orientation="vertical" className="mx-0.5 h-3.5" />
      <span className="text-muted-foreground text-sm">
        {typeLabels[workflow.workflow_type] ?? workflow.workflow_type}
      </span>
      {docBadges}
    </>
  ) : undefined;

  const subtitle =
    workflow.description && !isEditing ? (
      <span className="line-clamp-2">{workflow.description}</span>
    ) : undefined;

  // เข้าโหมดแก้ได้เสมอแล้ว: เอกสารที่เดินอยู่ล็อกแค่รายการ stage กับเส้นทางระหว่าง stage ส่วนชื่อ
  // ผู้อนุมัติ และรายการสินค้าบันทึกได้ตลอด การปิดทั้งปุ่มจึงกันคนออกจากงานที่ทำได้จริง — ตัวที่ยังปิด
  // อยู่คือส่วน stage ข้างในฟอร์ม ซึ่งปิดตรงจุดที่มันถูกล็อกจริง
  // ส่วนการลบยังทำไม่ได้ เพราะทำให้รายการ stage หายไปทั้งอัน เอกสารที่ค้างจะไม่มีอะไรให้เดินต่อ
  // ถ้ายังไม่รู้คำตอบ (query ยังโหลด หรือโหลดไม่สำเร็จ) ให้ผ่านไปก่อน แล้วไปตกที่การ์ดฝั่ง backend
  // แทนที่จะล็อกปุ่มเพราะอ่านสถานะไม่ได้
  const blockedFromDelete = availability?.can_delete === false;
  const handleDelete = () => {
    if (blockedFromDelete) {
      setShowBlocked(true);
      return;
    }
    setShowDelete(true);
  };

  return (
    <>
      <FormToolbar
        mode={isEditing ? "edit" : "view"}
        formId={formId}
        isPending={isPending}
        title={isEditing ? t("editWorkflow") : workflow.name}
        subtitle={subtitle}
        badges={badges}
        submitLabel={t("saveChanges")}
        onBack={() => toList()}
        onCancel={onCancel}
        onEdit={onEdit}
        onDelete={handleDelete}
        deleteIsPending={deleteWorkflow.isPending}
        activity={{ id: workflow.id, label: workflow.name }}
      />

      <WarningDialog
        open={showBlocked}
        title={tw("blockedTitle")}
        description={tw("blockedDescription", {
          count: docCounts?.in_progress ?? 0,
        })}
        confirmLabel={tc("close")}
        onConfirm={() => setShowBlocked(false)}
      />

      <DeleteDialog
        open={showDelete}
        onOpenChange={(open) =>
          !open && !deleteWorkflow.isPending && setShowDelete(false)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: workflow.name })}
        isPending={deleteWorkflow.isPending}
        onConfirm={() => {
          deleteWorkflow.mutate(workflow.id, {
            onSuccess: () => {
              setShowDelete(false);
              toast.success(tt("deleteSuccess", { entity: t("entity") }));
              toList();
            },
          });
        }}
      />
    </>
  );
}
