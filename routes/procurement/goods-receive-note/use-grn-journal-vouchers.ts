import { useQueries } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { CACHE_DYNAMIC } from "@/lib/cache-config";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type {
  GoodsReceiveNote,
  GrnApInvoiceRef,
} from "@/types/goods-receive-note";
import type {
  JournalVoucher,
  JournalVoucherLine,
} from "@/types/journal-voucher";

/** บรรทัด JV ที่แท็บอ่านจริง — ตัวเลขเป็น number แล้ว */
export type GrnJvLine = Pick<
  JournalVoucherLine,
  "id" | "sequence_no" | "account_code" | "account_name" | "comment"
> & { debit: number; credit: number };

/** เฉพาะฟิลด์ที่แท็บ JV ของ GRN อ่านจริง — ไม่ใช่ JV เต็มรูป */
export type GrnJv = Pick<
  JournalVoucher,
  "id" | "jv_no" | "jv_date" | "jv_status" | "description"
> & { lines: GrnJvLine[] };

export interface GrnJvView {
  jv: GrnJv;
  apInvoice: GrnApInvoiceRef;
  /** active = JV ของใบ live · voided = JV เดิมของใบที่ถูก void · reversal = JV กลับรายการ */
  kind: "active" | "voided" | "reversal";
}

interface RawJvLine {
  id?: string;
  sequence_no?: number;
  account_code?: string | null;
  account_name?: string | null;
  description?: string | null;
  comment?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
}

/**
 * ดึง JV ผ่าน endpoint กลาง — ไม่ import repository ของ accounting (ข้ามโมดูลไม่ได้)
 * map เท่าที่แท็บนี้ใช้ ให้ตรงกับ `journal-voucher-http-repository.get`
 */
async function fetchGrnJv(buCode: string, id: string): Promise<GrnJv | null> {
  const res = await httpClient.get(API_ENDPOINTS.GL_JV_DETAIL(buCode, id));
  if (!res.ok) {
    if (res.status === 404) return null;
    throw await ApiError.from(res, `Failed to fetch journal voucher ${id}`);
  }
  const json = await res.json();
  const raw = json?.data ?? json;
  if (!raw?.id) return null;
  const rawLines: RawJvLine[] = Array.isArray(raw.tb_gl_jv_detail)
    ? raw.tb_gl_jv_detail
    : Array.isArray(raw.lines)
      ? raw.lines
      : [];
  return {
    id: raw.id,
    jv_no: raw.jv_no ?? null,
    jv_date: raw.jv_date ?? "",
    jv_status: raw.jv_status ?? "draft",
    description: raw.description ?? "",
    lines: rawLines.map((l, idx) => ({
      id: l.id ?? `line-${idx + 1}`,
      sequence_no: l.sequence_no ?? idx + 1,
      account_code: l.account_code ?? null,
      account_name: l.account_name ?? null,
      comment: l.description ?? l.comment ?? null,
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
    })),
  };
}

interface Target {
  jvId: string;
  apInvoice: GrnApInvoiceRef;
  kind: GrnJvView["kind"];
}

function collectTargets(grn: GoodsReceiveNote | undefined): Target[] {
  if (!grn) return [];
  const targets: Target[] = [];
  for (const inv of grn.ap_invoices ?? []) {
    if (inv.gl_jv_id)
      targets.push({ jvId: inv.gl_jv_id, apInvoice: inv, kind: "active" });
  }
  for (const inv of grn.ap_invoices_voided ?? []) {
    if (inv.gl_jv_id)
      targets.push({ jvId: inv.gl_jv_id, apInvoice: inv, kind: "voided" });
    if (inv.void_gl_jv_id)
      targets.push({
        jvId: inv.void_gl_jv_id,
        apInvoice: inv,
        kind: "reversal",
      });
  }
  return targets;
}

/**
 * JV ของ GRN ใบหนึ่ง — `active` = JV ของ AP invoice ที่ยังใช้งาน (ระบบหรือคนสร้าง),
 * `reversed` = JV เดิมคู่กับ JV กลับรายการของใบ grn_auto ที่ถูก void
 */
export function useGrnJournalVouchers(grn: GoodsReceiveNote | undefined): {
  active: GrnJvView[];
  reversed: GrnJvView[];
  isLoading: boolean;
  isError: boolean;
} {
  const buCode = useBuCode();
  const targets = collectTargets(grn);

  const results = useQueries({
    queries: targets.map((t) => ({
      queryKey: ["grn-journal-voucher", buCode, t.jvId],
      queryFn: () => fetchGrnJv(buCode!, t.jvId),
      enabled: !!buCode,
      ...CACHE_DYNAMIC,
    })),
  });

  const active: GrnJvView[] = [];
  const reversed: GrnJvView[] = [];
  targets.forEach((t, i) => {
    const jv = results[i]?.data;
    if (!jv) return;
    const view: GrnJvView = { jv, apInvoice: t.apInvoice, kind: t.kind };
    (t.kind === "active" ? active : reversed).push(view);
  });

  return { active, reversed, isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}

/** สร้าง AP invoice จาก GRN ที่ commit แล้ว — สำเร็จแล้ว refetch ใบ GRN ให้แท็บ JV ขึ้น */
export function useCreateGrnApInvoice(grnId: string) {
  return useApiMutation<void>({
    mutationFn: (_v, buCode) =>
      httpClient.post(API_ENDPOINTS.GRN_CREATE_AP_INVOICE(buCode, grnId), {}),
    invalidateKeys: [QUERY_KEYS.GOODS_RECEIVE_NOTES],
    errorMessage: "Failed to create AP invoice",
  });
}
