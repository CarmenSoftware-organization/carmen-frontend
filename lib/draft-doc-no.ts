/** เลขชั่วคราวของใบ draft ที่ยังไม่เคยส่ง (DRAFT-########) — ใบที่ได้เลขจริงแล้วลบไม่ได้ ทำได้แค่ void */
export function isDraftDocNo(no?: string | null): boolean {
  return !!no && no.startsWith("DRAFT-");
}
