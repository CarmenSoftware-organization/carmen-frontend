import { useMutation } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type { RunReportPayload } from "@/types/report";

export interface ExportReportResult {
  blob: Blob;
  fileName: string | null;
  rowCount: number | null;
}

export function useExportReportMutation() {
  const buCode = useBuCode();
  return useMutation<ExportReportResult, ApiError, RunReportPayload>({
    mutationFn: async (payload) => {
      const res = await httpClient.post(
        `${API_ENDPOINTS.REPORTS(buCode!)}/export`,
        payload,
      );
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to export report");
      }
      const blob = await res.blob();
      // header อาจอ่านไม่ได้ถ้า deployment ไม่ expose (CORS) — ตกเป็น null แล้วให้ผู้เรียกใช้ค่าสำรอง
      const disposition = res.headers.get("content-disposition");
      const fileName = disposition?.match(/filename="([^"]+)"/)?.[1] ?? null;
      const rawCount = res.headers.get("x-row-count");
      const parsedCount = rawCount === null ? Number.NaN : Number(rawCount);
      return {
        blob,
        fileName,
        rowCount: Number.isFinite(parsedCount) ? parsedCount : null,
      };
    },
  });
}
