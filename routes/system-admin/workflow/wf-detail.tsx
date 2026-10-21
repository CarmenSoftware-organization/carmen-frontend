import { useState } from "react";
import {
  useForm,
  useFieldArray,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useUpdateWorkflow } from "./use-wf-mutations";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { cn } from "@/lib/utils";
import type { Workflow, User, Product, Stage } from "@/types/workflows";
import {
  wfFormSchema,
  getWorkflowFormDefaults,
  type WorkflowCreateModel,
} from "./wf-form-schema";
import { FormPageShell } from "@/components/share/form-page-shell";
import { WfHeader } from "./wf-header";
import { useWorkflowEditAvailability } from "./use-wf-availability";
import { WfGeneral } from "./wf-general";
import { WfStages } from "./wf-stages";
import { WfRouting } from "./wf-routing";
import { WfProducts } from "./wf-products";
import WfValidationPanel from "./wf-validation-panel";
import { validateWorkflow } from "./wf-validate";
import WfInsights from "./wf-insights";
import { WfStageList } from "./wf-stage-list";
import { useServerFieldErrors } from "@/hooks/use-server-field-errors";

interface WfDetailProps {
  readonly workflow: Workflow;
  readonly users: User[];
  readonly products: Product[];
}

export function WfDetail({ workflow, users, products }: WfDetailProps) {
  "use no memo";
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [selectedStageIndex, setSelectedStageIndex] = useState(0);
  const updateWorkflow = useUpdateWorkflow();
  const isPending = updateWorkflow.isPending;
  const isDisabled = !isEditing || isPending;
  const { data: availability } = useWorkflowEditAvailability(workflow.id);
  // เอกสารที่กำลังเดินอยู่นำทางด้วยรายการ stage ชุดปัจจุบัน การแก้ชื่อ stage เพิ่ม ลบ สลับลำดับ หรือ
  // เปลี่ยนเส้นทาง จึงถูก backend ปฏิเสธตราบใดที่ยังมีเอกสารค้าง — ปิดเฉพาะส่วนนั้น ที่เหลือในฟอร์ม
  // (ผู้อนุมัติ สินค้า SLA การแจ้งเตือน) บันทึกได้ตามปกติ
  // อ่านสถานะไม่ได้ = ไม่ปิด ปล่อยไปตกที่การ์ดฝั่ง backend ซึ่งเป็นตัวบังคับจริง
  const isStructureDisabled =
    isDisabled || availability?.can_edit_stages === false;
  const t = useTranslations("systemAdmin.workflow");
  const tt = useTranslations("toast");

  const handleSelectStage = (index: number) => {
    setSelectedStageIndex(index);
    setActiveTab("stages");
  };

  const form = useForm<WorkflowCreateModel>({
    resolver: zodResolver(wfFormSchema) as Resolver<WorkflowCreateModel>,
    defaultValues: getWorkflowFormDefaults(workflow),
  });
  useServerFieldErrors(form, { WORKFLOW_ALREADY_EXISTS: "name" });

  const isDirty = form.formState.isDirty;
  const guardEnabled = isEditing && isDirty;
  useUnsavedChanges(guardEnabled);
  const navGuard = useNavigationGuard(guardEnabled);

  const stagesFieldArray = useFieldArray({
    control: form.control,
    name: "data.stages",
  });

  const watchedStages = useWatch({
    control: form.control,
    name: "data.stages",
  }) as Stage[] | undefined;

  const watchedProducts = useWatch({
    control: form.control,
    name: "data.products",
  }) as string[] | undefined;

  const routingFieldArray = useFieldArray({
    control: form.control,
    name: "data.routing_rules",
  });

  const hasStages = !!watchedStages && watchedStages.length > 0;

  let hasStageErrors = !!form.formState.errors.data?.stages;
  let validationResult = null;
  if (hasStages) {
    validationResult = validateWorkflow(watchedStages!);
    if (validationResult.errorCount > 0) hasStageErrors = true;
  }

  const hasGeneralErrors =
    !!form.formState.errors.name || !!form.formState.errors.workflow_type;
  const hasRoutingErrors = !!form.formState.errors.data?.routing_rules;

  const onSubmit = (values: WorkflowCreateModel) => {
    updateWorkflow.mutate(
      // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
      { id: workflow.id, doc_version: workflow.doc_version, ...values },
      {
        onSuccess: () => {
          toast.success(tt("updateSuccess", { entity: t("entity") }));
          form.reset(values);
          setIsEditing(false);
        },
      },
    );
  };

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <WfHeader
          workflow={workflow}
          isEditing={isEditing}
          isPending={isPending}
          onEdit={() => setIsEditing(true)}
          onCancel={handleCancel}
          formId="wf-detail-form"
        />
      }
    >
      <div className="space-y-3">
        {hasStages && validationResult && (
          <WfValidationPanel
            issues={validationResult.issues}
            errorCount={validationResult.errorCount}
            warningCount={validationResult.warningCount}
            isReady={validationResult.isReady}
            onSelectStage={handleSelectStage}
          />
        )}

        <div
          className={cn(
            "grid gap-4",
            hasStages && "lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start",
          )}
        >
          {hasStages && (
            <WfStageList
              className="bg-card rounded-xl border p-4 lg:sticky lg:top-2 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
              form={form}
              fieldArray={stagesFieldArray}
              selectedIndex={selectedStageIndex}
              showSelection={activeTab === "stages"}
              onSelect={handleSelectStage}
              isDisabled={isStructureDisabled}
              routingRules={routingFieldArray.fields as never}
              isValid={validationResult?.issues.length === 0}
            />
          )}

          <form
            id="wf-detail-form"
            onSubmit={form.handleSubmit(onSubmit, () =>
              scrollToFirstInvalidField(),
            )}
            className="bg-card text-card-foreground flex flex-col overflow-hidden rounded-xl border"
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex flex-1 flex-col"
            >
              <div className="bg-muted/20 border-b px-4 pt-2 md:px-6">
                <TabsList
                  variant="line"
                  className="h-auto gap-4 bg-transparent p-0"
                >
                  <TabsTrigger value="general" className="relative py-2.5">
                    {t("general")}
                    {hasGeneralErrors && (
                      <div className="bg-destructive absolute top-2 right-2 size-2 rounded-full" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="stages" className="relative py-2.5">
                    {t("stages")}
                    {watchedStages && watchedStages.length > 0 && (
                      <Badge
                        variant="secondary"
                        size="xs"
                        className="ml-2 tabular-nums"
                      >
                        {watchedStages.length}
                      </Badge>
                    )}
                    {hasStageErrors && (
                      <div className="bg-destructive absolute top-2 right-0 size-2 rounded-full" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="routing" className="relative py-2.5">
                    {t("routing")}
                    {routingFieldArray.fields.length > 0 && (
                      <Badge
                        variant="secondary"
                        size="xs"
                        className="ml-2 tabular-nums"
                      >
                        {routingFieldArray.fields.length}
                      </Badge>
                    )}
                    {hasRoutingErrors && (
                      <div className="bg-destructive absolute top-2 right-0 size-2 rounded-full" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="products" className="py-2.5">
                    {t("products")}
                    {watchedProducts && watchedProducts.length > 0 && (
                      <Badge
                        variant="secondary"
                        size="xs"
                        className="ml-2 tabular-nums"
                      >
                        {watchedProducts.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="insights" className="py-2.5">
                    {t("insights")}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 p-4 md:p-6">
                <TabsContent value="general" className="mt-0 outline-none">
                  <WfGeneral form={form} isDisabled={isDisabled} />
                </TabsContent>

                <TabsContent value="stages" className="mt-0 outline-none">
                  <WfStages
                    form={form}
                    fieldArray={stagesFieldArray}
                    users={users}
                    isDisabled={isDisabled}
                    isStructureDisabled={isStructureDisabled}
                    inProgressCount={availability?.documents.in_progress ?? 0}
                    selectedIndex={selectedStageIndex}
                  />
                </TabsContent>

                <TabsContent value="routing" className="mt-0 outline-none">
                  <WfRouting
                    form={form}
                    fieldArray={routingFieldArray}
                    stages={stagesFieldArray.fields}
                    allProducts={products}
                    isDisabled={isStructureDisabled}
                  />
                </TabsContent>

                <TabsContent value="products" className="mt-0 outline-none">
                  <WfProducts
                    form={form}
                    allProducts={products}
                    isDisabled={isDisabled}
                    readOnly={!isEditing}
                  />
                </TabsContent>

                <TabsContent value="insights" className="mt-0 outline-none">
                  <WfInsights
                    stages={watchedStages ?? []}
                    productCount={watchedProducts?.length ?? 0}
                    routingCount={routingFieldArray.fields.length}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </form>
        </div>

        <DiscardDialog
          open={navGuard.isOpen}
          onOpenChange={(o) => {
            if (!o) navGuard.cancel();
          }}
          onConfirm={navGuard.confirm}
          onCancel={navGuard.cancel}
          variant="warning"
        />
      </div>
    </FormPageShell>
  );
}
