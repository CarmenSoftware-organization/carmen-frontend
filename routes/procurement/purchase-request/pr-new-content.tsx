import { Suspense } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useTranslations } from "use-intl";
import { PurchaseRequestForm } from "./pr-form";
import { usePurchaseRequestById } from "./use-purchase-request";
import { CreateWorkflowGate } from "@/components/share/create-workflow-gate";
import { WORKFLOW_TYPE } from "@/types/workflows";
import { DocPageSkeleton } from "@/components/loader/doc-page-skeleton";
import type { PurchaseRequestTemplate } from "@/types/purchase-request";

const PrNewInner = () => {
  const [searchParams] = useSearchParams();
  // เทมเพลตมาทาง state ของ router ไม่ใช่ query — หน้า /from-template กรองแถวที่
  // ขอจริงกับจำนวนที่กรอกมาให้แล้ว ส่ง id ผ่าน URL จะได้จำนวนของเทมเพลตกลับมาแทน
  // (refresh แล้ว state หาย = ได้ฟอร์มเปล่า ซึ่งตรงกับความจริงว่าไม่มีอะไรค้างอยู่)
  const template = useLocation().state?.template as
    PurchaseRequestTemplate | undefined;
  // ?duplicate_id= — สร้างสำเนาจากใบเดิม (ปุ่ม Duplicate ในหน้า detail/เมนูแถว)
  const duplicateId = searchParams.get("duplicate_id");

  const { data: duplicateFrom, isError: duplicateError } =
    usePurchaseRequestById(duplicateId ?? undefined);

  // duplicate ต้องรอ "ข้อมูลมาแล้ว" ไม่ใช่แค่ isLoading — ช่วงแรก query ยัง
  // disabled (รอ buCode) isLoading เป็น false ทั้งที่ยังไม่มีของ ถ้าปล่อยผ่าน
  // ฟอร์มจะ mount เปล่า ๆ แล้ว defaultValues ถูกแช่ไปตลอด (useForm อ่านครั้งเดียว)
  // ดึงใบเดิมพลาด → ตกไปฟอร์มเปล่าแทนที่จะค้าง skeleton
  if (duplicateId && !duplicateFrom && !duplicateError) {
    return <DocPageSkeleton ribbon="text" />;
  }

  return (
    <PurchaseRequestForm template={template} duplicateFrom={duplicateFrom} />
  );
};

export function PrNewContent() {
  const t = useTranslations("procurement.purchaseRequest");

  return (
    <CreateWorkflowGate
      workflowType={WORKFLOW_TYPE.PR}
      description={t("noCreatableWorkflow")}
    >
      <Suspense fallback={<DocPageSkeleton ribbon="text" />}>
        <PrNewInner />
      </Suspense>
    </CreateWorkflowGate>
  );
}
