import { useSearchParams } from "react-router";
import { useTranslations } from "use-intl";
import { StoreRequisitionForm } from "./sr-form";
import { useStoreRequisitionById } from "./use-sr";
import { CreateWorkflowGate } from "@/components/share/create-workflow-gate";
import { DocPageSkeleton } from "@/components/loader/doc-page-skeleton";
import { WORKFLOW_TYPE } from "@/types/workflows";

export function Component() {
  const t = useTranslations("storeOperation.storeRequisition");
  const [searchParams] = useSearchParams();
  // ?duplicate_id= — สร้างสำเนาจากใบเดิม (ปุ่ม Duplicate ในหน้า detail)
  const duplicateId = searchParams.get("duplicate_id");
  const { data: duplicateFrom, isError: duplicateError } =
    useStoreRequisitionById(duplicateId ?? undefined);

  return (
    <CreateWorkflowGate
      workflowType={WORKFLOW_TYPE.SR}
      description={t("noCreatableWorkflow")}
    >
      {/* duplicate ต้องรอ "ข้อมูลมาแล้ว" ไม่ใช่ isLoading — ช่วง query ยัง disabled
          (รอ buCode) isLoading เป็น false ฟอร์มจะ mount เปล่าแล้ว defaultValues
          โดนแช่ (บทเรียนจาก PR) ดึงพลาด → ตกไปฟอร์มเปล่าแทนค้าง skeleton */}
      {duplicateId && !duplicateFrom && !duplicateError ? (
        <DocPageSkeleton fields={[1, 1, 1, 1, 2]} />
      ) : (
        <StoreRequisitionForm duplicateFrom={duplicateFrom} />
      )}
    </CreateWorkflowGate>
  );
}
