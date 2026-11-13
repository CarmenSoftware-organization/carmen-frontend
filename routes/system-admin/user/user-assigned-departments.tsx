import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { LookupDepartment } from "@/components/lookup/lookup-department";
import { FieldPlainText } from "@/components/ui/field";
import { CompactSection } from "@/components/share/compact-section";
import type { UserAssignedFormValues } from "./user-assigned-form-schema";

interface DepartmentsSectionProps {
  readonly form: UseFormReturn<UserAssignedFormValues>;
  readonly isDisabled: boolean;
  readonly departmentName: string | undefined;
  readonly first?: boolean;
}

/**
 * แผนกที่ผู้ใช้สังกัด — **เลือกได้ค่าเดียว** จึงเป็น lookup ไม่ใช่ชุด checkbox
 *
 * โหมดดูแสดงชื่อที่มากับตัวผู้ใช้ตรง ๆ ไม่ผ่าน `readOnly` ของ `LookupDepartment`
 * เพราะตัวนั้นต้องลากทะเบียนแผนกทั้ง BU มาแปลง id เป็นชื่อ ทั้งที่ชื่ออยู่ในมือ
 * แล้ว — ทะเบียนถูกยิงตอนกด Edit เท่านั้น
 */
export function DepartmentsSection({
  form,
  isDisabled,
  departmentName,
  first,
}: DepartmentsSectionProps) {
  const t = useTranslations("systemAdmin.user");

  return (
    <CompactSection
      first={first}
      title={t("departmentsTitle")}
      description={t("departmentsDesc")}
    >
      {isDisabled ? (
        departmentName ? (
          <FieldPlainText className="block min-h-0 text-sm">
            {departmentName}
          </FieldPlainText>
        ) : (
          <span className="text-muted-foreground/60 text-sm">—</span>
        )
      ) : (
        <Controller
          control={form.control}
          name="department_id"
          render={({ field }) => (
            // ช่องเลือกกว้างไม่เกิน 24rem — การ์ดเต็มจอแต่ชื่อแผนกยาวแค่ไม่กี่คำ
            <div className="max-w-sm">
              <LookupDepartment
                value={field.value}
                onValueChange={field.onChange}
                className="w-full"
              />
            </div>
          )}
        />
      )}
    </CompactSection>
  );
}
