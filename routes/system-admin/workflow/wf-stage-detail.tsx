import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User, Stage } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { WfStageGeneral } from "./wf-stage-general";
import { WfStageNotifications } from "./wf-stage-notifications";
import { WfStageUsers } from "./wf-stage-users";

interface WfStageDetailProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly index: number;
  readonly users: User[];
  readonly isDisabled: boolean;
  readonly isStructureDisabled: boolean;
  readonly readOnly?: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

export function WfStageDetail({
  form,
  index,
  users,
  isDisabled,
  isStructureDisabled,
  readOnly = false,
  isFirst,
  isLast,
}: WfStageDetailProps) {
  const isMiddle = !isFirst && !isLast;
  const t = useTranslations("systemAdmin.workflow");

  const watchedStage = useWatch({
    control: form.control,
    name: `data.stages.${index}`,
  }) as Stage | undefined;

  const isHod = watchedStage?.is_hod ?? false;
  const assignedUsers = watchedStage?.assigned_users ?? [];
  const assignedUserIds = new Set(assignedUsers.map((u) => u.user_id));

  if (isLast) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <CheckCircle2 className="text-success-foreground mb-2 size-8" />
        <p className="text-sm font-semibold">{t("completedStage")}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {t("completedStageDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList variant="line">
          <TabsTrigger value="general">{t("general")}</TabsTrigger>
          <TabsTrigger value="notifications">{t("notifications")}</TabsTrigger>
          <TabsTrigger value="users">
            {t("assignedUsers")}
            {!isHod && assignedUsers.length > 0 && (
              <Badge
                variant="secondary"
                size="xs"
                className="ml-1.5 tabular-nums"
              >
                {assignedUsers.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 pt-4">
          <WfStageGeneral
            form={form}
            index={index}
            isFirst={isFirst}
            isDisabled={isDisabled}
            isNameDisabled={isStructureDisabled}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 pt-4">
          <WfStageNotifications
            form={form}
            index={index}
            isFirst={isFirst}
            isMiddle={isMiddle}
            isDisabled={isDisabled}
            watchedStage={watchedStage}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-6 pt-4">
          <WfStageUsers
            form={form}
            index={index}
            users={users}
            isMiddle={isMiddle}
            isDisabled={isDisabled}
            isHod={isHod}
            assignedUserIds={assignedUserIds}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
