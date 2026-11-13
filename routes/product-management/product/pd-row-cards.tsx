/**
 * แถวของตารางในฟอร์มสินค้าเมื่อกล่องแคบ (< 560px วัดจากกล่องเอง) — การ์ดทีละใบแทนตารางที่ถูกบีบ
 * (skill `carmen-blue-ui-design` §Tables: table on a detail page) หน้าตาเดียวกับ `CertificateCards`
 * ของ vendor · การ์ดต้องพกทุกช่องของตาราง ไม่ใช่แค่ช่องหลัก
 */
export const ROW_CARDS_BELOW = 560;

export function RowCards({ children }: { readonly children: React.ReactNode }) {
  return <ul className="flex flex-col gap-2">{children}</ul>;
}

export function RowCard({
  title,
  subtitle,
  badge,
  actions,
  children,
}: {
  readonly title: React.ReactNode;
  readonly subtitle?: React.ReactNode;
  /** มุมขวาบน — สถานะของแถว */
  readonly badge?: React.ReactNode;
  /** มุมขวาล่าง — ปุ่มของแถว (สูง 32px: `size="icon-sm"`) */
  readonly actions?: React.ReactNode;
  /** `RowCardField` ของช่องที่เหลือ */
  readonly children?: React.ReactNode;
}) {
  return (
    <li className="border-border/60 bg-card rounded-lg border p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium break-words">{title}</div>
          {subtitle && (
            <div className="text-muted-foreground break-words">{subtitle}</div>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {(children || actions) && (
        <div className="mt-2 flex items-end justify-between gap-2">
          <dl className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
            {children}
          </dl>
          {actions && (
            <div className="flex shrink-0 items-center gap-1">{actions}</div>
          )}
        </div>
      )}
    </li>
  );
}

export function RowCardField({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
