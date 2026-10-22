import { useAppConfigByKey, useUpsertAppConfig } from "@/hooks/use-app-config";
import { ApiError } from "@/lib/api-error";

export type UseInterfaceConfigResult = {
  readonly value: Record<string, unknown> | undefined;
  readonly isLoading: boolean;
  readonly isNew: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
  readonly save: (
    value: Record<string, unknown>,
    opts?: { onSuccess?: () => void },
  ) => void;
  readonly isSaving: boolean;
};

/**
 * Hook อ่าน/เขียน config ของ interface หนึ่งตัวใน `tb_application_config`
 *
 * แยก "ยังไม่เคยตั้งค่า" (404) ออกจาก error จริง (500/401) เพราะ interface ที่ยัง
 * ไม่ถูกตั้งค่าเป็นสถานะปกติ ไม่ควรขึ้นหน้า error — backend มี default ให้แล้ว
 * (`defaultByKey`) แต่ BU ที่ deploy ก่อนหน้านั้นยังคืน 404 อยู่ จึงต้องดักไว้ฝั่งนี้ด้วย
 *
 * 404 ยัง retry 1 รอบตาม default ของ QueryClient (`components/providers.tsx`) — ยอมได้
 * เพราะเป็น path ชั่วคราวและ backend default ตัดมันทิ้งไปแล้ว
 *
 * @param configKey - key ใน app_config เช่น `interface_pos_simphony`
 * @returns ค่า config, สถานะโหลด/ใหม่/error และฟังก์ชัน save
 */
export function useInterfaceConfig(
  configKey: string,
): UseInterfaceConfigResult {
  const query = useAppConfigByKey(configKey);
  const upsert = useUpsertAppConfig();

  const isNotFound =
    query.error instanceof ApiError && query.error.statusCode === 404;

  return {
    value: query.data?.value,
    // isPending, not isLoading: useAppConfigByKey is gated `enabled: !!buCode`, and a
    // disabled query has fetchStatus "idle", so isLoading is false while the profile is
    // still resolving — the form would render its defaults, then flicker to a skeleton,
    // and form.reset would wipe anything typed in that window.
    isLoading: query.isPending,
    isNew: isNotFound && !query.data,
    isError: query.isError && !isNotFound,
    refetch: () => void query.refetch(),
    save: (value, opts) =>
      upsert.mutate({ key: configKey, value }, { onSuccess: opts?.onSuccess }),
    isSaving: upsert.isPending,
  };
}
