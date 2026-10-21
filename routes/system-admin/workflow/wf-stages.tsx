import { useTranslations } from "use-intl";
import type { UseFormReturn, UseFieldArrayReturn } from "react-hook-form";
import type { User } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { WfStageDetail } from "./wf-stage-detail";
import { WfStructureLockNotice } from "./wf-structure-lock-notice";

interface WfStagesProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly fieldArray: UseFieldArrayReturn<WorkflowCreateModel, "data.stages">;
  readonly users: User[];
  readonly isDisabled: boolean;
  readonly isStructureDisabled: boolean;
  readonly inProgressCount: number;
  readonly selectedIndex?: number;
}

export function WfStages({
  form,
  fieldArray,
  users,
  isDisabled,
  isStructureDisabled,
  inProgressCount,
  selectedIndex: controlledIndex,
}: WfStagesProps) {
  const selectedIndex = controlledIndex ?? 0;
  // รายชื่อขั้น (เพิ่ม/ลบ/เรียง) อยู่ที่รางด้านซ้ายของหน้า (`WfStageList`) — แท็บนี้เหลือแค่
  // รายละเอียดของขั้นที่เลือก จะได้ไม่มีรายการ stage สองชุดวางคู่กัน
  const { fields } = fieldArray;
  const t = useTranslations("systemAdmin.workflow");

  const safeIndex = selectedIndex >= fields.length ? 0 : selectedIndex;

  // แสดงเฉพาะตอนอยู่ในโหมดแก้ไข — ตอนดูเฉย ๆ ทุกช่องเป็นสีเทาอยู่แล้ว ไม่มีอะไรให้อธิบาย
  const showLockNotice = isStructureDisabled && !isDisabled;

  return (
    <div className="pt-4">
      {showLockNotice && <WfStructureLockNotice count={inProgressCount} />}
      <div className="@container min-w-0">
        {fields.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {t("noStages")}
          </p>
        ) : (
          <WfStageDetail
            key={fields[safeIndex]?.id}
            form={form}
            index={safeIndex}
            users={users}
            isDisabled={isDisabled}
            isStructureDisabled={isStructureDisabled}
            isFirst={safeIndex === 0}
            isLast={safeIndex === fields.length - 1}
          />
        )}
      </div>
    </div>
  );
}
