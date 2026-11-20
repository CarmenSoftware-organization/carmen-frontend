import { Link } from "react-router";
import { isDevAppEnv } from "@/lib/runtime-config";
import type { LineDimensionAccount } from "@/lib/line-dimension-rules";

interface LineDimensionSourceChipProps {
  readonly account: LineDimensionAccount;
}

/**
 * สร้างลิงก์ไปหน้าผังการผูกบัญชี (แท็บ GL) กรองตามแถว mapping ที่ให้บัญชีนี้
 * ชื่อ query param ตรงกับ `coam-filter-fields.ts` (`location_id` / `product_item_group_id` /
 * `movement` / `adjustment_type_id` — ค่าดิบ id เดียว) และ `tab=GL` ตาม `coam-component.tsx`
 */
function buildAccountSourceHref(account: LineDimensionAccount): string {
  const params = new URLSearchParams({ tab: "GL" });
  if (account.location_id) params.set("location_id", account.location_id);
  if (account.item_group_id) {
    params.set("product_item_group_id", account.item_group_id);
  }
  if (account.movement) params.set("movement", account.movement);
  if (account.adjustment_type_id) {
    params.set("adjustment_type_id", account.adjustment_type_id);
  }
  return `/config/chart-of-account-mapping?${params.toString()}`;
}

/**
 * ชิปสำหรับทีม dev: บอกว่าบัญชี GL ของบรรทัดมาจาก mapping แถวไหน
 * แสดงเฉพาะ `isDevAppEnv()` (APP_ENV = dev / local) — บน prod ไม่ render อะไรเลย
 * ข้อความภาษาอังกฤษคงที่โดยตั้งใจ (เครื่องมือ debug ไม่ผ่าน i18n)
 */
export function LineDimensionSourceChip({
  account,
}: LineDimensionSourceChipProps) {
  if (!isDevAppEnv()) return null;
  const text =
    `GL ${account.movement}: ${account.account_code ?? "—"} · ` +
    (account.source ?? account.issue ?? "—") +
    (account.adjustment_type_id ? ` · ${account.adjustment_type_id}` : "");
  return (
    <Link
      to={buildAccountSourceHref(account)}
      tabIndex={-1}
      title={text}
      className="text-muted-foreground border-border hover:bg-accent inline-flex h-6 items-center rounded-md border border-dashed px-2 font-mono text-xs"
    >
      {text}
    </Link>
  );
}
