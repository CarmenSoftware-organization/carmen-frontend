import { useMemo, useState, type ReactNode } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { ListFilter, MapPin } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { Checkbox } from "@/components/ui/checkbox";
import { HighlightText } from "@/components/ui/highlight-text";
import { lookupIcon } from "@/components/ui/status-icon-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/search-input";
import { LocationTypeLabel } from "@/components/share/location-type-label";
import { StatusBadge } from "@/components/ui/status-badge";
import { INVENTORY_TYPE, INVENTORY_TYPE_LABEL_KEY } from "@/constant/location";
import { useElementWidth } from "@/hooks/use-element-width";
import { useLocationAll } from "@/hooks/use-location";
import type { UserLocation } from "@/types/user";
import { CompactSection } from "@/components/share/compact-section";
import { EmptyState } from "./user-assigned-ui";
import type { UserAssignedFormValues } from "./user-assigned-form-schema";

/* ------------------------------------------------------------------ */
/* Location type constants — local to this section                     */
/* ------------------------------------------------------------------ */

const LOCATION_TYPE_ORDER: INVENTORY_TYPE[] = [
  INVENTORY_TYPE.INVENTORY,
  INVENTORY_TYPE.CONSIGNMENT,
  INVENTORY_TYPE.DIRECT,
];

/**
 * แถวในตาราง — ทรงเดียวกันไม่ว่าจะมาจากคลังที่ผูกไว้ (`UserLocation`) หรือจาก
 * ทะเบียนคลังทั้ง BU (`Location`) ที่ตั้งชื่อฟิลด์คนละแบบ
 */
interface LocationRow {
  id: string;
  code: string;
  name: string;
  type: INVENTORY_TYPE;
  is_active: boolean;
}

const fromAssigned = (l: UserLocation): LocationRow => ({
  id: l.location_id,
  code: l.location_code,
  name: l.location_name,
  type: l.location_type,
  is_active: l.is_active,
});

/* ------------------------------------------------------------------ */
/* LocationsSection — ดูคลังที่ผูก · แก้ = ติ๊กจากคลังทั้งหมด          */
/* ------------------------------------------------------------------ */

interface LocationsSectionProps {
  readonly form: UseFormReturn<UserAssignedFormValues>;
  readonly isDisabled: boolean;
  readonly userLocations: UserLocation[];
}

/**
 * คลังที่ผูกกับผู้ใช้
 *
 * โหมดดูแสดงเฉพาะคลังที่ผูกไว้ (มากับตัวผู้ใช้แล้ว ไม่ต้องยิงอะไรเพิ่ม) กด Edit
 * ถึงจะลากทะเบียนคลังทั้ง BU มาแล้วโชว์ทุกใบให้ติ๊ก — ตารางเดิมทั้งดุ้น เพิ่มแค่
 * คอลัมน์ checkbox หน้าสุด ค้น/เรียง/กรองชนิดใช้ได้เหมือนกันทั้งสองโหมด
 *
 * คลังยังแก้ได้จาก `/config/location` อีกทาง — payload จึงส่งเป็น diff
 * (`{add, remove}`) ไม่ใช่ทั้งชุด ดู `buildUserPatch`
 */
export function LocationsSection({
  form,
  isDisabled,
  userLocations,
}: LocationsSectionProps) {
  const tu = useTranslations("systemAdmin.user");
  const tc = useTranslations("common");
  // ชื่อชนิดคลังมาจาก namespace เดียวกับที่ LocationTypeLabel ใช้ในคอลัมน์ประเภท
  // ของตารางข้างล่าง — dropdown กับคอลัมน์จะได้ไม่เรียกของอย่างเดียวกันคนละชื่อ
  const tloc = useTranslations("config.location");
  const [typeFilter, setTypeFilter] = useState<INVENTORY_TYPE | "all">("all");

  // ทะเบียนคลังทั้ง BU ยิงตอนกด Edit เท่านั้น — คนเปิดดูเฉย ๆ ไม่ต้องเสีย
  const { data: allLocationsData, isLoading } = useLocationAll(undefined, {
    enabled: !isDisabled,
  });

  const rows = useMemo<LocationRow[]>(() => {
    if (isDisabled) return userLocations.map(fromAssigned);
    return (allLocationsData ?? []).map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      type: l.location_type,
      is_active: l.is_active,
    }));
  }, [isDisabled, userLocations, allLocationsData]);

  const groupedLocations = (() => {
    const m = new Map<INVENTORY_TYPE, LocationRow[]>();
    for (const loc of rows) {
      const arr = m.get(loc.type) ?? [];
      arr.push(loc);
      m.set(loc.type, arr);
    }
    return m;
  })();

  const locationCounts = {
    all: rows.length,
    [INVENTORY_TYPE.INVENTORY]:
      groupedLocations.get(INVENTORY_TYPE.INVENTORY)?.length ?? 0,
    [INVENTORY_TYPE.DIRECT]:
      groupedLocations.get(INVENTORY_TYPE.DIRECT)?.length ?? 0,
    [INVENTORY_TYPE.CONSIGNMENT]:
      groupedLocations.get(INVENTORY_TYPE.CONSIGNMENT)?.length ?? 0,
  };

  const visibleLocations =
    typeFilter === "all" ? rows : rows.filter((loc) => loc.type === typeFilter);

  // ตัวกรองชนิดคลังเป็น dropdown ตัวเดียว ไม่ใช่ชิปสี่อันเรียงกัน — สี่อันกินความ
  // กว้างจนแถวเดียวกับช่องค้นไม่พอบนจอแคบ และ dropdown บอกได้ในตัวว่าตอนนี้กรอง
  // อะไรอยู่โดยไม่ต้องไล่ดูว่าอันไหน active
  //
  // ใช้ **ไอคอน** ชุดเดียวกับ `LocationTypeLabel` ในตาราง (ผ่าน `lookupIcon`)
  // ไม่ใช่จุดสี — คนเลือกจาก dropdown แล้วเห็นไอคอนเดิมในคอลัมน์ประเภท โยงกันได้ทันที
  // และชนิดคลังเป็นคุณสมบัติ ไม่ใช่ความคืบหน้า จึงไม่ควรมีสีตั้งแต่แรก
  const filters =
    rows.length > 0 ? (
      <Select
        value={typeFilter}
        onValueChange={(v) => setTypeFilter(v as INVENTORY_TYPE | "all")}
      >
        <SelectTrigger className="text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* ไอคอนกรองนำหน้าคำว่า "ทั้งหมด" — แถวนี้จะได้มีไอคอนเหมือนอีกสามแถว
              ที่เป็นชนิดคลัง ไม่ใช่แถวเดียวที่ตัวหนังสือเยื้องออกไป · ไม่ใส่จำนวน
              เพราะ "ทั้งหมด" คือค่าตั้งต้น ตัวเลขที่นี่ซ้ำกับ count ที่หัว section */}
          <SelectItem value="all">
            <span className="flex items-center gap-2">
              <ListFilter
                className="text-muted-foreground size-3.5 shrink-0"
                aria-hidden="true"
              />
              {tc("all")}
            </span>
          </SelectItem>
          {LOCATION_TYPE_ORDER.filter((t) => locationCounts[t] > 0).map((t) => {
            const Icon = lookupIcon(t)?.icon;
            return (
              <SelectItem key={t} value={t}>
                <span className="flex items-center gap-2">
                  {Icon && (
                    <Icon
                      className="text-muted-foreground size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  {`${tloc(INVENTORY_TYPE_LABEL_KEY[t])} (${locationCounts[t]})`}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    ) : undefined;

  return (
    <CompactSection
      title={tu("locationsTitle")}
      description={tu("locationsDesc")}
      // หัว section นับ "คลังของคนนี้" เสมอ ไม่ใช่จำนวนแถวในตาราง — ตอนแก้
      // ตารางโชว์ทั้ง BU ตัวเลขจะกระโดดเป็นหลักร้อยทั้งที่ยังไม่ได้ติ๊กอะไร
      count={form.watch("location_ids").length}
    >
      <LocationsView
        form={form}
        isDisabled={isDisabled}
        isLoading={isLoading}
        allRows={rows}
        visibleLocations={visibleLocations}
        filters={filters}
      />
    </CompactSection>
  );
}

/**
 * ชุดคอลัมน์ตามความกว้างของกล่องตาราง (รวมช่องติ๊ก 40px ของโหมดแก้ไว้ในงบแล้ว)
 *
 * - `full`  ≥ 590px: # 32 · รหัส 100 · ชื่อ 180 · ประเภท 120 · สถานะ 110↔ = 542 (+40 = 582)
 * - `mid`   ≥ 440px: รหัส 100 · ชื่อ 180 · สถานะ 110↔ = 390 (+40 = 430) — ประเภทยังกรองได้จาก dropdown
 * - `narrow` < 440px: ชื่อ 130↔ (รหัสอยู่ใต้ชื่อ) · สถานะ 96 = 226 (+40 = 266 = กล่องที่จอ 390)
 *
 * จุดเปลี่ยนขั้นสูงกว่าผลรวมของขั้นนั้นเสมอ — ตั้งเท่ากันพอดีคอลัมน์รองจะกลับมาแล้วเบียดคอลัมน์ยืด
 * แก้ `size` ของคอลัมน์เมื่อไรต้องคิดตัวเลขชุดนี้ใหม่
 */
function columnTier(width: number | undefined): "full" | "mid" | "narrow" {
  if (width === undefined || width >= 590) return "full";
  return width >= 440 ? "mid" : "narrow";
}

/* ------------------------------------------------------------------ */
/* LocationsView — sub-component to keep the parent cognitive          */
/* complexity below the SonarLint threshold                            */
/* ------------------------------------------------------------------ */

interface LocationsViewProps {
  readonly form: UseFormReturn<UserAssignedFormValues>;
  readonly isDisabled: boolean;
  readonly isLoading: boolean;
  readonly allRows: LocationRow[];
  readonly visibleLocations: LocationRow[];
  readonly filters?: ReactNode;
}

/**
 * ตารางคลัง — โหมดดูคือคลังที่ผูก โหมดแก้คือทั้ง BU พร้อมคอลัมน์ติ๊ก
 *
 * เดิมเป็นการ์ดรายแถวจัดกลุ่มตามชนิดคลัง พร้อมหัวกลุ่มและแถบสีซ้าย — ย้ายมาใช้
 * `DataGrid` ตัวเดียวกับตารางอื่นทั้งแอป ชนิดคลังจึงกลายเป็น **คอลัมน์** แทนการ
 * จัดกลุ่ม (ชิปกรองด้านบนยังกรองตามชนิดได้เหมือนเดิม) และใช้ `LocationTypeLabel`
 * ตัวเดียวกับหน้ารายการคลังกับแท็บคลังของสินค้า ข้อมูลเดียวกันจึงหน้าตาเดียวกันทุกที่
 */
function LocationsView({
  form,
  isDisabled,
  isLoading,
  allRows,
  visibleLocations,
  filters,
}: LocationsViewProps) {
  "use no memo"; // TanStack table เป็น ref นิ่งแต่ mutate ตัวเอง — ดู routes/CLAUDE.md
  const tu = useTranslations("systemAdmin.user");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  // เลือกชุดคอลัมน์จากความกว้างของกล่องตารางเอง (ไม่ใช่ของจอ) — การ์ดนี้กว้างครึ่งจอบนจอใหญ่
  // และเต็มจอบนจอเล็ก · undefined (ยังไม่ได้วัด) = ชุดเต็ม
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const tier = columnTier(gridBoxWidth);

  // กรองในหน่วยความจำ — คลังมาทั้งก้อนอยู่แล้วทั้งสองโหมด ไม่มี API ให้ยิงต่อ
  // ค้นทั้งรหัสและชื่อ คนจำได้อย่างใดอย่างหนึ่ง
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleLocations;
    return visibleLocations.filter(
      (loc) =>
        loc.code.toLowerCase().includes(q) ||
        loc.name.toLowerCase().includes(q),
    );
  }, [visibleLocations, search]);

  const columns = useMemo<ColumnDef<LocationRow>[]>(() => {
    const assignColumn: ColumnDef<LocationRow> = {
      id: "assigned",
      header: "",
      enableSorting: false,
      size: 40,
      cell: ({ row }) => (
        <Controller
          control={form.control}
          name="location_ids"
          render={({ field }) => {
            const checked = field.value.includes(row.original.id);
            return (
              <Checkbox
                checked={checked}
                aria-label={row.original.name}
                onCheckedChange={(next) =>
                  field.onChange(
                    next
                      ? [...field.value, row.original.id]
                      : field.value.filter((id) => id !== row.original.id),
                  )
                }
              />
            );
          }}
        />
      ),
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center",
      },
    };

    const base: ColumnDef<LocationRow>[] = [
      {
        id: "index",
        header: "#",
        cell: ({ row }) => row.index + 1,
        enableSorting: false,
        size: 32,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center text-muted-foreground",
        },
      },
      {
        // accessorKey ไม่ใช่แค่ id — sort ฝั่ง client ต้องมีค่าให้เทียบ ถ้ามีแต่
        // `cell` ตัว column จะไม่มีค่าอะไรเลยแล้วกดหัวคอลัมน์ก็ไม่ขยับ
        accessorKey: "code",
        id: "code",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("code")} />
        ),
        size: 100,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            <HighlightText text={row.original.code} query={search} />
          </span>
        ),
      },
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("name")} />
        ),
        size: tier === "narrow" ? 130 : 180,
        // ยังไม่ทำเป็นลิงก์ไป /config/location/:id — คนที่ดูหน้า user ไม่จำเป็นต้องมี
        // สิทธิ์เปิดหน้าตั้งค่าคลัง ต้องเช็ค permission ก่อนถึงจะให้กดได้
        cell: ({ row }) => (
          <>
            <span className="font-medium break-words">
              <HighlightText text={row.original.name} query={search} />
            </span>
            {/* ชุดแคบซ่อนคอลัมน์รหัส — รหัสย้ายมาอยู่ใต้ชื่อ ยังค้นและอ่านได้ */}
            {tier === "narrow" && (
              <span className="text-muted-foreground block">
                <HighlightText text={row.original.code} query={search} />
              </span>
            )}
          </>
        ),
        meta: tier === "narrow" ? { grow: true } : undefined,
      },
      {
        accessorKey: "type",
        id: "type",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("locationType")} />
        ),
        size: 120,
        cell: ({ row }) => <LocationTypeLabel type={row.original.type} />,
      },
      {
        accessorKey: "is_active",
        id: "status",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("status")} />
        ),
        size: tier === "narrow" ? 96 : 110,
        cell: ({ row }) => <StatusBadge active={row.original.is_active} />,
        // ชุดเต็ม/กลาง: คอลัมน์สุดท้ายรับความกว้างที่เหลือ เนื้อหาชิดซ้าย — คอลัมน์ข้างหน้ากว้างคงที่
        // จึงอยู่ติดกัน ไม่กระจายห่างกันบนจอกว้าง · ชุดแคบ: ชื่อเป็นตัวยืดแทน สถานะกว้างคงที่
        meta: tier === "narrow" ? undefined : { grow: true },
      },
    ];

    return isDisabled ? base : [assignColumn, ...base];
  }, [tfl, search, isDisabled, form.control, tier]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      // ซ่อนผ่าน state ของตาราง ไม่ใช่ CSS — ความกว้างขั้นต่ำของตารางที่มีคอลัมน์ยืดคิดจากทุก
      // คอลัมน์ที่ TanStack ถือว่าเปิดอยู่
      columnVisibility: {
        index: tier === "full",
        type: tier === "full",
        code: tier !== "narrow",
      },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    // เรียงฝั่ง client ล้วน — ข้อมูลมาทั้งก้อนแล้ว ไม่ต้องยิงกลับไปเรียงที่ backend
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          defaultValue={search}
          containerClassName="w-full sm:w-64"
          inputClassName="h-8 placeholder:text-xs"
          onInputChange={setSearch}
          onSearch={setSearch}
        />
        {/* ตัวกรองอยู่ติดช่องค้น ไม่ถูกดันไปขวาสุดของแถว (กติกาข้อ 12) */}
        {filters}
      </div>
      <div ref={setGridBox}>
        <DataGrid
          table={table}
          recordCount={rows.length}
          isLoading={isLoading}
          tableLayout={{ headerSticky: true }}
          emptyMessage={
            // ยังไม่ผูกคลังเลย กับ กรองแล้วไม่เหลือ แก้คนละวิธี — ข้อความจึงต้องต่างกัน
            allRows.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title={tu("noLocationsAssigned")}
                desc={tu("noLocationsAssignedDesc")}
              />
            ) : (
              <EmptyState
                icon={MapPin}
                title={tu("noLocationsMatchFilter")}
                desc={tu("noLocationsMatchFilterDesc")}
              />
            )
          }
        >
          {/* จำกัดความสูงแล้วให้เลื่อนในกล่อง — โหมดแก้โชว์คลังทั้ง BU ปล่อยยาว
            ตามจำนวนแถวจะดันปุ่ม Save กับ section อื่นหลุดจอไปเลย · หัวตาราง
            sticky ไว้ ไม่งั้นเลื่อนไปกลางตารางแล้วไม่รู้ว่าคอลัมน์ไหนคืออะไร */}
          <DataGridContainer className="flex max-h-96 flex-col">
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
        </DataGrid>
      </div>
    </div>
  );
}
