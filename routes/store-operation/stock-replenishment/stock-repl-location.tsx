import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import type { Location, ProductLocation } from "@/types/stock-replenishment";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { useIsMobile } from "@/hooks/use-mobile";
import { StockLevelBar } from "./stock-level-bar";

interface StockReplLocationProps {
  readonly location: Location;
  readonly selectedIds: Set<string>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelectionChange: (
    locationId: string,
    selectedIds: Set<string>,
  ) => void;
}

export function StockReplLocation({
  location,
  selectedIds,
  open,
  onOpenChange,
  onSelectionChange,
}: StockReplLocationProps) {
  "use no memo";
  const t = useTranslations("storeOperation.stockReplenishment");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const tl = useTranslations("lookup");
  const isMobile = useIsMobile() === true;

  // สีอยู่ที่ dot ตัวเดียว chip เป็นกลาง ตาม pattern StatusDotBadge ของแอป
  const STATUS_CONFIG = {
    critical: { tone: "destructive" as const, label: ts("critical") },
    warning: { tone: "warning" as const, label: ts("warning") },
    low: { tone: "neutral" as const, label: ts("low") },
  };

  const products = location.products_location;
  const criticalCount = products.filter((p) => p.status === "critical").length;
  const warningCount = products.filter((p) => p.status === "warning").length;
  const lowCount = products.filter((p) => p.status === "low").length;
  const allSelected =
    products.length > 0 && products.every((p) => selectedIds.has(p.id));
  const someSelected =
    products.some((p) => selectedIds.has(p.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(products.map((p) => p.id));
      onSelectionChange(location.location_id, allIds);
    } else {
      onSelectionChange(location.location_id, new Set());
    }
  };

  const handleSelectProduct = (product: ProductLocation, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(product.id);
    } else {
      next.delete(product.id);
    }
    onSelectionChange(location.location_id, next);
  };

  const columns: ColumnDef<ProductLocation>[] = [
    {
      id: "select",
      // select-all ย้ายไปเป็น checkbox ที่หัวแถว location แล้ว — ไม่ใส่ซ้ำใน
      // หัวตาราง (สอง control ป้ายเดียวกันชี้งานเดียวกัน)
      header: () => "",
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={(checked) =>
            handleSelectProduct(row.original, checked === true)
          }
          aria-label={tl("select", { entity: row.original.name })}
        />
      ),
      enableSorting: false,
      size: 40,
      meta: { headerClassName: "text-center", cellClassName: "text-center" },
    },
    {
      id: "index",
      header: "#",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.index + 1}</span>
      ),
      enableSorting: false,
      size: 40,
      meta: { headerClassName: "text-center", cellClassName: "text-center" },
    },
    {
      accessorKey: "name",
      header: tfl("product"),
      cell: ({ row }) => <ProductInfo product={row.original} />,
      enableSorting: false,
    },
    {
      id: "stock_level",
      header: t("stockLevel"),
      cell: ({ row }) => <StockLevelBar product={row.original} />,
      enableSorting: false,
      size: 220,
    },
    {
      accessorKey: "reorder_qty",
      header: tfl("reorderQty"),
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {(row.getValue("reorder_qty") as number).toLocaleString()}
        </span>
      ),
      enableSorting: false,
      size: 80,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "status",
      header: tfl("status"),
      cell: ({ row }) => {
        const config = STATUS_CONFIG[row.original.status];
        return (
          <StatusDotBadge tone={config.tone} size="xs">
            {config.label}
          </StatusDotBadge>
        );
      },
      enableSorting: false,
      size: 80,
      meta: { headerClassName: "text-center", cellClassName: "text-center" },
    },
  ];

  // จอเล็กตาราง 6 คอลัมน์บีบจนชื่อเหลือ "Dish…" และสถานะเหลือ "Cri" — เหลือ
  // checkbox + เซลล์เดียวที่วางเป็นสองชั้นแทน (ไม่ใช้เลื่อนแนวนอน เพราะซ้อนอยู่ใน
  // collapsible ของแต่ละคลังอีกชั้น เลื่อนแล้วหลงว่าอยู่คลังไหน)
  const compactColumn: ColumnDef<ProductLocation> = {
    id: "compact",
    header: tfl("product"),
    cell: ({ row }) => {
      const p = row.original;
      const config = STATUS_CONFIG[p.status];
      return (
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ProductInfo product={p} />
            </div>
            <StatusDotBadge tone={config.tone} size="xs">
              {config.label}
            </StatusDotBadge>
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <StockLevelBar product={p} />
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">
              {tfl("reorderQty")}{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {p.reorder_qty.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      );
    },
    enableSorting: false,
  };

  const table = useReactTable({
    data: products,
    columns: isMobile
      ? [...columns.filter((c) => c.id === "select"), compactColumn]
      : columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="bg-muted/40 hover:bg-muted/70 flex w-full items-center gap-2 rounded-md border px-3 py-2 transition-colors">
        <Checkbox
          checked={someSelected ? "indeterminate" : allSelected}
          onCheckedChange={(checked) => handleSelectAll(checked === true)}
          aria-label={t("selectAllIn", { location: location.location_name })}
        />
        <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left text-sm font-semibold">
          <ChevronRight
            className={`size-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="flex-1">
            <span className="text-muted-foreground mr-1.5 text-xs font-normal">
              {location.location_code}
            </span>
            {location.location_name}
          </span>
          {/* จอเล็กเหลือที่ให้ชื่อคลัง — ป้ายวิกฤตยังอยู่ จำนวนรายการเห็นได้จากตาราง */}
          <Badge
            variant="secondary"
            size="sm"
            className="hidden sm:inline-flex"
          >
            {t("nItems", { count: products.length })}
          </Badge>
          {criticalCount > 0 && (
            <StatusDotBadge tone="destructive" size="sm">
              {t("nCritical", { count: criticalCount })}
            </StatusDotBadge>
          )}
          {warningCount > 0 && (
            <StatusDotBadge tone="warning" size="sm">
              {t("nWarning", { count: warningCount })}
            </StatusDotBadge>
          )}
          {lowCount > 0 && (
            <StatusDotBadge tone="neutral" size="sm">
              {t("nLow", { count: lowCount })}
            </StatusDotBadge>
          )}
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="mt-1">
          {/* checkbox: true จำเป็น — DataGridTable กรองคอลัมน์ id "select" ทิ้ง
              เมื่อ flag นี้ปิด (default) ทำให้ checkbox รายแถวหายทั้งคอลัมน์ */}
          <DataGrid
            table={table}
            recordCount={products.length}
            tableLayout={{
              checkbox: true,
              // ชื่อสินค้ามีชื่อท้องถิ่นเป็นบรรทัดรอง เซลล์อื่นไม่มี — ชิดบนให้
              // ทุกคอลัมน์เริ่มบรรทัดแรกที่เส้นเดียวกัน (ตารางนี้อ่านอย่างเดียว)
              cellAlign: "top",
              // เซลล์ compact สูงเกินสองบรรทัดเสมอ clamp จะตัดแถบสต็อกทิ้ง
              rowClamp: !isMobile,
            }}
          >
            <DataGridContainer>
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProductInfo({ product }: { readonly product: ProductLocation }) {
  // ชื่อหลัก → ชื่อท้องถิ่น → หมวด › หมวดย่อย › กลุ่ม — เดิมสามอย่างหลังกินคนละ
  // คอลัมน์เป็นตัวจางทั้งหมด จนชื่อสินค้าถูกตัดเหลือ "White Tofu Tube 885…"
  const path = [
    product.category.name,
    product.sub_category.name,
    product.item_group.name,
  ]
    .filter(Boolean)
    .join(" › ");
  return (
    <div className="min-w-0">
      <NameWithSubtext
        primary={product.name || "..."}
        secondary={product.local_name || undefined}
      />
      {path && (
        <p
          className="text-muted-foreground text-micro-legal truncate leading-[normal]"
          title={path}
        >
          {path}
        </p>
      )}
    </div>
  );
}
