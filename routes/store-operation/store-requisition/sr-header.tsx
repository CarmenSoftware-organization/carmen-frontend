import { useState } from "react";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { Building2, CalendarDays, Save, User } from "lucide-react";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { useCreatableWorkflows } from "@/hooks/use-workflow";
import { WORKFLOW_TYPE } from "@/types/workflows";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocActionsMenu } from "@/components/share/doc-actions-menu";
import { useStoreRequisitionComments } from "./use-sr";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WorkflowTrack } from "@/components/share/workflow-track";
import { WorkflowStepButton } from "@/components/share/workflow-step-button";
import { cn } from "@/lib/utils";
import { WorkflowHistoryTimeline } from "@/components/share/workflow-history-timeline";
import { SR_WORKFLOW_ACTION_CONFIG } from "@/constant/store-requisition";
import { FormToolbar } from "@/components/share/form-toolbar";
import { formatDate } from "@/lib/date-utils";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import type { FormMode } from "@/types/form";
import { STAGE_ROLE } from "@/types/stage-role";
import type {
  StoreRequisition,
  StoreRequisitionType,
} from "@/types/store-requisition";

interface SrHeaderProps {
  readonly storeRequisition?: StoreRequisition;
  readonly srType?: StoreRequisitionType;
  readonly mode: FormMode;
  readonly isPending: boolean;
  readonly hasDepartment: boolean;
  readonly isDeletePending: boolean;
  readonly srDate?: string;
  readonly dateFormat: string;
  readonly requesterName: string;
  readonly departmentName: string;
  readonly departmentCode: string;
  readonly isLoading?: boolean;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
  readonly onComment?: () => void;
}

export function SrHeader({
  storeRequisition,
  srType,
  mode,
  isPending,
  hasDepartment,
  isDeletePending,
  srDate,
  dateFormat,
  requesterName,
  departmentName,
  departmentCode,
  isLoading,
  onBack,
  onEdit,
  onCancel,
  onDelete,
  onComment,
}: SrHeaderProps) {
  const t = useTranslations("storeOperation.storeRequisition");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const tfl = useTranslations("field");
  const tf = useTranslations("form");
  const { total: commentCount } = useStoreRequisitionComments(
    storeRequisition?.id,
  );

  const isView = mode === "view";
  const isAdd = mode === "add";
  const docStatus = storeRequisition?.doc_status;
  // draft/add ยังไม่เข้า workflow — ซ่อน workflow step (เหมือน PR)
  const isDraft = !docStatus || docStatus === "draft";

  const workflowHistory = storeRequisition?.workflow_history;
  const hasHistory = !!workflowHistory && workflowHistory.length > 0;
  const [showHistory, setShowHistory] = useState(false);

  const role = storeRequisition?.role ?? STAGE_ROLE.CREATE;
  const canEdit =
    role === STAGE_ROLE.CREATE ||
    role === STAGE_ROLE.APPROVE ||
    role === STAGE_ROLE.ISSUE;

  const navigate = useNavigate();
  const { returnState } = useListReturn("/store-operation/store-requisition");
  // Duplicate = สร้างใบใหม่ — เกณฑ์เดียวกับปุ่มสร้าง: ต้องมี workflow ที่เริ่มได้
  // (แนวเดียวกับ PR) กดไม่ผ่านเด้ง dialog บอกเหตุผล ไม่ซ่อนปุ่มเงียบ ๆ
  const { canCreate: canCreateSr } = useCreatableWorkflows(WORKFLOW_TYPE.SR);
  const handleDuplicate = () => {
    if (!canCreateSr) {
      dispatchPermissionDenied(undefined, t("noCreatableWorkflow"));
      return;
    }
    navigate(
      `/store-operation/store-requisition/new?duplicate_id=${storeRequisition?.id}`,
      returnState,
    );
  };

  // แยกเป็นคนละกลุ่มกับเลขที่ใบด้วยเส้นคั่น + ระยะห่าง — เลขที่ใบคือตัวตนของ
  // เอกสาร ส่วนสถานะ/ชนิดใบ/รุ่นคือ "ตอนนี้มันอยู่ตรงไหน" คนละคำถามกัน
  const badges = (
    <div className="border-border/60 ms-1 flex items-center gap-2 border-s ps-3">
      {docStatus && (
        <StatusIconLabel
          status={docStatus}
          label={ts(docStatus)}
          // เบากว่าในตาราง: ตัวเอกของแถบนี้คือเลขที่ใบ สถานะเป็นข้อมูลประกอบ
          // เหลือสีไว้ที่ไอคอนจุดเดียวซึ่งเป็นสัญญาณที่ต้องเห็นจริง ๆ
          className="text-muted-foreground text-micro uppercase [&>svg]:size-3"
        />
      )}
      {srType && (
        <StatusIconLabel
          status={srType}
          label={srType}
          className="text-muted-foreground text-micro uppercase [&>svg]:size-3"
        />
      )}
      {isAdd && (
        <Badge variant="secondary" size="sm">
          {t("breadcrumbNew")}
        </Badge>
      )}
      {/* เลขที่ใบ · สถานะ · รุ่น = ตัวตนของเอกสาร อยู่บรรทัดเดียวกันหมด
          เพื่อคืนบรรทัด subtitle ให้แถบขั้นตอน */}
      {storeRequisition?.doc_version != null && (
        <span className="text-muted-foreground text-micro">
          {tfl("version")} {storeRequisition.doc_version}
        </span>
      )}
    </div>
  );

  const workflowHistorySheet = hasHistory ? (
    <Sheet open={showHistory} onOpenChange={setShowHistory}>
      {/* ไม่ override ความกว้าง — ใช้ค่า default ของ SheetContent
          (w-3/4 sm:max-w-sm) ให้เท่ากับ comment sheet */}
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("tabWorkflowHistory")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("tabWorkflowHistory")}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <WorkflowHistoryTimeline
            history={workflowHistory}
            statusConfig={SR_WORKFLOW_ACTION_CONFIG}
            emptyLabel={t("noWorkflowHistory")}
            requestorName={requesterName}
            createdAt={storeRequisition?.audit?.created?.at}
          />
        </div>
      </SheetContent>
    </Sheet>
  ) : null;

  // ไม่มีแผนก = กรอกใบต่อไม่ได้ ต้องเตือน แต่ไม่ต้องเปลี่ยนเป็นข้อความสีแดง
  // คนละชนิดกับช่องอื่น — ใช้ Input เหมือนกันหมดแล้วให้ aria-invalid วาดกรอบแดง
  // (กติกาเดียวกับช่องที่ยังกรอกไม่ครบทั้งแอป)
  const departmentMissing = !isLoading && !departmentName;
  const departmentValue = isLoading
    ? "—"
    : departmentName
      ? `${departmentName}${departmentCode ? ` (${departmentCode})` : ""}`
      : t("noDepartment");

  /**
   * ผู้ขอ · แผนก · วันที่ อยู่ใต้เลขที่ใบเป็นข้อความ ไม่ใช่ช่องกรอกที่จางทั้งแถว
   * (ทรงเดียวกับ PR/PO/GRN/CN) — สามค่านี้อ่านอย่างเดียว ไม่เข้า payload การทำ
   * เป็นช่อง disabled กินพื้นที่เท่าช่องที่กรอกได้จริงและชวนให้เข้าใจผิดว่าแก้ได้
   *
   * วันที่ไม่เปิดให้เลือกเหมือน PR — วันที่ใบเบิกคือวันที่ระบบบันทึก ไม่ใช่ค่าที่
   * ผู้เบิกกรอกเอง · แผนกที่ยังไม่ได้ตั้งยังต้องสะดุดตา จึงย้อมสีเตือนไว้เหมือนเดิม
   */
  const docMeta = (
    <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      <span className="flex items-center gap-1">
        <User className="size-3 shrink-0" aria-hidden="true" />
        {isLoading ? "—" : requesterName || "—"}
      </span>
      <span
        className={cn(
          "flex items-center gap-1",
          departmentMissing && "text-warning-ink",
        )}
      >
        <Building2 className="size-3 shrink-0" aria-hidden="true" />
        {departmentValue}
      </span>
      {srDate && (
        <span className="flex items-center gap-1">
          <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
          {formatDate(srDate, dateFormat)}
        </span>
      )}
    </span>
  );

  // workflow stepper ใน header (เหมือน PR) — แสดงเส้นทาง prev → current → next
  const workflowStepEl =
    !isDraft && storeRequisition?.workflow_current_stage ? (
      <WorkflowTrack
        previousStage={storeRequisition.workflow_previous_stage}
        currentStage={storeRequisition.workflow_current_stage}
        nextStage={
          docStatus === "completed" ||
          docStatus === "cancelled" ||
          docStatus === "voided"
            ? undefined
            : storeRequisition.workflow_next_stage
        }
        terminalState={docStatus === "voided" ? "voided" : undefined}
      />
    ) : undefined;

  const workflowStep = workflowStepEl ? (
    <WorkflowStepButton
      onShowHistory={hasHistory ? () => setShowHistory(true) : undefined}
    >
      {workflowStepEl}
    </WorkflowStepButton>
  ) : undefined;

  return (
    <>
      <FormToolbar
        mode={mode}
        formId="store-requisition-form"
        isPending={isPending}
        title={storeRequisition?.sr_no ?? t("title")}
        subtitle={
          <span className="flex flex-col gap-1">
            {docMeta}
            {workflowStep}
          </span>
        }
        badges={badges}
        onBack={onBack}
        onCancel={onCancel}
        // แก้ได้เฉพาะ stage role ที่กรอกใบได้ (create / approve / issue)
        onEdit={canEdit ? onEdit : undefined}
        // ลบได้เฉพาะตอนแก้ — หน้าดูเป็นที่ทำงาน workflow
        onDelete={!isView && storeRequisition ? onDelete : undefined}
        deleteIsPending={isDeletePending}
        // เดิมป้าย Save ทุกโหมด — ไม่ให้โหมด add กลายเป็น "Create"
        submitLabel={tc("save")}
        pendingLabel={tf("saving")}
        // ไม่มีแผนก = บันทึกไม่ได้ ปิดปุ่มพร้อมเหตุผล — มีแผนกแล้วใช้ปุ่มมาตรฐาน
        // (ผ่านด่าน license ของ toolbar)
        submitSlot={
          hasDepartment ? undefined : (
            <Button type="button" size="sm" disabled title={t("noDepartment")}>
              <Save aria-hidden="true" />
              {tc("save")}
            </Button>
          )
        }
      >
        {/* Duplicate/Print เฉพาะ view (ตอน edit ค่าบนจออาจยังไม่ save) ·
            comment / activity ยุบอยู่ในเมนู ⋯ — ไม่ส่ง activity ให้ toolbar ซ้ำ */}
        {storeRequisition && (
          <DocActionsMenu
            onDuplicate={isView ? handleDuplicate : undefined}
            onComment={onComment}
            commentCount={commentCount}
            activity={{
              id: storeRequisition.id,
              label: storeRequisition.sr_no,
            }}
            print={
              isView && storeRequisition.id
                ? {
                    documentType: "SR",
                    documentId: storeRequisition.id,
                    filters: storeRequisition.sr_no
                      ? { DocumentNo: storeRequisition.sr_no }
                      : undefined,
                  }
                : undefined
            }
          />
        )}
      </FormToolbar>
      {workflowHistorySheet}
    </>
  );
}
