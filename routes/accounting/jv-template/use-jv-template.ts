import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useXlsxExport, type XlsxColumn } from "@/hooks/use-xlsx-export";
import type { ParamsDto } from "@/types/params";
import { jvTemplateRepository as repository } from "./jv-template-repository";
import type { JvTemplate, JvTemplateInput } from "./jv-template-types";

export const JV_TEMPLATE_QUERY_KEYS = {
  root: (buCode: string) => ["jv-templates", buCode] as const,
  list: (buCode: string, params?: ParamsDto) =>
    [...JV_TEMPLATE_QUERY_KEYS.root(buCode), "list", params] as const,
  detail: (buCode: string, id?: string) =>
    [...JV_TEMPLATE_QUERY_KEYS.root(buCode), "detail", id] as const,
};

/** รายการ template แบบแบ่งหน้า — `options.enabled` ให้หน้า list ปิดตอนมือถือ (ใช้ useGridPagination แทน) */
export function useJvTemplates(
  params?: ParamsDto,
  options?: { enabled?: boolean },
) {
  const buCode = useBuCode() ?? "";
  return useQuery({
    queryKey: JV_TEMPLATE_QUERY_KEYS.list(buCode, params),
    queryFn: () => repository.list(buCode, params),
    enabled: Boolean(buCode) && (options?.enabled ?? true),
  });
}

export function useJvTemplate(id?: string) {
  const buCode = useBuCode() ?? "";
  return useQuery({
    queryKey: JV_TEMPLATE_QUERY_KEYS.detail(buCode, id),
    queryFn: () => repository.get(buCode, id!),
    enabled: Boolean(buCode && id && id !== "new" && id !== "undefined"),
  });
}

function useMutationContext() {
  const buCode = useBuCode() ?? "";
  const queryClient = useQueryClient();
  return {
    buCode,
    invalidate: () =>
      queryClient.invalidateQueries({
        queryKey: JV_TEMPLATE_QUERY_KEYS.root(buCode),
      }),
    /** generate สร้าง JV ใหม่ — รีเฟรชรายการ JV ด้วย */
    invalidateWithJv: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: JV_TEMPLATE_QUERY_KEYS.root(buCode),
        }),
        queryClient.invalidateQueries({
          queryKey: ["journal-vouchers", buCode],
        }),
      ]),
  };
}

export function useCreateJvTemplate() {
  const ctx = useMutationContext();
  return useMutation({
    mutationFn: (input: JvTemplateInput) => repository.create(ctx.buCode, input),
    onSuccess: ctx.invalidate,
  });
}

export function useUpdateJvTemplate() {
  const ctx = useMutationContext();
  return useMutation({
    mutationFn: ({
      id,
      doc_version,
      ...input
    }: JvTemplateInput & { id: string; doc_version: number }) =>
      repository.update(ctx.buCode, id, doc_version, input),
    onSuccess: ctx.invalidate,
  });
}

export function useDeleteJvTemplate() {
  const ctx = useMutationContext();
  return useMutation({
    mutationFn: (id: string) => repository.remove(ctx.buCode, id),
    onSuccess: ctx.invalidate,
  });
}

export function useGenerateJvTemplate() {
  const ctx = useMutationContext();
  return useMutation({
    mutationFn: ({ id, glPeriodId }: { id: string; glPeriodId: string }) =>
      repository.generate(ctx.buCode, id, glPeriodId),
    onSuccess: ctx.invalidateWithJv,
  });
}

export function useGenerateAllDueJvTemplates() {
  const ctx = useMutationContext();
  return useMutation({
    mutationFn: (glPeriodId: string) =>
      repository.generateAllDue(ctx.buCode, glPeriodId),
    onSuccess: ctx.invalidateWithJv,
  });
}

/** Export รายการ template ตามตัวกรองปัจจุบันเป็น Excel (ท่าเดียวกับ JV) */
export function useExportJvTemplates() {
  const buCode = useBuCode() ?? "";
  const { exportToXlsx, isExporting } = useXlsxExport();
  const exportJvTemplates = ({
    params,
    columns,
  }: {
    params?: ParamsDto;
    columns: XlsxColumn<JvTemplate>[];
  }) =>
    exportToXlsx<JvTemplate>({
      fetch: async () => (await repository.list(buCode, params)).data,
      columns,
      sheetName: "JV Templates",
      fileNamePrefix: "jv-template",
    });
  return { exportJvTemplates, isExporting };
}
