import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import {
  CATEGORY_REPORT_FILTER_KEYS,
  PRODUCT_CATEGORY_REPORT_NAME,
  type CategoryReportFilters,
} from "./use-category-report";

const ALL = "ALL";

export interface CategoryReportNode {
  readonly code: string;
  readonly name: string;
}

interface RangeOption {
  value: string;
  label: string;
}

interface CategoryReportDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** "print" เปิด viewer · "export" ดาวน์โหลด CSV — ปุ่มยืนยันเปลี่ยนตามนี้ */
  readonly mode: "print" | "export";
  readonly categories: readonly CategoryReportNode[];
  readonly subCategories: readonly CategoryReportNode[];
  readonly itemGroups: readonly CategoryReportNode[];
  readonly busy?: boolean;
  /** คืน true เมื่อทำสำเร็จ → dialog ปิดเอง */
  readonly onSubmit: (filters: CategoryReportFilters) => Promise<boolean>;
}

/**
 * ตัวเลือกของช่วงรหัส: "ทั้งหมด" แล้วตามด้วยรหัสเรียงแบบเดียวกับรายงาน (เทียบทีละตัวอักษร
 * ไม่ใช่ตามตัวเลข — "10" มาก่อน "2" เหมือน f_product_category) รหัสซ้ำแสดงครั้งเดียว
 */
function rangeOptions(
  nodes: readonly CategoryReportNode[],
  allLabel: string,
): RangeOption[] {
  const seen = new Set<string>();
  const options = nodes
    .filter((n) => n.code !== "" && !seen.has(n.code) && seen.add(n.code))
    .map((n) => ({ value: n.code, label: `${n.code} : ${n.name}` }))
    .sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
  return [{ value: ALL, label: allLabel }, ...options];
}

const EMPTY_FILTERS = Object.fromEntries(
  CATEGORY_REPORT_FILTER_KEYS.map((k) => [k, ALL]),
) as CategoryReportFilters;

/**
 * พารามิเตอร์ของ Product Category Report (ตามตัวอย่างระบบเดิม): ช่วงรหัส From / To ของ
 * Category, Sub Category และ Item Group — ไม่เลือก = ทั้งหมด ค่าที่เลือกค้างไว้จนออกจากหน้า
 * ให้กดพิมพ์แล้วกด Export ด้วยช่วงเดิมได้
 */
export function CategoryReportDialog({
  open,
  onOpenChange,
  mode,
  categories,
  subCategories,
  itemGroups,
  busy = false,
  onSubmit,
}: CategoryReportDialogProps) {
  const t = useTranslations("productManagement.category");
  const tc = useTranslations("common");
  const [filters, setFilters] = useState<CategoryReportFilters>(EMPTY_FILTERS);

  const levels = [
    {
      key: "Category",
      label: t("nodeCategory"),
      options: rangeOptions(categories, tc("all")),
    },
    {
      key: "SubCategory",
      label: t("nodeSubcategory"),
      options: rangeOptions(subCategories, tc("all")),
    },
    {
      key: "ItemGroup",
      label: t("nodeItemGroup"),
      options: rangeOptions(itemGroups, tc("all")),
    },
  ] as const;

  const handleSubmit = async () => {
    if (await onSubmit(filters)) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-3 p-4 sm:max-w-2xl">
        <DialogHeader className="shrink-0 gap-0 pb-1">
          <DialogTitle className="text-sm">
            {PRODUCT_CATEGORY_REPORT_NAME}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === "print" ? t("reportPrintHint") : t("reportExportHint")}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {levels.flatMap(({ key, label, options }) =>
            (["From", "To"] as const).map((end) => {
              const name = `${key}${end}` as keyof CategoryReportFilters;
              return (
                <Field key={name}>
                  <FieldLabel className="text-xs">
                    {end === "From"
                      ? t("reportFrom", { level: label })
                      : t("reportTo", { level: label })}
                  </FieldLabel>
                  <LookupCombobox<RangeOption>
                    value={filters[name]}
                    // คลิกแถวที่เลือกอยู่ = ล้างค่า → กลับเป็นทั้งหมด · เลือกครั้งแรกตอนสองฝั่งเป็นทั้งหมด
                    // คัดลอกไปอีกฝั่งด้วย (รหัสเดียว = กดครั้งเดียว) เหมือน dialog ของหน้ารายงาน
                    onValueChange={(v) =>
                      setFilters((f) => {
                        const other =
                          `${key}${end === "From" ? "To" : "From"}` as keyof CategoryReportFilters;
                        const value = v || ALL;
                        const copy =
                          value !== ALL && f[name] === ALL && f[other] === ALL;
                        return {
                          ...f,
                          [name]: value,
                          ...(copy ? { [other]: value } : {}),
                        };
                      })
                    }
                    items={options}
                    getId={(o) => o.value}
                    getLabel={(o) => o.label}
                    getSearchValue={(o) => o.label}
                    defaultLabel={tc("all")}
                    popoverWidth="w-[min(92vw,28rem)]"
                    popoverAlign="start"
                    renderItem={(o) => (
                      <span className="min-w-0 flex-1 truncate text-left">
                        {o.label}
                      </span>
                    )}
                    size="sm"
                    className="w-full"
                    modal
                  />
                </Field>
              );
            }),
          )}
        </FieldGroup>

        <DialogFooter className="shrink-0 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="sm:mr-auto"
            disabled={busy}
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            {t("reportReset")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void handleSubmit()}
          >
            {mode === "print" ? tc("print") : tc("export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
