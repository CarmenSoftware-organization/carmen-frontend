import { useTranslations } from "use-intl";
import {
  useWatch,
  type UseFormReturn,
  type UseFieldArrayReturn,
} from "react-hook-form";
import type { Stage, User } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { WfStageDetail } from "./wf-stage-detail";
import { WfStructureLockNotice } from "./wf-structure-lock-notice";
import { StageRailMarker, StageRailSummary } from "./wf-stage-rail-node";
import { formatStageSla } from "./wf-sla-utils";

interface WfStagesProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly fieldArray: UseFieldArrayReturn<WorkflowCreateModel, "data.stages">;
  readonly users: User[];
  readonly isDisabled: boolean;
  readonly isStructureDisabled: boolean;
  readonly readOnly?: boolean;
  readonly inProgressCount: number;
  readonly selectedIndex?: number;
}

export function WfStages({
  form,
  fieldArray,
  users,
  isDisabled,
  isStructureDisabled,
  readOnly = false,
  inProgressCount,
  selectedIndex: controlledIndex,
}: WfStagesProps) {
  const selectedIndex = controlledIndex ?? 0;
  // รายชื่อขั้น (เพิ่ม/ลบ/เรียง) อยู่ที่รางด้านซ้ายของหน้า (`WfStageList`) — แท็บนี้เหลือแค่
  // รายละเอียดของขั้นที่เลือก จะได้ไม่มีรายการ stage สองชุดวางคู่กัน
  const { fields } = fieldArray;
  const t = useTranslations("systemAdmin.workflow");

  const safeIndex = selectedIndex >= fields.length ? 0 : selectedIndex;
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === fields.length - 1;

  const stage = useWatch({
    control: form.control,
    name: `data.stages.${safeIndex}`,
  }) as Stage | undefined;

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
          <>
            {/* หัวเรื่องบอกว่ากำลังดูขั้นไหน — มาร์กเกอร์กับบรรทัดรองชุดเดียวกับรางด้านซ้าย */}
            <div className="mb-2 flex items-start gap-3 border-b pb-3">
              <StageRailMarker
                index={safeIndex}
                isFirst={isFirst}
                isLast={isLast}
                isSelected
              />
              <div className="min-w-0 flex-1 pt-1.5">
                <StageRailSummary
                  name={stage?.name ?? fields[safeIndex]?.name ?? ""}
                  role={stage?.role}
                  slaLabel={formatStageSla(stage)}
                  userCount={stage?.assigned_users?.length ?? 0}
                  isHod={stage?.is_hod ?? false}
                  isLast={isLast}
                />
              </div>
            </div>
            <WfStageDetail
              key={fields[safeIndex]?.id}
              form={form}
              index={safeIndex}
              users={users}
              isDisabled={isDisabled}
              isStructureDisabled={isStructureDisabled}
              readOnly={readOnly}
              isFirst={isFirst}
              isLast={isLast}
            />
          </>
        )}
      </div>
    </div>
  );
}
