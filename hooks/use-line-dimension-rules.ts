import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useLineDimensionsEnabled } from "@/hooks/use-line-dimensions-enabled";
import {
  fetchLineDimensionRules,
  type LineDimensionRuleInput,
  type LineDimensionRuleResult,
} from "@/lib/line-dimension-rules";
import type { LineDimensionDocType } from "@/lib/line-dimension-scope";

const EMPTY_MAP = new Map<string, LineDimensionRuleResult>();

/**
 * ดึงกฎ dimension ของบรรทัดเอกสารตาม mapping ของบัญชี
 * ไม่ยิงเมื่อเอกสารชนิดนี้ปิด dimension หรือไม่มีบรรทัด
 *
 * @param docType - ชนิดเอกสาร
 * @param lines - บรรทัด (ซ้ำ key ถูกตัดให้เหลือตัวเดียว)
 */
export function useLineDimensionRules(
  docType: LineDimensionDocType,
  lines: LineDimensionRuleInput[],
) {
  const buCode = useBuCode();
  const enabled = useLineDimensionsEnabled(docType);
  const inputs = useMemo(() => {
    const byKey = new Map<string, LineDimensionRuleInput>();
    for (const line of lines) byKey.set(line.key, line);
    return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [lines]);

  const query = useQuery({
    queryKey: ["line-dimension-rules", buCode, docType, inputs],
    enabled: enabled && !!buCode && inputs.length > 0,
    staleTime: 60_000,
    queryFn: () => fetchLineDimensionRules(buCode!, inputs),
  });

  const byKey = useMemo(() => {
    if (!query.data) return EMPTY_MAP;
    return new Map(query.data.map((result) => [result.key, result]));
  }, [query.data]);

  return {
    byKey,
    isPending: query.isPending && query.fetchStatus !== "idle",
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
