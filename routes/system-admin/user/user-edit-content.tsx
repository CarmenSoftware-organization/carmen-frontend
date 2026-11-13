import { useTranslations } from "use-intl";
import { useUserById } from "@/hooks/use-user";
import { UserAssignedForm } from "./user-assigned-form";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import {
  CompactSectionSkeleton,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";

export function UserEditContent({ id }: { id: string }) {
  const tErr = useTranslations("systemAdmin.user");
  const { data: user, isLoading, error, refetch } = useUserById(id);

  // โครงเดียวกับหน้าจริง: แผนก · บทบาท | คลัง — เนื้อหาไม่กระโดดตอนข้อมูลมา
  if (isLoading)
    return (
      <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
        <CompactSectionSkeleton first className="h-14" />
        <div className={SECTION_PAIR}>
          <CompactSectionSkeleton className="h-64" />
          <CompactSectionSkeleton className="h-64" />
        </div>
      </FormPageShell>
    );
  if (error || !user)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/system-admin/user"
      />
    );

  return <UserAssignedForm user={user} />;
}
