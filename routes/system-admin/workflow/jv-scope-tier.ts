/**
 * ระดับของขอบเขต workflow ชนิด JV (กฎเดียวกับ backend)
 * 1 = ระบุทั้ง prefix และที่มา · 2 = ระบุ prefix อย่างเดียว · 3 = ระบุที่มาอย่างเดียว ·
 * 4 = ไม่ระบุเลย (catch-all) — เลขน้อยชนะ และทับกันได้เฉพาะระดับต่างกัน
 * @param scope - ขอบเขตของ workflow (ว่าง = ทุกค่า)
 * @returns ระดับ 1-4
 */
export function jvScopeTier(scope: {
  prefix_ids: string[];
  sources: string[];
}): 1 | 2 | 3 | 4 {
  const hasPrefix = scope.prefix_ids.length > 0;
  const hasSource = scope.sources.length > 0;
  if (hasPrefix && hasSource) return 1;
  if (hasPrefix) return 2;
  if (hasSource) return 3;
  return 4;
}
