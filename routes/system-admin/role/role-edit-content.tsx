import { useTranslations } from "use-intl";
import { useRoleById } from "../shared/use-role";
import { RoleForm } from "./role-form";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import { CompactSectionSkeleton } from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";

export function RoleEditContent({ id }: { id: string }) {
  const tErr = useTranslations("systemAdmin.role");
  const { data: role, isLoading, error, refetch } = useRoleById(id);

  // โครงเดียวกับหน้าจริง: หมวดชื่อ (หนึ่งแถว) + หมวดสิทธิ์
  if (isLoading)
    return (
      <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
        <CompactSectionSkeleton first className="h-[4.625rem]" />
        <CompactSectionSkeleton className="h-96" />
      </FormPageShell>
    );
  if (error || !role)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/system-admin/role"
      />
    );

  return <RoleForm role={role} />;
}
