import { Building2, CalendarDays, User } from "lucide-react";
import { type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { useListReturn } from "@/hooks/use-list-return";
import { useCreatableWorkflows } from "@/hooks/use-workflow";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { DocActionsMenu } from "@/components/share/doc-actions-menu";
import { FormToolbar } from "@/components/share/form-toolbar";
import { WorkflowTrack } from "@/components/share/workflow-track";
import { WorkflowStepButton } from "@/components/share/workflow-step-button";
import { PR_STATUS, type PurchaseRequest } from "@/types/purchase-request";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { PR_STATUS_CONFIG } from "@/constant/purchase-request";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { WORKFLOW_TYPE } from "@/types/workflows";
import { STAGE_ROLE } from "@/types/stage-role";
import type { FormMode } from "@/types/form";
import { usePurchaseRequestComments } from "./use-purchase-request";

interface PrHeaderProps {
  readonly purchaseRequest?: PurchaseRequest;
  readonly mode: FormMode;
  readonly role?: string;
  readonly isPending: boolean;
  readonly isDeletePending: boolean;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
  readonly onComment: () => void;
  readonly reqName: string;
  readonly departmentName: string;
  readonly prDateDisplay: string;
  readonly workflowName?: string;
  readonly workflowField?: ReactNode;
  readonly description?: string;
  readonly descriptionField?: ReactNode;
  readonly hasHistory?: boolean;
  readonly onShowHistory?: () => void;
}

export function PrHeader({
  purchaseRequest,
  mode,
  role,
  isPending,
  isDeletePending,
  onBack,
  onEdit,
  onCancel,
  onDelete,
  onComment,
  reqName,
  departmentName,
  prDateDisplay,
  workflowName,
  workflowField,
  description,
  descriptionField,
  hasHistory,
  onShowHistory,
}: PrHeaderProps) {
  const t = useTranslations("procurement.purchaseRequest");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const tf = useTranslations("form");
  const navigate = useNavigate();
  const { returnState } = useListReturn("/procurement/purchase-request");
  const prId = purchaseRequest?.id;
  const prNo = purchaseRequest?.pr_no;
  // Duplicate = สร้างใบใหม่ — เกณฑ์เดียวกับปุ่ม Add: ต้องมี workflow ที่เริ่มได้
  // (PR ไม่มี permission .create ใน catalog) กดไม่ผ่านเด้ง dialog บอกเหตุผล
  const { canCreate: canCreatePr } = useCreatableWorkflows(WORKFLOW_TYPE.PR);
  const handleDuplicate = () => {
    if (!canCreatePr) {
      dispatchPermissionDenied(undefined, t("noCreatableWorkflow"));
      return;
    }
    navigate(
      `/procurement/purchase-request/new?duplicate_id=${prId}`,
      returnState,
    );
  };
  const { total: commentCount } = usePurchaseRequestComments(
    purchaseRequest ? prId : undefined,
  );
  const isView = mode === "view";
  const isVoided = purchaseRequest?.pr_status === PR_STATUS.VOIDED;
  const isViewOnly = role === STAGE_ROLE.VIEW_ONLY;

  const statusCfg = purchaseRequest
    ? (PR_STATUS_CONFIG[purchaseRequest.pr_status] ?? PR_STATUS_CONFIG.draft)
    : null;

  // edition ย้ายมาอยู่แถวเดียวกับเลขที่ใบ เพื่อคืนบรรทัด subtitle ให้แถบขั้นตอน
  // (เลขที่ใบ · สถานะ · รุ่น = ตัวตนของเอกสาร อยู่ด้วยกันหมดในบรรทัดเดียว)
  const badges = (
    // แยกเป็นคนละกลุ่มกับเลขที่ใบด้วยเส้นคั่น + ระยะห่าง — เลขที่ใบคือตัวตนของ
    // เอกสาร ส่วนสถานะกับรุ่นคือ "ตอนนี้มันอยู่ตรงไหน" คนละคำถามกัน ก่อนหน้านี้
    // นั่งติดกันด้วย gap เท่ากันหมดจนอ่านเป็นพวงเดียว
    <div className="border-border/60 ms-1 flex items-center gap-2 border-s ps-3">
      {statusCfg && purchaseRequest && (
        <StatusIconLabel
          status={purchaseRequest.pr_status}
          label={statusCfg.label ?? purchaseRequest.pr_status}
          // เบากว่าในตาราง: ตัวเอกของแถบนี้คือเลขที่ใบ (18-20px) สถานะเป็นข้อมูล
          // ประกอบ ป้ายจึงเป็นสีจางเท่ารุ่นเอกสารที่อยู่ข้างกัน เหลือสีไว้ที่ไอคอน
          // จุดเดียวซึ่งเป็นสัญญาณที่ต้องเห็นจริง ๆ
          className="text-muted-foreground text-micro [&>svg]:size-3"
        />
      )}
      {purchaseRequest?.doc_version != null && (
        <span className="text-muted-foreground text-micro">
          {tfl("version")} {purchaseRequest.doc_version}
        </span>
      )}
    </div>
  );

  // draft/add ยังไม่เข้า workflow — ซ่อน workflow cell/step
  const isDraft =
    !purchaseRequest?.pr_status ||
    purchaseRequest.pr_status === PR_STATUS.DRAFT;

  // แถบข้อมูลหัวเอกสาร — ทุกฟิลด์ของใบอยู่ที่นี่ที่เดียว ไม่มีบล็อกซ้ำในตัวฟอร์ม
  // ช่องที่แก้ได้ (workflow/description) ส่งเป็น node มาวางในเซลล์ของตัวเอง
  // ฟิลด์เดียวกันจึงอยู่ตำแหน่งเดิมเสมอ สลับ view/edit แล้วไม่ต้องไล่หาใหม่
  const workflowCell =
    workflowField ??
    (workflowName ? (
      <Field>
        {/* ดาวแดงติดอยู่กับ "ช่องนี้ต้องมีค่า" ไม่ใช่ "ตอนนี้กรอกได้" — โหมดอ่าน
            กับใบที่มาจากเทมเพลต (workflow ถูกล็อก) จึงต้องมีเหมือนกัน ไม่งั้น
            ฟิลด์เดียวกันหน้าตาเปลี่ยนไปมาตามโหมดโดยไม่มีเหตุผลที่คนใช้อธิบายได้ */}
        <FieldLabel required>{tfl("workflow")}</FieldLabel>
        <Input value={workflowName} disabled />
      </Field>
    ) : null);

  // โชว์เสมอแม้ยังไม่ได้กรอก — ช่องที่หายไปทั้งช่องทำให้หัวเอกสารของใบที่มีคำอธิบาย
  // กับใบที่ไม่มีเป็นคนละทรง และคนอ่านแยกไม่ออกว่า "ไม่มีคำอธิบาย" กับ "ไม่มีช่องนี้"
  const descriptionCell = descriptionField ?? (
    <Field className="lg:col-span-2">
      <FieldLabel>{tfl("description")}</FieldLabel>
      <Input value={description ?? ""} disabled />
    </Field>
  );

  // สองแถวเป็นคนละ grid แต่ track เดียวกัน — บังคับให้ workflow/description
  // ขึ้นบรรทัดใหม่เสมอ ไม่ว่าแถวบนจะมีกี่ช่อง (ถ้าใช้ grid เดียวแล้วปล่อยไหลเอง
  // ช่องจะเลื่อนไปต่อท้ายแถวบนเมื่อจอกว้างพอ) · ml-4 หักล้าง -ml-4 ของ DocFormHeader
  const ribbonRow =
    "grid w-full grid-cols-1 gap-x-2 gap-y-4 sm:grid-cols-2 lg:grid-cols-6";
  const ribbon = (workflowCell || descriptionCell) && (
    <div className="ml-4 w-full">
      <div className={ribbonRow}>
        {workflowCell}
        {descriptionCell}
      </div>
    </div>
  );

  /**
   * ผู้ขอ · แผนก · วันที่ อยู่ใต้เลขที่ใบเป็นข้อความ ไม่ใช่ช่องกรอกที่จางทั้งแถว
   * (ทรงเดียวกับ CN/GRN/PO) — สามค่านี้อ่านอย่างเดียว ไม่เข้า payload การทำเป็น
   * ช่อง disabled กินพื้นที่เท่าช่องที่กรอกได้จริงและชวนให้เข้าใจผิดว่าแก้ได้
   *
   * ต่างจากอีกสามใบตรงที่ PR ไม่เปิดให้เลือกวันที่ — วันที่ใบขอซื้อคือวันที่ระบบ
   * บันทึก ไม่ใช่ค่าที่ผู้ขอกรอกเอง จึงยังเป็นข้อความอ่านอย่างเดียวเหมือนเดิม
   */
  const docMeta =
    reqName || departmentName || prDateDisplay ? (
      <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {reqName && (
          <span className="flex items-center gap-1">
            <User className="size-3 shrink-0" aria-hidden="true" />
            {reqName}
          </span>
        )}
        {departmentName && (
          <span className="flex items-center gap-1">
            <Building2 className="size-3 shrink-0" aria-hidden="true" />
            {departmentName}
          </span>
        )}
        {prDateDisplay && (
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
            {prDateDisplay}
          </span>
        )}
      </span>
    ) : null;

  const workflowStepEl =
    !isDraft && purchaseRequest?.workflow_current_stage ? (
      <WorkflowTrack
        previousStage={purchaseRequest.workflow_previous_stage}
        currentStage={purchaseRequest.workflow_current_stage}
        nextStage={
          purchaseRequest.pr_status === PR_STATUS.COMPLETED
            ? undefined
            : purchaseRequest.workflow_next_stage
        }
        terminalState={
          purchaseRequest.pr_status === PR_STATUS.VOIDED ? "voided" : undefined
        }
      />
    ) : undefined;

  const workflowStep = workflowStepEl ? (
    <WorkflowStepButton onShowHistory={hasHistory ? onShowHistory : undefined}>
      {workflowStepEl}
    </WorkflowStepButton>
  ) : undefined;

  return (
    <FormToolbar
      mode={mode}
      formId="purchase-request-form"
      isPending={isPending}
      title={purchaseRequest?.pr_no ?? t("title")}
      subtitle={
        workflowStep || docMeta ? (
          <span className="flex flex-col gap-1">
            {docMeta}
            {workflowStep}
          </span>
        ) : undefined
      }
      badges={badges}
      ribbon={ribbon}
      onBack={onBack}
      onCancel={onCancel}
      // แก้ได้เว้นแต่ใบถูก void หรือ role ของ stage นี้อ่านอย่างเดียว
      onEdit={!isViewOnly && !isVoided ? onEdit : undefined}
      // ลบได้ทั้ง view/edit ตราบที่ยังเป็น draft — เช็คเจ้าของใบอยู่ที่ handler ของฟอร์ม
      onDelete={
        purchaseRequest?.pr_status === PR_STATUS.DRAFT ? onDelete : undefined
      }
      deleteIsPending={isDeletePending}
      // เดิมป้าย Save ทุกโหมด — ไม่ให้โหมด add กลายเป็น "Create"
      submitLabel={tc("save")}
      pendingLabel={tf("saving")}
    >
      {/* comment / activity / duplicate / print ยุบอยู่ในเมนู ⋯ — ไม่ส่ง activity
          ให้ toolbar ซ้ำ · Duplicate/Print เฉพาะ view (ตอน edit ค่าบนจออาจยังไม่ save) */}
      {purchaseRequest && (
        <DocActionsMenu
          onDuplicate={isView && prId ? handleDuplicate : undefined}
          onComment={onComment}
          commentCount={commentCount}
          activity={prId ? { id: prId, label: prNo } : undefined}
          print={
            isView && prId
              ? {
                  documentType: "PR",
                  documentId: prId,
                  filters: prNo ? { DocumentNo: prNo } : undefined,
                }
              : undefined
          }
        />
      )}
    </FormToolbar>
  );
}
