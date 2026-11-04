import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type { JvPrefixMaster } from "@/types/accounting-master";

export type GlJvPrefixOption = { value: string; label: string };

/**
 * ตัวเลือก JV prefix ของ BU (ชุดเดียวกับที่จัดการใน `/config/jv-prefix`)
 *
 * query key และรูปร่างข้อมูลใน cache ตรงกับ `routes/config/jv-prefix/jv-prefix-page.tsx`
 * (`JvPrefixMaster[]`) เพื่อให้สองหน้าใช้ cache ร่วมกัน — แปลงเป็น option ด้วย `select`
 * เท่านั้น ห้ามเก็บ option ลง cache ไม่งั้นหน้า jv-prefix จะได้ข้อมูลผิดรูป
 *
 * @returns options `{ value: id, label: "code — description" }` และสถานะโหลด
 */
export function useGlJvPrefixOptions(): {
  options: GlJvPrefixOption[];
  isLoading: boolean;
} {
  const buCode = useBuCode();
  const query = useQuery({
    queryKey: ["accounting-master", "jv-prefixes", buCode],
    enabled: !!buCode,
    queryFn: async (): Promise<JvPrefixMaster[]> => {
      const res = await httpClient.get(API_ENDPOINTS.GL_JV_PREFIXES(buCode!));
      if (!res.ok) throw await ApiError.from(res, "Unable to load JV prefixes");
      const json = await res.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
    select: (rows): GlJvPrefixOption[] =>
      rows.map((row) => ({
        value: row.id,
        label: `${row.code} — ${row.description}`,
      })),
  });
  return { options: query.data ?? [], isLoading: query.isPending };
}
