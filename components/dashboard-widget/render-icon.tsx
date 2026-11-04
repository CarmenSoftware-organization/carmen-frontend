import {
  AreaChart,
  BarChart3,
  Gauge,
  Hash,
  LineChart,
  PieChart,
  Table,
  type LucideIcon,
} from "lucide-react";

const RENDER_ICON: Record<string, LucideIcon> = {
  kpi: Hash,
  gauge: Gauge,
  pie: PieChart,
  bar: BarChart3,
  line: LineChart,
  area: AreaChart,
  table: Table,
};

/**
 * icon ของชนิดกราฟ — ใช้ร่วมระหว่างปุ่มเปลี่ยนชนิดบนการ์ดกับตัวเลือกใน pop up เพิ่ม widget
 * ชนิดที่ไม่มีใน map ใช้ icon แท่ง
 */
export function RenderIcon({
  type,
  className,
}: {
  readonly type: string;
  readonly className?: string;
}) {
  const Icon = RENDER_ICON[type] ?? BarChart3;
  return <Icon className={className} aria-hidden="true" />;
}
