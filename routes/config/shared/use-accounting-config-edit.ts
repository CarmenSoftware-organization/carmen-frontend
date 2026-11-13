import { useCan } from "@/hooks/use-can";
import { buildPermissionKey } from "@/constant/permissions";

export function useAccountingConfigEdit(permissionPrefix: string) {
  const { can, canWrite } = useCan();
  return canWrite && can(buildPermissionKey(permissionPrefix, "update"));
}
