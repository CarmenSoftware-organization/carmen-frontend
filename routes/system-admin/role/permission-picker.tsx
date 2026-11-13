import { useState } from "react";
import { useTranslations } from "use-intl";
import { KeySquare, Search, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePermissionAll } from "./use-permission";
import { usePermissionLabels } from "./use-permission-labels";
import {
  CATEGORY_META,
  DEFAULT_CATEGORY_META,
  getCategoryIds,
  getResourceIds,
  groupPermissions,
  sortedActions,
  type GroupedResource,
  type PermissionGroup,
  type PermissionRecord,
} from "./permission-catalog";
import { cn } from "@/lib/utils";
import { EmptyState } from "../shared/admin-ui";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type FilterMode = "all" | "granted" | "missing";

interface PermissionPickerProps {
  readonly value: string[];
  readonly onChange: (ids: string[]) => void;
  readonly disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getCheckedState(
  all: boolean,
  some: boolean,
): boolean | "indeterminate" {
  if (all) return true;
  if (some) return "indeterminate";
  return false;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export function PermissionPicker({
  value,
  onChange,
  disabled,
}: PermissionPickerProps) {
  const t = useTranslations("systemAdmin.role");
  const tc = useTranslations("common");
  const {
    categoryLabel: getCategoryLabel,
    resourceLabel: getResourceLabel,
    actionLabel,
  } = usePermissionLabels();
  const { data: permData, isLoading } = usePermissionAll();
  const permissions = (permData ?? []) as PermissionRecord[];

  const getCategoryMeta = (cat: string) =>
    CATEGORY_META[cat] ?? DEFAULT_CATEGORY_META;

  const grouped = groupPermissions(permissions, getResourceLabel);

  const selectedSet = new Set(value);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const q = search.trim().toLowerCase();
  const filteredGroups = grouped
    .map((g) => {
      const catMatch = getCategoryLabel(g.category).toLowerCase().includes(q);
      const resources = g.resources.filter((r) => {
        const labelMatch =
          !q || catMatch || getResourceLabel(r).toLowerCase().includes(q);
        if (!labelMatch) return false;
        if (filterMode === "all") return true;
        const ids = getResourceIds(r);
        const selectedCount = ids.filter((id) => selectedSet.has(id)).length;
        if (filterMode === "granted") return selectedCount > 0;
        return selectedCount < ids.length;
      });
      return { ...g, resources };
    })
    .filter((g) => g.resources.length > 0);

  const addIds = (ids: string[]) => {
    const next = new Set(value);
    for (const id of ids) next.add(id);
    onChange(Array.from(next));
  };
  const removeIds = (ids: string[]) => {
    const set = new Set(ids);
    onChange(value.filter((id) => !set.has(id)));
  };
  const handleTogglePermission = (id: string, checked: boolean) => {
    if (checked) addIds([id]);
    else removeIds([id]);
  };
  const handleToggleResource = (r: GroupedResource, checked: boolean) => {
    const ids = getResourceIds(r);
    if (checked) addIds(ids);
    else removeIds(ids);
  };
  const handleToggleCategory = (g: PermissionGroup, checked: boolean) => {
    const ids = getCategoryIds(g);
    if (checked) addIds(ids);
    else removeIds(ids);
  };
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (permissions.length === 0) {
    return (
      <EmptyState
        icon={KeySquare}
        title={t("noPermissions")}
        desc={t("noPermissionsDesc")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {/* ช่องค้นกว้างไม่เกิน 24rem และตัวกรองอยู่ติดกัน — ไม่ยืดช่องค้นเต็มจอกว้าง
          ที่ไม่พอ (มือถือ) ตัวกรองลงบรรทัดถัดไปเอง ไม่ต้องอิงขนาดจอ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm min-w-0 flex-1 basis-56">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("filterResourcePlaceholder")}
            className="h-8 pr-9 pl-9 text-xs"
            aria-label={t("filterResourcePlaceholder")}
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={tc("clearSearch")}
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
            >
              <X />
            </Button>
          )}
        </div>
        <div
          className="border-border/60 bg-muted/40 inline-flex items-center gap-0.5 rounded-full border p-0.5"
          role="tablist"
          aria-label={tc("filter")}
        >
          {(["all", "granted", "missing"] as FilterMode[]).map((m) => {
            const active = filterMode === m;
            const labelKey =
              m === "all"
                ? "showAll"
                : m === "granted"
                  ? "showGranted"
                  : "showMissing";
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterMode(m)}
                className={cn(
                  "text-micro rounded-full px-2 py-1 font-semibold transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Matrices */}
      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("noMatch")}
          desc={t("noMatchDesc", { query: search })}
        />
      ) : (
        // โมดูลไหลเป็นคอลัมน์ (CSS multi-column) — การ์ดโมดูลสูงไม่เท่ากัน (4–30 แถว) กริดจะเหลือ
        // ที่ว่างใต้ใบเตี้ย · 30rem = กว้างพอให้ชื่อ + ปุ่ม 4 ตัวอยู่บรรทัดเดียว · เพดาน 6 คอลัมน์:
        // ที่ 4K เบราว์เซอร์แบ่งได้ 7 แต่ใบที่สูงสุด (Configuration) ทำให้ใช้จริงแค่ 6 เหลือคอลัมน์ว่าง
        // ทางขวา · เพดานเป็นค่าคงที่ ไม่ใช่จำนวนโมดูล: กรองแล้วเหลือโมดูลเดียว การ์ดต้องไม่ยืดเต็มจอ
        // · -mb-5 หัก mb-5 ของใบล่างสุด
        <div className="-mb-5 gap-x-5" style={{ columns: "30rem 6" }}>
          {filteredGroups.map((group) => (
            <ModuleMatrix
              key={group.category}
              group={group}
              categoryLabel={getCategoryLabel(group.category)}
              categoryMeta={getCategoryMeta(group.category)}
              selectedSet={selectedSet}
              disabled={disabled}
              getResourceLabel={getResourceLabel}
              actionLabel={actionLabel}
              onToggleCategory={(c) => handleToggleCategory(group, c)}
              onToggleResource={handleToggleResource}
              onTogglePermission={handleTogglePermission}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ModuleMatrix — one matrix per category                              */
/* ------------------------------------------------------------------ */

interface ModuleMatrixProps {
  readonly group: PermissionGroup;
  readonly categoryLabel: string;
  readonly categoryMeta: (typeof CATEGORY_META)[string];
  readonly selectedSet: Set<string>;
  readonly disabled?: boolean;
  readonly getResourceLabel: (r: GroupedResource) => string;
  readonly actionLabel: (action: string) => string;
  readonly onToggleCategory: (checked: boolean) => void;
  readonly onToggleResource: (r: GroupedResource, checked: boolean) => void;
  readonly onTogglePermission: (id: string, checked: boolean) => void;
}

function ModuleMatrix({
  group,
  categoryLabel,
  categoryMeta,
  selectedSet,
  disabled,
  getResourceLabel,
  actionLabel,
  onToggleCategory,
  onToggleResource,
  onTogglePermission,
}: ModuleMatrixProps) {
  const t = useTranslations("systemAdmin.role");
  const Icon = categoryMeta.icon;
  const allIds = getCategoryIds(group);
  const total = allIds.length;
  const selected = allIds.filter((id) => selectedSet.has(id)).length;
  const allChecked = total > 0 && selected === total;
  const someChecked = selected > 0 && selected < total;

  return (
    <section className="bg-card @container mb-5 break-inside-avoid overflow-hidden rounded-xl border shadow-sm">
      {/* Module header — neutral chrome; wayfinding by icon shape + name (single
          accent reserved for interactive/selected state, per DESIGN.md) */}
      <header className="bg-muted/30 flex items-center gap-3 border-b px-4 py-3">
        <Icon
          className="text-muted-foreground size-5 shrink-0"
          aria-hidden="true"
        />
        <h3
          className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold tracking-tight"
          title={categoryLabel}
        >
          {categoryLabel}
        </h3>
        <span className="text-muted-foreground text-micro tabular-nums">
          {selected}/{total}
        </span>
        <label
          className={cn(
            "bg-card text-foreground border-border/60 text-micro inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-semibold transition-colors",
            disabled
              ? "cursor-not-allowed opacity-60"
              : "hover:border-primary/40 cursor-pointer",
          )}
        >
          <Checkbox
            checked={getCheckedState(allChecked, someChecked)}
            onCheckedChange={(c) => onToggleCategory(!!c)}
            disabled={disabled}
            aria-label={t("selectAllCategory", { category: categoryLabel })}
          />
          {/* การ์ดแคบกว่า 320px (มือถือ): เหลือแค่ช่องติ๊ก ไม่งั้นชื่อโมดูลถูกตัดเหลือครึ่งคำ —
              ช่องติ๊กมี aria-label ของตัวเอง ป้ายนี้จึงซ่อนจากทุกคนได้ */}
          <span className="hidden @xs:inline">{t("grantAll")}</span>
        </label>
      </header>

      {/* แถว resource — ไม่มี header row: แต่ละ checkbox พก label ของตัวเอง
          และโชว์เฉพาะ action ที่ resource นั้นมีจริง เลยไม่ต้องตรึงคอลัมน์
          (layout เดียวใช้ทุกขนาดจอ — แถวยาวเกินก็ wrap เอง) */}
      <div className="divide-border/50 divide-y">
        {group.resources.map((r) => (
          <ResourceRow
            key={r.resource}
            resource={r}
            label={getResourceLabel(r)}
            actionLabel={actionLabel}
            selectedSet={selectedSet}
            disabled={disabled}
            onToggleResource={(c) => onToggleResource(r, c)}
            onTogglePermission={onTogglePermission}
          />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* ResourceRow — one resource: labelled checkboxes, only real actions   */
/* ------------------------------------------------------------------ */

interface ResourceRowProps {
  readonly resource: GroupedResource;
  readonly label: string;
  readonly actionLabel: (action: string) => string;
  readonly selectedSet: Set<string>;
  readonly disabled?: boolean;
  readonly onToggleResource: (checked: boolean) => void;
  readonly onTogglePermission: (id: string, checked: boolean) => void;
}

function ResourceRow({
  resource,
  label,
  actionLabel,
  selectedSet,
  disabled,
  onToggleResource,
  onTogglePermission,
}: ResourceRowProps) {
  const t = useTranslations("systemAdmin.role");
  const ids = getResourceIds(resource);
  const rowSelected = ids.filter((id) => selectedSet.has(id)).length;
  const allOn = rowSelected === ids.length;
  const someOn = rowSelected > 0 && !allOn;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2",
        allOn ? "bg-muted/40" : "bg-card",
      )}
    >
      {/* ชื่อกว้างคงที่ ปุ่มต่อท้ายทันที — เดิมชื่อยืด (flex-1) ดันปุ่มไปชิดขวาการ์ด บนการ์ดกว้าง
          ปุ่มอยู่ห่างจากชื่อเป็นร้อยพิกเซล และปุ่มของแต่ละแถวไม่ตรงคอลัมน์กัน */}
      <div className="flex w-48 max-w-full min-w-0 items-center gap-3">
        <Checkbox
          checked={getCheckedState(allOn, someOn)}
          onCheckedChange={(c) => onToggleResource(!!c)}
          disabled={disabled}
          className="size-3.5"
          aria-label={t("selectAllResource", { resource: label })}
        />
        <p
          className="text-foreground min-w-0 truncate text-xs font-semibold"
          title={label}
        >
          {label}
        </p>
      </div>

      {/* Toggle pill ต่อ action เรียงตามลำดับ MAIN_ACTIONS โชว์เฉพาะที่มีจริง —
          ติดแล้วเป็น primary (selected state คือที่เดียวที่ accent ใช้ได้) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {sortedActions(resource).map((a) => {
          const id = resource.actions.get(a)!;
          return (
            <Toggle
              key={a}
              variant="pill"
              size="xs"
              pressed={selectedSet.has(id)}
              onPressedChange={(pressed) => onTogglePermission(id, pressed)}
              disabled={disabled}
            >
              {actionLabel(a)}
            </Toggle>
          );
        })}
      </div>
    </div>
  );
}
