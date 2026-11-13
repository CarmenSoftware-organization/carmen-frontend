import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Check, Shield } from "lucide-react";
import { PagedChecklist } from "@/components/lookup/paged-checklist";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/role";
import { useRole } from "../shared/use-role";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import type { UserRoleAssignment } from "@/types/user";
import { EmptyState } from "./user-assigned-ui";
import type { UserAssignedFormValues } from "./user-assigned-form-schema";

/* ------------------------------------------------------------------ */
/* RoleToggleCard — single role pickable card                          */
/* ------------------------------------------------------------------ */

interface RoleToggleCardProps {
  readonly role: Role;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}

function RoleToggleCard({
  role,
  checked,
  disabled,
  onChange,
}: RoleToggleCardProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      // การ์ดอยู่ใต้ cmdk Command ซึ่ง preventDefault ทุก Enter ที่ bubble ถึง root —
      // หยุดที่ปุ่มเพื่อให้ Enter ยัง click การ์ดตามปกติ
      onKeyDown={(e) => {
        if (e.key === "Enter") e.stopPropagation();
      }}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        "group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
        checked ? "bg-primary/5" : "hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm",
            checked ? "text-foreground font-medium" : "text-foreground/90",
          )}
        >
          {role.name}
        </p>
        {role.description && (
          <p className="text-muted-foreground text-micro line-clamp-1">
            {role.description}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border group-hover:border-foreground/30 bg-transparent",
        )}
        aria-hidden="true"
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* RolesSection — form section wrapping all roles                      */
/* ------------------------------------------------------------------ */

interface RolesSectionProps {
  readonly form: UseFormReturn<UserAssignedFormValues>;
  /** โหมดดู — แสดงเฉพาะบทบาทที่ถืออยู่ ไม่ใช่รายการให้ติ๊กที่ถูก disable */
  readonly isView: boolean;
  readonly isDisabled: boolean;
  readonly count: number;
  /** บทบาทที่มากับตัวผู้ใช้ (มีชื่อกับคำอธิบายครบ) — ใช้ในโหมดดู ไม่ต้องยิงทะเบียนบทบาท */
  readonly assignedRoles: readonly UserRoleAssignment[];
}

// เส้นคั่นระหว่างการ์ด — แถว virtual เป็นลูกของ div ภายใน VirtualCommandList
// `divide-y` บนกรอบจึงไม่ถึง ต้องเลือกแถวด้วย data-index แทน
const ROLE_LIST_CLASS =
  "rounded-lg [&_[data-index]]:border-border/60 [&_[data-index]:not(:last-child)]:border-b";

export function RolesSection({
  form,
  isView,
  isDisabled,
  count,
  assignedRoles,
}: RolesSectionProps) {
  const t = useTranslations("systemAdmin.user");
  const tc = useTranslations("common");

  let body;
  if (isView && assignedRoles.length === 0) {
    body = (
      <EmptyState
        icon={Shield}
        title={t("noRolesAvailable")}
        desc={t("noRolesAvailableDesc")}
      />
    );
  } else if (isView) {
    // โหมดดู: เฉพาะบทบาทที่ถืออยู่ เป็นช่องของกริด (ชื่อ + คำอธิบาย) ไม่มีกรอบ — เดิมโชว์ทะเบียน
    // บทบาททั้ง BU แบบ disabled ให้ไล่หาเองว่าแถวไหนติ๊ก และต้องยิงทะเบียนทั้งที่แค่เปิดดู
    body = (
      <FieldGrid>
        {assignedRoles.map((role) => (
          <div key={role.application_role_id} className="min-w-0">
            <div className="text-sm font-medium break-words">
              {role.application_role_name}
            </div>
            {role.application_role_description && (
              <div className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                {role.application_role_description}
              </div>
            )}
          </div>
        ))}
      </FieldGrid>
    );
  } else {
    body = (
      <Controller
        control={form.control}
        name="role_ids"
        render={({ field }) => (
          // กว้างไม่เกิน 42rem: แถวของบทบาทมีชื่อชิดซ้าย เครื่องหมายติ๊กชิดขวา — ปล่อยเต็มการ์ด
          // บนจอกว้างแล้วติ๊กอยู่ห่างจากชื่อเป็นพันพิกเซล
          <div className="max-w-2xl">
            {/* การ์ดแสดงสถานะติ๊กเองจึงปิด badge — role ที่ assign ไว้แต่ยังไม่อยู่ในหน้าที่โหลด
                (ปิดใช้งาน/หลังหน้าแรก) PagedChecklist ปักไว้บนสุดให้เห็นและเอาออกได้ */}
            <PagedChecklist<Role>
              useListHook={useRole}
              getId={(r) => r.id}
              getLabel={(r) => r.name}
              value={field.value ?? []}
              onChange={field.onChange}
              disabled={isDisabled}
              showSelectedBadges={false}
              maxHeight={360}
              estimateSize={52}
              className={ROLE_LIST_CLASS}
              renderItem={(role, checked, toggle) => (
                <RoleToggleCard
                  role={role}
                  checked={checked}
                  disabled={isDisabled}
                  onChange={() => toggle()}
                />
              )}
              emptyMessage={
                <EmptyState
                  icon={Shield}
                  title={t("noRolesAvailable")}
                  desc={t("noRolesAvailableDesc")}
                />
              }
              noResultMessage={
                <span className="text-muted-foreground text-xs">
                  {tc("noSearchResult")}
                </span>
              }
            />
          </div>
        )}
      />
    );
  }

  return (
    <CompactSection
      title={t("assignRoles")}
      description={t("assignRolesDesc")}
      count={count}
    >
      {body}
    </CompactSection>
  );
}
