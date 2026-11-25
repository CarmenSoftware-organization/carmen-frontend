import { useTranslations } from "use-intl";
import { useWorkflowById } from "@/hooks/use-workflow";
import { useUserAll } from "@/hooks/use-user";
import { useProductAll } from "@/hooks/use-product";
import { ErrorState } from "@/components/ui/error-state";
import { WfDetailSkeleton } from "./wf-detail-skeleton";
import { parseWorkflowData } from "./wf-form-schema";
import { WfDetail } from "./wf-detail";

export function WfEditContent({ id }: { id: string }) {
  const t = useTranslations("systemAdmin.workflow");
  const {
    data: workflow,
    isLoading: wfLoading,
    error: wfError,
    refetch: wfRefetch,
  } = useWorkflowById(id);
  // ต้องได้ user/product ครบ — picker ของ workflow ยังเลือกจากทะเบียนทั้งก้อน
  // (ต้นไม้สินค้า / assign all) ช่วง 4b จะเปลี่ยนเป็นแบบโหลดทีละหน้า
  const { data: userData, isLoading: userLoading } = useUserAll();
  const { data: productData, isLoading: productLoading } = useProductAll();

  const isLoading = wfLoading || userLoading || productLoading;

  const users = userData ?? [];
  const products = (productData ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    local_name: p.local_name,
    description: p.description,
    product_status_type: p.product_status_type,
    inventory_unit: {
      id: p.inventory_unit?.id ?? "",
      name: p.inventory_unit?.name ?? "",
    },
    product_item_group: {
      id: p.product_item_group?.id ?? "",
      name: p.product_item_group?.name ?? "",
    },
    product_sub_category: {
      id: p.product_sub_category?.id ?? "",
      name: p.product_sub_category?.name ?? "",
    },
    product_category: {
      id: p.product_category?.id ?? "",
      name: p.product_category?.name ?? "",
    },
  }));

  if (isLoading) return <WfDetailSkeleton />;
  if (wfError || !workflow)
    return (
      <ErrorState
        error={wfError}
        notFoundMessage={t("notFound")}
        onRetry={() => wfRefetch()}
        backTo="/system-admin/workflow"
      />
    );
  // อ่าน data ไม่ได้ = ห้ามเปิดฟอร์ม ไม่งั้นกด Save แล้วทับ stages จริงด้วยของว่าง
  if (!parseWorkflowData(workflow.data).success)
    return (
      <ErrorState
        message={t("incompatibleData")}
        backTo="/system-admin/workflow"
      />
    );

  return <WfDetail workflow={workflow} users={users} products={products} />;
}
