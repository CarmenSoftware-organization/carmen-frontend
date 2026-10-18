import { Link } from "react-router";

interface EquipmentCountLinkProps {
  readonly categoryId: string;
  readonly count: number | undefined;
}

/**
 * จำนวนอุปกรณ์ในหมวด — กดแล้วไปหน้า equipment ที่กรองหมวดนี้ไว้แล้ว
 * (ค่าใน URL ตรงกับที่ EntityMultiFilter ของ field `category` เขียน)
 *
 * backend ยังไม่ส่ง equipment_count (ก่อน deploy) = "—" ไม่ใช่ 0 ซึ่งจะโกหกว่าหมวดว่าง
 * ส่วน 0 ไม่ทำเป็นลิงก์ เพราะกดไปก็เจอหน้าว่าง
 */
export function EquipmentCountLink({
  categoryId,
  count,
}: EquipmentCountLinkProps) {
  if (count === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (count === 0) {
    return <span className="text-muted-foreground">0</span>;
  }
  const query = new URLSearchParams({
    category: `category_id|string:${categoryId}`,
  });
  return (
    <Link
      to={`/operation-plan/equipment?${query}`}
      className="text-primary focus-visible:ring-ring/50 font-semibold hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:outline-none"
      // ListCard เปิด dialog เมื่อกด/Enter ที่ใดก็ได้ในการ์ดยกเว้น button — ลิงก์ต้องกันเอง
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {count}
    </Link>
  );
}
