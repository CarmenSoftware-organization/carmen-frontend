import { MockBadge } from "@/components/ui/mock-badge";

interface DisplayTemplateProps {
  readonly title: string;
  readonly description?: string;
  /** หน้านี้ยังเป็นข้อมูลตัวอย่าง → แสดงป้าย MOCK ข้างชื่อ */
  readonly mock?: boolean;
  readonly toolbar?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly filterBar?: React.ReactNode;
  readonly children: React.ReactNode;
}

export default function DisplayTemplate({
  title,
  description,
  mock = false,
  toolbar,
  actions,
  filterBar,
  children,
}: DisplayTemplateProps) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {mock && <MockBadge />}
        </div>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>

      {(toolbar || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-2">{toolbar}</div>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </div>
      )}
      {filterBar}
      {children}
    </div>
  );
}
