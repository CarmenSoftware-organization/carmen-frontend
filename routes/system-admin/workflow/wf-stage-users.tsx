import { useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Search, UserRoundCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import type { User } from "@/types/workflows";
import { formatName } from "@/lib/name";
import { cn } from "@/lib/utils";
import type { WorkflowCreateModel } from "./wf-form-schema";

interface WfStageUsersProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly index: number;
  readonly users: User[];
  readonly isMiddle: boolean;
  readonly isDisabled: boolean;
  readonly isHod: boolean;
  readonly assignedUserIds: Set<string>;
}

const matchesQuery = (u: User, q: string) =>
  u.firstname.toLowerCase().includes(q) ||
  u.lastname.toLowerCase().includes(q) ||
  u.email.toLowerCase().includes(q) ||
  (u.middlename?.toLowerCase().includes(q) ?? false);

export function WfStageUsers({
  form,
  index,
  users,
  isMiddle,
  isDisabled,
  isHod,
  assignedUserIds,
}: WfStageUsersProps) {
  const [userSearch, setUserSearch] = useState("");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const t = useTranslations("systemAdmin.workflow");
  const path = `data.stages.${index}.assigned_users` as const;

  // ลำดับคงที่ตามชื่อ — ไม่ดันคนที่เลือกขึ้นบน เพราะแถวจะกระโดดหนีเมาส์ทุกครั้งที่ติ๊ก
  // อยากเห็นเฉพาะคนที่เลือกให้ใช้สวิตช์ "เฉพาะที่เลือก" แทน
  const q = userSearch.trim().toLowerCase();
  const visibleUsers = users
    .filter((u) => !q || matchesQuery(u, q))
    .filter((u) => !assignedOnly || assignedUserIds.has(u.user_id))
    .sort((a, b) =>
      `${a.firstname} ${a.lastname}`.localeCompare(
        `${b.firstname} ${b.lastname}`,
      ),
    );

  const visibleAssigned = visibleUsers.filter((u) =>
    assignedUserIds.has(u.user_id),
  ).length;
  const headerState: boolean | "indeterminate" =
    visibleAssigned === 0
      ? false
      : visibleAssigned === visibleUsers.length
        ? true
        : "indeterminate";
  const isFiltered = q !== "" || assignedOnly;

  const toggleUser = (user: User) => {
    if (isDisabled) return;
    const current = form.getValues(path) ?? [];
    form.setValue(
      path,
      assignedUserIds.has(user.user_id)
        ? current.filter((u) => u.user_id !== user.user_id)
        : [...current, user],
    );
  };

  // กดที่ header: ยังไม่ครบ → เลือกทุกคนที่มองเห็น, ครบแล้ว → เอาทุกคนที่มองเห็นออก
  // คนที่ถูกกรองซ่อนอยู่ไม่โดนแตะ
  const toggleVisible = () => {
    if (isDisabled) return;
    const current = form.getValues(path) ?? [];
    if (headerState === true) {
      const removeIds = new Set(visibleUsers.map((u) => u.user_id));
      form.setValue(
        path,
        current.filter((u) => !removeIds.has(u.user_id)),
      );
    } else {
      const currentIds = new Set(current.map((u) => u.user_id));
      form.setValue(path, [
        ...current,
        ...visibleUsers.filter((u) => !currentIds.has(u.user_id)),
      ]);
    }
  };

  return (
    <FieldGroup className="gap-5">
      {isMiddle && (
        <>
          <Controller
            control={form.control}
            name={`data.stages.${index}.is_hod`}
            render={({ field }) => (
              <Field orientation="horizontal" data-disabled={isDisabled}>
                <Switch
                  id={`stage-${index}-is-hod`}
                  checked={field.value ?? false}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) form.setValue(path, []);
                  }}
                  disabled={isDisabled}
                />
                <FieldContent className="gap-0.5">
                  <FieldLabel
                    htmlFor={`stage-${index}-is-hod`}
                    className="font-medium"
                  >
                    {t("hodRoute")}
                  </FieldLabel>
                  <FieldDescription>{t("hodRouteHint")}</FieldDescription>
                </FieldContent>
              </Field>
            )}
          />
          {!isHod && <FieldSeparator />}
        </>
      )}

      {!isHod && (
        <FieldSet className="gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <FieldLegend variant="label" className="mb-0">
              {t("assignedUsers")}
            </FieldLegend>
            <span
              className={cn(
                "text-xs tabular-nums",
                assignedUserIds.size === 0
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {t("assignedCount", {
                count: assignedUserIds.size,
                total: users.length,
              })}
            </span>
          </div>
          <FieldDescription>{t("assignedUsersHint")}</FieldDescription>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                placeholder={t("searchUsers")}
                size="sm"
                className="w-full pl-8"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <Field orientation="horizontal" className="w-auto shrink-0 gap-2">
              <Switch
                id={`stage-${index}-assigned-only`}
                checked={assignedOnly}
                onCheckedChange={setAssignedOnly}
              />
              <FieldLabel
                htmlFor={`stage-${index}-assigned-only`}
                className="font-normal whitespace-nowrap"
              >
                {t("assignedOnly")}
              </FieldLabel>
            </Field>
          </div>

          <div className="overflow-hidden rounded-lg border">
            {visibleUsers.length > 0 && (
              <label
                htmlFor={`stage-${index}-select-visible`}
                className={cn(
                  "bg-muted/40 flex items-center gap-3 border-b px-3 py-2",
                  !isDisabled && "cursor-pointer",
                )}
              >
                <Checkbox
                  id={`stage-${index}-select-visible`}
                  checked={headerState}
                  onCheckedChange={toggleVisible}
                  disabled={isDisabled}
                />
                <span className="text-muted-foreground text-xs font-medium">
                  {isFiltered
                    ? t("selectShown", { count: visibleUsers.length })
                    : t("selectAll")}
                </span>
              </label>
            )}

            <ul className="max-h-80 divide-y overflow-y-auto">
              {visibleUsers.length === 0 ? (
                <li className="flex flex-col items-center justify-center py-8 text-center">
                  {assignedOnly && !q ? (
                    <UserRoundCheck className="text-muted-foreground/50 mb-2 size-6" />
                  ) : (
                    <Search className="text-muted-foreground/50 mb-2 size-6" />
                  )}
                  <p className="text-muted-foreground text-xs">
                    {assignedOnly && !q
                      ? t("noAssignedUsers")
                      : t("noUsersFound")}
                  </p>
                </li>
              ) : (
                visibleUsers.map((user) => {
                  const isAssigned = assignedUserIds.has(user.user_id);
                  const id = `stage-${index}-user-${user.user_id}`;
                  return (
                    <li key={user.user_id}>
                      <label
                        htmlFor={id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 transition-colors",
                          isAssigned && "bg-primary/5",
                          !isDisabled && "hover:bg-muted/60 cursor-pointer",
                        )}
                      >
                        <Checkbox
                          id={id}
                          checked={isAssigned}
                          onCheckedChange={() => toggleUser(user)}
                          disabled={isDisabled}
                        />
                        <Avatar className="size-7 shrink-0">
                          <AvatarFallback
                            className={cn(
                              "text-micro font-medium",
                              isAssigned
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground",
                            )}
                          >
                            {formatName(user.firstname, user.lastname)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-foreground truncate text-xs leading-tight font-medium">
                            {user.firstname} {user.lastname}
                          </span>
                          <span className="text-muted-foreground text-micro-legal truncate leading-tight">
                            {user.email}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </FieldSet>
      )}
    </FieldGroup>
  );
}
