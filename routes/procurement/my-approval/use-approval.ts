import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { buildUrl } from "@/lib/build-query-string";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type {
  ApprovalItem,
  ApprovalPendingSummary,
  RawApprovalUnified,
} from "@/types/approval";
import type { PaginatedResponse, ParamsDto } from "@/types/params";
import { CACHE_DYNAMIC } from "@/lib/cache-config";

const DEFAULT_PERPAGE = 10;

/**
 * แปลงหนึ่งแถวจาก view sys_v_my_pending ให้เป็น ApprovalItem
 *
 * แถวมาในโครงเดียวกันทุกประเภทแล้ว การ normalize จึงเหลือแค่เปลี่ยนชื่อฟิลด์ให้ตรง
 * กับที่ตารางใช้และแทน null ด้วยค่าว่าง ไม่ต้องมี normalizer แยกต่อประเภทเหมือนก่อน
 * @param item - แถวดิบจาก API
 * @returns ApprovalItem สำหรับแสดงในหน้า approval
 */
function normalizeApproval(item: RawApprovalUnified): ApprovalItem {
  return {
    id: item.id,
    doc_type: item.doc_type,
    doc_no: item.doc_no ?? "",
    doc_date: item.doc_date ?? "",
    description: item.description ?? "",
    status: item.doc_status ?? "",
    workflow_name: item.workflow_name ?? "",
    workflow_current_stage: item.workflow_current_stage ?? "",
    workflow_next_stage: item.workflow_next_stage,
    workflow_previous_stage: item.workflow_previous_stage,
    last_action: item.last_action,
    requestor_name: item.requestor_name ?? "",
    department_name: item.department_name ?? "",
    vendor_name: item.counterparty_name ?? "",
    total_amount: item.total_amount ?? 0,
    delivery_date: item.due_date,
    bu_code: item.bu_code,
    bu_name: item.bu_name ?? "",
    currency_code: item.currency_code ?? "",
  };
}

/**
 * Hook ดึงรายการเอกสารที่รออนุมัติ (PR/PO/SR) เป็นรายการเดียวที่เรียงและแบ่งหน้าจาก backend
 *
 * ยิง GET /api/my-pending ซึ่งอ่านจาก view sys_v_my_pending — `filter` (เช่น `doc_type:pr`),
 * `search`, `sort`, `page`, `perpage` ส่งตรงไปให้ SQL ทำทั้งหมด ไม่มีการกรองฝั่ง client แล้ว
 * ทำให้ `paginate.total` เป็นจำนวนจริงของรายการที่เข้าเงื่อนไข ไม่ใช่จำนวนแถวบนหน้าปัจจุบัน
 * ใช้ CACHE_DYNAMIC (staleTime 1 นาที) เพราะสถานะอนุมัติเปลี่ยนบ่อย
 * @param params - พารามิเตอร์ filter/search/sort/paginate
 * @returns UseQueryResult ของ PaginatedResponse<ApprovalItem>
 * @example
 * const { data } = useApprovalPending({ search: "PR-2025", filter: "doc_type:pr" });
 */
export function useApprovalPending(params?: ParamsDto) {
  const buCode = useBuCode();

  return useQuery<PaginatedResponse<ApprovalItem>>({
    queryKey: [QUERY_KEYS.APPROVAL_PENDING, buCode, params],
    queryFn: async () => {
      if (!buCode) throw new Error("Missing buCode");
      const url = buildUrl(API_ENDPOINTS.APPROVAL_PENDING, {
        bu_code: buCode,
        ...params,
      });
      const res = await httpClient.get(url);
      if (!res.ok) throw new Error("Failed to fetch pending approvals");
      const json = await res.json();
      const rows: RawApprovalUnified[] = json.data ?? [];

      return {
        data: rows.map(normalizeApproval),
        paginate: json.paginate ?? {
          total: rows.length,
          page: Number(params?.page ?? 1),
          perpage: Number(params?.perpage ?? DEFAULT_PERPAGE),
          pages: 1,
        },
      };
    },
    enabled: !!buCode,
    ...CACHE_DYNAMIC,
  });
}

/**
 * Hook ดึงสรุปจำนวนเอกสารที่รออนุมัติแยกตามประเภท (PR/PO/SR)
 * ใช้ในการ์ดสรุปด้านบนของหน้า approval และ badge บน sidebar
 * ใช้ CACHE_DYNAMIC (staleTime 1 นาที) ไม่ต้องมี buCode
 * @returns UseQueryResult ของ ApprovalPendingSummary
 * @example
 * const { data: summary } = useApprovalPendingSummary();
 * <Badge>{summary?.pr ?? 0}</Badge>
 */
export function useApprovalPendingSummary() {
  return useQuery<ApprovalPendingSummary>({
    queryKey: [QUERY_KEYS.APPROVAL_PENDING_SUMMARY],
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.APPROVAL_PENDING_SUMMARY);
      if (!res.ok) throw new Error("Failed to fetch approval summary");
      const json = await res.json();
      return json.data;
    },
    ...CACHE_DYNAMIC,
  });
}
