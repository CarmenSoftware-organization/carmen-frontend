import { Skeleton } from "@/components/ui/skeleton";
import EmptyComponent from "@/components/empty-component";
import SearchInput from "@/components/search-input";
import { cn } from "@/lib/utils";

const SKELETON_KEYS = Array.from({ length: 30 }, (_, i) => `skl-${i}`);

export type SectionTone = "warning" | "info" | "success";

// สีเดียวกันทั้งแถบสรุป จุดหัวกลุ่ม และแถบซ้ายของแต่ละแถว — มองเชื่อมกันได้โดยไม่ต้องอ่าน
export const SECTION_TONE_BG: Record<SectionTone, string> = {
  warning: "bg-warning",
  info: "bg-info",
  success: "bg-success",
};

/* ── Status strip (แทน KPI tiles + hero) ─────────── */

export interface StatusSegment<K extends string> {
  readonly key: K;
  readonly label: string;
  readonly value: number;
  readonly tone: SectionTone;
}

function StripChip({
  label,
  value,
  tone,
  pressed,
  onClick,
}: {
  readonly label: string;
  readonly value: number;
  readonly tone?: SectionTone;
  readonly pressed: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="text-muted-foreground hover:bg-muted/60 hover:text-foreground aria-pressed:border-border aria-pressed:bg-muted aria-pressed:text-foreground focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:h-7"
    >
      {tone && (
        <span
          className={cn("size-2 shrink-0 rounded-full", SECTION_TONE_BG[tone])}
          aria-hidden="true"
        />
      )}
      {label}
      <span className="text-foreground font-semibold tabular-nums">
        {value}
      </span>
    </button>
  );
}

export function StatusStrip<K extends string>({
  segments,
  active,
  onSelect,
  allLabel,
  header,
  metric,
}: {
  readonly segments: ReadonlyArray<StatusSegment<K>>;
  readonly active: "all" | K;
  readonly onSelect: (key: "all" | K) => void;
  readonly allLabel: string;
  readonly header?: React.ReactNode;
  readonly metric?: React.ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="bg-card @container mt-4 rounded-xl border">
      {header && (
        <div className="flex flex-col gap-3 border-b px-3 py-2.5 @xl:flex-row @xl:items-center @xl:justify-between">
          {header}
        </div>
      )}
      <div className="space-y-2.5 p-3">
        {/* แถบเป็นภาพประกอบของปุ่มด้านล่าง — ตัวเลขจริงอยู่ที่ปุ่ม */}
        <div
          className="bg-muted flex h-2 gap-px overflow-hidden rounded-full"
          aria-hidden="true"
        >
          {segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.key}
                className={cn(
                  "h-full transition-opacity",
                  SECTION_TONE_BG[s.tone],
                  active !== "all" && active !== s.key && "opacity-25",
                )}
                style={{ flexGrow: s.value }}
              />
            ))}
        </div>
        {/* ปุ่มสถานะกับตัวเลขความคืบหน้าอยู่ด้วยกันทางซ้าย — จอ 4K ไม่ถ่างห่างกันสุดขอบ */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="-ml-2 flex flex-wrap items-center gap-0.5">
            <StripChip
              label={allLabel}
              value={total}
              pressed={active === "all"}
              onClick={() => onSelect("all")}
            />
            {segments.map((s) => (
              <StripChip
                key={s.key}
                label={s.label}
                value={s.value}
                tone={s.tone}
                pressed={active === s.key}
                onClick={() => onSelect(s.key)}
              />
            ))}
          </div>
          {metric}
        </div>
      </div>
    </div>
  );
}

/** ตัวเลขงานจริงระดับรายการสินค้า (ไม่ใช่จำนวนสถานที่) */
export function StripMetric({
  label,
  done,
  total,
  unit,
}: {
  readonly label: string;
  readonly done: number;
  readonly total: number;
  readonly unit: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="text-muted-foreground flex items-baseline gap-1.5 text-xs">
      <span>{label}</span>
      <span className="text-foreground text-sm font-semibold tabular-nums">
        {done.toLocaleString()}
      </span>
      <span className="tabular-nums">
        / {total.toLocaleString()} {unit}
      </span>
      <span className="text-primary font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}

/* ── Rows ─────────────────────────────────────── */

export function LocationRow({
  tone,
  children,
}: {
  readonly tone: SectionTone;
  readonly children: React.ReactNode;
}) {
  return (
    // @container — แถวเลือกเลย์เอาต์จากความกว้างของตัวเอง (การ์ดในกริดแคบได้แม้จอกว้าง)
    <div className="hover:bg-muted/40 @container relative py-2.5 pr-3 pl-4 transition-colors">
      <span
        className={cn("absolute inset-y-0 left-0 w-1", SECTION_TONE_BG[tone])}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

function LocationRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 pr-3 pl-4">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-40 rounded" />
        <Skeleton className="h-2.5 w-20 rounded" />
      </div>
      <Skeleton className="hidden h-1.5 w-40 rounded-full sm:block" />
      <Skeleton className="h-7 w-20 rounded-md" />
    </div>
  );
}

export function LocationListSkeleton({
  count = 4,
  grid,
}: {
  readonly count?: number;
  /** โครงเดียวกับ `layout="grid"` (ขั้นต่ำเดียวกัน) — ไม่งั้นเนื้อหากระโดดตอนข้อมูลมา */
  readonly grid?: InvGridMin;
}) {
  const keys = SKELETON_KEYS.slice(0, count);
  return (
    <div className="mt-5" aria-busy="true" aria-live="polite">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Skeleton className="size-2 rounded-full" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
      {grid ? (
        <div className={GRID_COLS[grid]}>
          {keys.map((id) => (
            <div key={id} className={GRID_CELL}>
              <LocationRowSkeleton />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card divide-y overflow-hidden rounded-xl border">
          {keys.map((id) => (
            <LocationRowSkeleton key={id} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionEmpty({
  icon: Icon,
  title,
}: {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly title: string;
}) {
  return (
    <div className="border-border/40 bg-card flex items-center justify-center gap-2 rounded-xl border border-dashed py-6">
      <Icon className="text-muted-foreground/60 size-4" />
      <span className="text-muted-foreground text-xs">{title}</span>
    </div>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="border-border/60 bg-card relative space-y-2 rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3 w-44 rounded" />
          <Skeleton className="h-2.5 w-24 rounded" />
        </div>
      </div>
      <div className="border-border/40 flex items-center justify-between gap-2 border-t pt-2">
        <Skeleton className="h-2.5 w-20 rounded" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-7 w-32 rounded-lg" />
          <Skeleton className="h-2.5 w-10 rounded" />
        </div>
      </div>
      <Skeleton className="h-2.5 w-28 rounded" />
    </div>
  );
}

export function ItemListSkeleton({ count = 5 }: { readonly count?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {SKELETON_KEYS.slice(0, count).map((id) => (
        <ItemCardSkeleton key={id} />
      ))}
    </div>
  );
}

export function InvSearchBar({
  search,
  onSearch,
  extras,
}: {
  readonly search: string;
  readonly onSearch: (v: string) => void;
  readonly extras?: React.ReactNode;
}) {
  return (
    // ช่องค้นหากว้างคงที่เมื่อแถบกว้างพอ — ตัวกรอง (extras) อยู่ติดช่องค้นหา ไม่ถูกดันไปขอบขวา
    <div className="@container mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-40 flex-1 @xl:w-[23.75rem] @xl:flex-none [&>div]:w-full">
          <SearchInput
            defaultValue={search}
            onSearch={onSearch}
            onInputChange={onSearch}
            containerClassName="w-full"
            inputClassName="border-border/40 hover:border-foreground/50 focus-visible:border-primary bg-card h-9 rounded-lg border pr-9 text-sm shadow-none transition-colors focus-visible:ring-0"
          />
        </div>
        {extras}
      </div>
    </div>
  );
}

export interface InvStatusSection<T> {
  readonly key: string;
  readonly title: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly tone: SectionTone;
  readonly items: readonly T[];
}

export function SectionHeader({
  tone,
  title,
  count,
}: {
  readonly tone: SectionTone;
  readonly title: string;
  readonly count: number;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <span
        className={cn("size-2 rounded-full", SECTION_TONE_BG[tone])}
        aria-hidden="true"
      />
      <h2 className="text-foreground text-sm font-semibold tracking-tight">
        {title}
      </h2>
      <span className="text-muted-foreground bg-muted/60 text-micro-legal rounded-full px-2 py-0.5 font-semibold tabular-nums">
        {count}
      </span>
    </div>
  );
}

/**
 * ขั้นต่ำของการ์ด = ความกว้างที่แถวยังโชว์ครบในบรรทัดเดียว (ชื่อ ~200 + คอลัมน์คงที่ + ช่องว่าง 48
 * + padding 28 + ขอบ 2):
 *   `md` 44rem — PcLocationRow (11+8+7rem)      ≈ 694px
 *   `lg` 50rem — ScLocationRow (13+10+9rem)     ≈ 790px · เนื้อในการ์ด 800−30 = 770 ถึง @3xl (768)
 *     และกล่องที่จอ 1920 (1638) ยังได้ 2 ใบ (1608)
 * `auto-fill` ไม่ใช่ `auto-fit` — กรองเหลือสถานที่เดียวการ์ดต้องไม่ยืดเต็มแถว ·
 * `min(100%, …)` กันล้นในกล่องที่แคบกว่าขั้นต่ำ · เขียนเต็มทั้งสตริงให้ Tailwind หาเจอ
 */
const GRID_COLS = {
  md: "grid grid-cols-[repeat(auto-fill,minmax(min(100%,44rem),1fr))] gap-2",
  lg: "grid grid-cols-[repeat(auto-fill,minmax(min(100%,50rem),1fr))] gap-2",
} as const;
export type InvGridMin = keyof typeof GRID_COLS;
const GRID_CELL = "bg-card overflow-hidden rounded-xl border";

const SECTION_BODY = {
  rows: "bg-card divide-y overflow-hidden rounded-xl border",
  cards: "flex flex-col gap-2",
} as const;

interface InvStatusSectionsListProps<T> {
  readonly sections: ReadonlyArray<InvStatusSection<T>>;
  readonly emptyTitle: string;
  readonly renderItem: (item: T, tone: SectionTone) => React.ReactNode;
  readonly getItemKey: (item: T) => string;
  readonly isLoading?: boolean;
  readonly skeletonCount?: number;
  readonly showGlobalEmpty?: boolean;
  /**
   * `rows` = แถวต่อกันในกรอบเดียว · `cards` = การ์ดแยกใบเรียงลง (ประวัติ) ·
   * `grid` = การ์ดแยกใบไหลเป็นคอลัมน์ตามความกว้างกล่อง (จอกว้างได้หลายใบต่อบรรทัด แทนแถวยืดเต็มจอ)
   */
  readonly layout?: "rows" | "cards" | "grid";
  /** ขั้นต่ำของการ์ดเมื่อ `layout="grid"` — ตามความกว้างที่แถวต้องใช้ */
  readonly gridMin?: InvGridMin;
}

export function InvStatusSectionsList<T>({
  sections,
  emptyTitle,
  renderItem,
  getItemKey,
  isLoading,
  skeletonCount = 4,
  showGlobalEmpty = true,
  layout = "rows",
  gridMin = "md",
}: InvStatusSectionsListProps<T>) {
  if (isLoading)
    return (
      <LocationListSkeleton
        count={skeletonCount}
        grid={layout === "grid" ? gridMin : undefined}
      />
    );

  const allEmpty = sections.every((s) => s.items.length === 0);

  return (
    <>
      {sections.map((section) => (
        <section key={section.key} className="mt-5">
          <SectionHeader
            tone={section.tone}
            title={section.title}
            count={section.items.length}
          />
          {section.items.length === 0 ? (
            <SectionEmpty icon={section.icon} title={emptyTitle} />
          ) : (
            <div
              className={
                layout === "grid" ? GRID_COLS[gridMin] : SECTION_BODY[layout]
              }
            >
              {section.items.map((item) => (
                <div
                  key={getItemKey(item)}
                  className={cn(layout === "grid" && GRID_CELL)}
                >
                  {renderItem(item, section.tone)}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
      {showGlobalEmpty && allEmpty && <EmptyComponent />}
    </>
  );
}
