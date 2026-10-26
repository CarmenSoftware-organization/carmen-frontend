import { useState, type ComponentProps } from "react";
import { DatabaseIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { useDashboardDatasets } from "@/hooks/use-dashboard-dataset";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import { LookupCombobox } from "./lookup-combobox";
import { Badge } from "../ui/badge";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const SHAPE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  scalar: { label: "Scalar", variant: "info-light" },
  scalar_delta: { label: "Scalar Δ", variant: "success-light" },
  time_series: { label: "Time Series", variant: "primary-light" },
  categorical: { label: "Categorical", variant: "warning-light" },
  ranked: { label: "Ranked", variant: "invert-light" },
  matrix: { label: "Matrix", variant: "destructive-light" },
};

const getShapeBadge = (shape: string) =>
  SHAPE_BADGE[shape] ?? {
    label: shape.replaceAll("_", " "),
    variant: "outline" as const,
  };

interface LookupDatasetProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (dataset: DashboardDataset) => void;
  readonly excludeIds?: Set<string>;
  readonly extraItems?: readonly DashboardDataset[];
  readonly category?: string;
  readonly shape?: string;
  readonly shapes?: readonly string[];
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly defaultLabel?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
  /** คุมการเปิดจากข้างนอก (เช่นปุ่มใน empty state ของ dashboard) — ส่ง `open` แล้วต้องรับ `onOpenChange` ด้วย */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

export function LookupDataset({
  value,
  onValueChange,
  onItemChange,
  excludeIds,
  extraItems,
  category,
  shape,
  shapes,
  disabled,
  placeholder,
  defaultLabel,
  className,
  size,
  error,
  open,
  onOpenChange,
}: LookupDatasetProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  // Lazy: เรียก API ต่อเมื่อผู้ใช้คลิกเปิด lookup ครั้งแรกเท่านั้น
  const [hasOpened, setHasOpened] = useState(false);
  const { data, isLoading } = useDashboardDatasets(hasOpened || !!open);

  const datasets = [...(extraItems ?? []), ...(data?.items ?? [])].filter(
    (d) => {
      if (excludeIds?.has(d.id)) return false;
      if (category && d.category !== category) return false;
      if (shape && d.shape !== shape) return false;
      if (shapes && !shapes.includes(d.shape)) return false;
      return true;
    },
  );

  return (
    <LookupCombobox<DashboardDataset>
      resizeKey="dataset"
      size={size}
      value={value}
      onValueChange={(id, item) => {
        onValueChange(id);
        if (item) onItemChange?.(item);
      }}
      open={open}
      onOpenChange={(next) => {
        if (next) setHasOpened(true);
        onOpenChange?.(next);
      }}
      items={datasets}
      getId={(d) => d.id}
      getLabel={(d) => d.name}
      getSearchValue={(d) =>
        `${d.id} ${d.name} ${d.description} ${d.category} ${d.shape}`
      }
      renderItem={(d) => {
        const badge = getShapeBadge(d.shape);
        return (
          <div className="flex w-full items-center justify-between gap-2">
            <p className="truncate">{d.name}</p>
            <Badge variant={badge.variant} size="xs" className="shrink-0">
              {badge.label}
            </Badge>
          </div>
        );
      }}
      renderSelected={(d) => d.name}
      defaultLabel={defaultLabel}
      placeholder={placeholder ?? tl("select", { entity: tfl("dataset") })}
      searchPlaceholder={tl("search", { entity: tfl("dataset") })}
      disabled={disabled}
      className={className}
      popoverWidth="w-96"
      popoverAlign="start"
      emptyIcon={DatabaseIcon}
      emptyTitle={tl("noFound", { entity: tfl("dataset") })}
      emptyDescription={tl("noFoundDesc")}
      isLoading={isLoading}
      error={error}
    />
  );
}
