import { Badge } from "@/components/ui/badge";

/**
 * ป้าย "MOCK" ข้างชื่อหน้า — บอกว่าหน้านี้ยังเป็นข้อมูลตัวอย่าง (ไม่ได้อ่าน/เขียน backend)
 *
 * อย่า render เองในหน้า ให้ส่ง `mock` เข้า `ListPageShell` / `DocumentListHeader` /
 * `DocFormHeader` / `DisplayTemplate` แทน — ถอด `mock` ออกเมื่อหน้านั้นต่อ API จริงแล้ว
 */
export function MockBadge() {
  return (
    <Badge
      variant="destructive"
      size="sm"
      className="shrink-0 font-bold tracking-wider"
      title="Mock data — not loaded from or saved to the server"
    >
      MOCK
    </Badge>
  );
}
