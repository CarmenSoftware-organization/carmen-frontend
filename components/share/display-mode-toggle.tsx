import { LayoutGrid, LayoutList, PanelRight } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DisplayMode = "list" | "grid" | "preview";

const MODE_ICON = {
  list: LayoutList,
  grid: LayoutGrid,
  preview: PanelRight,
} as const;

const MODE_LABEL_KEY = {
  list: "aria.listView",
  grid: "aria.gridView",
  preview: "aria.previewView",
} as const;

interface DisplayModeToggleProps<M extends DisplayMode> {
  readonly value: M;
  readonly onChange: (mode: M) => void;
  /** ลำดับปุ่ม — ค่าตั้งต้นคือคู่ list/grid ที่หน้าส่วนใหญ่ใช้ */
  readonly modes?: readonly M[];
  readonly className?: string;
}

/**
 * ปุ่มสลับมุมมองของหน้า list — ที่เดียวที่วาดปุ่มชุดนี้ทั้งแอป
 * (เคยถูกก๊อปไว้ใน ConfigListTemplate, ListToolbar และอีก 9 หน้า)
 * ค่าตั้งต้นคือคู่ตาราง/การ์ด · หน้าที่มีมุมมองพรีวิว (Document) ส่ง `modes` เพิ่มเอง
 * คนละเรื่องกับ `ViewModeToggle` ซึ่งสลับ my-pending / all-documents
 */
export function DisplayModeToggle<M extends DisplayMode>({
  value,
  onChange,
  modes = ["list", "grid"] as unknown as readonly M[],
  className,
}: DisplayModeToggleProps<M>) {
  const tc = useTranslations("common");
  return (
    <div className={cn("flex items-center rounded-md border", className)}>
      {modes.map((mode) => {
        const key: DisplayMode = mode;
        const Icon = MODE_ICON[key];
        return (
          <Button
            key={mode}
            size="icon-sm"
            variant={value === mode ? "secondary" : "ghost"}
            onClick={() => onChange(mode)}
            aria-label={tc(MODE_LABEL_KEY[key])}
            aria-pressed={value === mode}
          >
            <Icon className="size-4" />
          </Button>
        );
      })}
    </div>
  );
}
