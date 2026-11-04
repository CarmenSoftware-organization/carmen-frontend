import { useState } from "react";
import { useTranslations } from "use-intl";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandInput } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VirtualCommandList } from "@/components/ui/virtual-command-list";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInventoryPeriodOptions } from "@/hooks/use-inventory-period-options";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { cn } from "@/lib/utils";
import type { DatasetParam } from "@/types/dashboard-widget";
import { lookupLabel, type LookupResource } from "@/types/lookup";
import {
  joinPicked,
  selectablePeriods,
  shouldShowAllOption,
  splitPicked,
} from "./widget-shape";

interface WidgetLookupFieldProps {
  readonly id: string;
  readonly param: DatasetParam;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}

interface PickRow {
  readonly id: string;
  readonly label: string;
}

const ROW_CLASS = cn(
  "relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs select-none",
  "hover:bg-accent hover:text-accent-foreground",
);

// token งวดที่ backend เข้าใจ — ขึ้นก่อนรหัสงวดเสมอ ผู้ใช้ส่วนใหญ่อยากได้ "งวดนี้เทียบงวดก่อน"
const PERIOD_TOKENS = ["@current_period", "@previous_period"] as const;

/**
 * ช่องเลือกจากรายการของ BU สำหรับ param ที่มี `lookup` — category / location / vendor /
 * department ดึงจาก Lookup API (ค้นที่ server, โหลดทีละหน้า, ยิงตอนเปิดเท่านั้น) ส่วนงวด
 * ใช้รายการงวดของรายงาน ค่าที่ส่งออกเป็น id คั่น `,` ตามสัญญาของ micro-data
 * ("" = ไม่กรอง) · `multi` = checkbox หลายค่า ไม่งั้นเลือกได้ค่าเดียว · ครบ `max` แล้ว
 * แถวที่ยังไม่ได้เลือกจะกดไม่ได้
 */
export function WidgetLookupField({
  id,
  param,
  value,
  onChange,
  disabled,
}: WidgetLookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 150);
  const t = useTranslations("dashboard.savedWidget");
  const tRange = useTranslations("dashboard.savedWidget.timeRange");
  const tc = useTranslations("common");

  // ค่าว่างของ param ที่มี default (เช่น periods = งวดนี้,งวดก่อน) backend ตีความเป็น
  // default — โชว์ตัวที่จะถูกใช้จริง ไม่ใช่ "ทั้งหมด"
  const effective =
    value === "" && typeof param.default === "string" ? param.default : value;
  const picked = splitPicked(effective);
  const pickedSet = new Set(picked);
  const isPeriod = param.lookup === "inventory_period";
  const multi = !!param.multi;
  const limit = multi ? param.max : 1;
  const atLimit = multi && !!limit && picked.length >= limit;

  const entity = useLookupResource(
    (isPeriod ? "location" : param.lookup) as LookupResource,
    {
      search: debouncedSearch,
      // department / location ค่าเริ่มต้นคือ "mine" — dashboard ต้องเลือกได้ทั้ง BU
      scope: "all",
      selectedIds: isPeriod ? [] : picked,
      enabled: open && !isPeriod,
    },
  );
  const periods = useInventoryPeriodOptions(
    isPeriod && (open || picked.length > 0),
  );

  // token บอกรหัสงวดที่ชี้อยู่ตอนนี้ด้วย ("งวดปัจจุบัน · 2610") และช่องหลายงวดซ่อนค่าที่ชี้
  // งวดเดียวกับที่เลือกแล้ว (selectablePeriods) — ไม่งั้นเลือกทั้ง token และรหัสเดียวกันซ้ำได้
  const tokenCode: Record<string, string | undefined> = {
    "@current_period": periods.data?.current,
    "@previous_period": periods.data?.previous,
  };
  const periodLabel = (v: string) => {
    const key = v.replace(/^@/, "");
    if (!v.startsWith("@") || !tRange.has(key)) return v;
    const code = tokenCode[v];
    return code ? `${tRange(key)} · ${code}` : tRange(key);
  };

  let rows: PickRow[];
  let selectedRows: PickRow[];
  let isLoading: boolean;
  if (isPeriod) {
    const q = search.trim().toLowerCase();
    const all = [...PERIOD_TOKENS, ...(periods.data?.codes ?? [])];
    // เลือกค่าเดียว = กดแถวอื่นเพื่อสลับ (token ↔ รหัสงวดเดียวกันได้) จึงตัดแค่ตัวที่เลือกอยู่
    const choices = multi
      ? selectablePeriods(all, picked, tokenCode)
      : all.filter((v) => !pickedSet.has(v));
    selectedRows = picked.map((v) => ({ id: v, label: periodLabel(v) }));
    rows = choices
      .map((v) => ({ id: v, label: periodLabel(v) }))
      .filter((r) => !q || r.label.toLowerCase().includes(q));
    isLoading = periods.isLoading && open;
  } else {
    const toRow = (it: {
      id: string;
      name: string | null;
      code: string | null;
    }) => ({
      id: it.id,
      label: lookupLabel({ ...it, description: null, status: "" }),
    });
    selectedRows = entity.selectedItems.map(toRow);
    // id ที่ชื่อยังโหลดไม่ถึง (หรือถูกลบไปแล้ว) ก็ต้องยกเลิกได้
    for (const pid of picked) {
      if (!selectedRows.some((r) => r.id === pid)) {
        selectedRows.push({ id: pid, label: pid });
      }
    }
    rows = entity.items.filter((it) => !pickedSet.has(it.id)).map(toRow);
    isLoading = entity.isLoading;
  }

  const toggle = (rowId: string) => {
    if (!multi) {
      onChange(pickedSet.has(rowId) ? "" : rowId);
      setOpen(false);
      return;
    }
    const next = pickedSet.has(rowId)
      ? picked.filter((p) => p !== rowId)
      : [...picked, rowId];
    onChange(joinPicked(next));
  };

  const firstName = selectedRows[0]?.label;
  const valueText =
    picked.length === 0
      ? t("lookupAll")
      : `${firstName}${picked.length > 1 ? ` +${picked.length - 1}` : ""}`;

  const renderRow = (row: PickRow, checked: boolean) => {
    const locked = !checked && atLimit;
    return (
      <label
        key={row.id}
        className={cn(ROW_CLASS, locked && "cursor-not-allowed opacity-50")}
      >
        <Checkbox
          checked={checked}
          disabled={locked}
          onCheckedChange={() => toggle(row.id)}
        />
        <span className="truncate">{row.label}</span>
      </label>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 w-full justify-between font-normal"
        >
          <span
            className={cn(
              "truncate text-sm",
              picked.length === 0 && "text-muted-foreground",
            )}
          >
            {valueText}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={param.label}
            className="placeholder:text-xs"
            value={search}
            onValueChange={setSearch}
          />
          <div className="p-1">
            {/* ไม่บังคับและไม่มี default = ล้างได้ ("" = ไม่กรอง) */}
            {shouldShowAllOption(param) && (
              <label className={ROW_CLASS}>
                <Checkbox
                  checked={picked.length === 0}
                  onCheckedChange={() => onChange("")}
                />
                <span className="truncate">{t("lookupAll")}</span>
              </label>
            )}
            {selectedRows.map((r) => renderRow(r, true))}
            {multi && !!limit && (
              <p className="text-muted-foreground text-micro px-2 py-1">
                {t("lookupPicked", { count: picked.length, max: limit })}
              </p>
            )}
            {isLoading ? (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                {tc("loading")}
              </div>
            ) : (
              <VirtualCommandList
                items={rows}
                maxHeight={240}
                estimateSize={28}
                onLoadMore={isPeriod ? undefined : entity.loadMore}
                hasMore={isPeriod ? false : entity.hasMore}
                isLoadingMore={isPeriod ? false : entity.isLoadingMore}
                emptyMessage={
                  <span className="text-muted-foreground text-xs">
                    {tc("noSearchResult")}
                  </span>
                }
              >
                {(row) => renderRow(row, false)}
              </VirtualCommandList>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
