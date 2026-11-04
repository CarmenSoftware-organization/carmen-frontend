import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useXlsxExport, type XlsxColumn } from "@/hooks/use-xlsx-export";
import type { ParamsDto } from "@/types/params";
import type {
  JournalVoucher,
  JournalVoucherAction,
  JournalVoucherInput,
} from "@/types/journal-voucher";
import { httpJournalVoucherRepository } from "./journal-voucher-http-repository";
import type { JournalVoucherCommand } from "./journal-voucher-repository";

// Real GL JV API; mock records are handled only for explicit mock IDs.
const repository = httpJournalVoucherRepository;

export const JOURNAL_VOUCHER_QUERY_KEYS = {
  root: (buCode: string) => ["journal-vouchers", buCode] as const,
  list: (buCode: string, params?: ParamsDto) =>
    [...JOURNAL_VOUCHER_QUERY_KEYS.root(buCode), "list", params] as const,
  detail: (buCode: string, id?: string) =>
    [...JOURNAL_VOUCHER_QUERY_KEYS.root(buCode), "detail", id] as const,
};

function useRepositoryContext() {
  return { buCode: useBuCode() ?? "BU-MOCK", repository };
}

/**
 * รายการ JV แบบแบ่งหน้า — `options.enabled` ให้หน้า list ปิด query นี้ตอนมือถือ
 * ใช้ `useGridPagination` (เลื่อนโหลดต่อ) แทน
 */
export function useJournalVouchers(
  params?: ParamsDto,
  options?: { enabled?: boolean },
) {
  const context = useRepositoryContext();
  return useQuery({
    queryKey: JOURNAL_VOUCHER_QUERY_KEYS.list(context.buCode, params),
    queryFn: () => context.repository.list(context.buCode, params),
    enabled: options?.enabled ?? true,
  });
}

/** ลบใบ JV ที่ยังเป็น draft แล้วรีเฟรชรายการ */
export function useDeleteJournalVoucher() {
  const context = useMutationContext();
  return useMutation({
    mutationFn: (id: string) => context.repository.remove(context.buCode, id),
    onSuccess: context.invalidate,
  });
}

/** Export รายการ JV ตามตัวกรองปัจจุบันเป็น Excel (ท่าเดียวกับ PO) */
export function useExportJournalVoucher() {
  const context = useRepositoryContext();
  const { exportToXlsx, isExporting } = useXlsxExport();
  const exportJournalVoucher = ({
    params,
    columns,
  }: {
    params?: ParamsDto;
    columns: XlsxColumn<JournalVoucher>[];
  }) =>
    exportToXlsx<JournalVoucher>({
      fetch: async () =>
        (await context.repository.list(context.buCode, params)).data,
      columns,
      sheetName: "Journal Vouchers",
      fileNamePrefix: "journal-voucher",
    });
  return { exportJournalVoucher, isExporting };
}

export function useJournalVoucher(id?: string) {
  const context = useRepositoryContext();
  return useQuery({
    queryKey: JOURNAL_VOUCHER_QUERY_KEYS.detail(context.buCode, id),
    queryFn: () => context.repository.get(context.buCode, id!),
    enabled: Boolean(id && id !== "new" && id !== "undefined"),
  });
}

function useMutationContext() {
  const context = useRepositoryContext();
  const queryClient = useQueryClient();
  return {
    ...context,
    invalidate: () =>
      queryClient.invalidateQueries({
        queryKey: JOURNAL_VOUCHER_QUERY_KEYS.root(context.buCode),
      }),
  };
}

export function useCreateJournalVoucher() {
  const context = useMutationContext();
  return useMutation({
    mutationFn: async (input: JournalVoucherInput) => ({
      data: await context.repository.create(context.buCode, input),
    }),
    onSuccess: context.invalidate,
  });
}

export function useUpdateJournalVoucher() {
  const context = useMutationContext();
  return useMutation({
    mutationFn: async ({
      id,
      doc_version,
      ...input
    }: JournalVoucherInput & { id: string; doc_version: number }) => ({
      data: await context.repository.update(
        context.buCode,
        id,
        doc_version,
        input,
      ),
    }),
    onSuccess: context.invalidate,
  });
}

export function useJournalVoucherAction(command: JournalVoucherCommand) {
  const context = useMutationContext();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: JournalVoucherAction & { id: string }) => ({
      data: await context.repository.action(context.buCode, id, command, input),
    }),
    onSuccess: context.invalidate,
  });
}

export function useCopyJournalVoucher() {
  const context = useMutationContext();
  return useMutation({
    mutationFn: async (id: string) => ({
      data: await context.repository.copy(context.buCode, id),
    }),
    onSuccess: context.invalidate,
  });
}
