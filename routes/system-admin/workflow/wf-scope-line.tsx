import { useTranslations } from "use-intl";
import type { WorkflowDto } from "@/types/workflows";
import { cn } from "@/lib/utils";

interface WfScopeLineProps {
  readonly workflow: WorkflowDto;
  readonly className?: string;
}

/**
 * บรรทัดย่อยใต้ชื่อ workflow: ผูกสินค้ากี่รายการ · มีกฎ routing กี่ข้อ
 *
 * นับจาก `data.products` / `data.routing_rules` ตรง ๆ — ฟิลด์ `stages` / `rules`
 * ระดับบนของ list response ส่งมาเป็น null (ตรวจ 2026-10-21) อย่าเชื่อสองตัวนั้น
 * workflow ที่ยังไม่ผูกสินค้าจะไม่ถูกเลือกใช้กับเอกสารไหนเลย จึงเป็นบรรทัดที่ช่วย
 * แยก workflow ชื่อคล้าย ๆ กันออกจากกันได้ดีที่สุดเท่าที่ list มีให้
 */
export default function WfScopeLine({ workflow, className }: WfScopeLineProps) {
  const t = useTranslations("systemAdmin.workflow");
  const products = workflow.data?.products?.length ?? 0;
  const rules = workflow.data?.routing_rules?.length ?? 0;

  return (
    <span
      className={cn(
        "text-muted-foreground text-xs font-normal tabular-nums",
        className,
      )}
    >
      {t("listProductCount", { count: products })}
      {rules > 0 && (
        <>
          <span aria-hidden="true"> · </span>
          {t("listRuleCount", { count: rules })}
        </>
      )}
    </span>
  );
}
