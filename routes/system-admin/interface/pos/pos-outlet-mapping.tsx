import { useMemo } from "react";
import { X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { Button } from "@/components/ui/button";
import EmptyComponent from "@/components/empty-component";
import { ErrorState } from "@/components/ui/error-state";
import { LookupLocation } from "@/components/lookup/lookup-location";
import { getUserErrorMessage } from "@/lib/error-message";
import { PosStoreFilter } from "./pos-store-filter";
import type { PosBrand, PosOutlet } from "./pos-sale-types";
import { usePosStoreFilter } from "./use-pos-store-filter";
import { usePosWritable } from "./use-pos-writable";
import { usePosOutlets, useUpdatePosOutlet } from "./use-pos-sale";

/**
 * แท็บผูก Outlet ของ POS กับ Location — เลือกแล้วบันทึกทันที (ไม่แบ่งหน้า เพราะ Outlet ต่อร้านมีหลักสิบ)
 *
 * @param brand แบรนด์ POS ของหน้านี้
 * @returns React element ของแท็บ
 */
export function PosOutletMapping({ brand }: { brand: PosBrand }) {
  "use no memo";
  const t = useTranslations("systemAdmin.interface.posSale.outlets");
  const tErr = useTranslations("errors");
  const { canWrite } = usePosWritable(brand);
  const { stores, storeId, setStoreId } = usePosStoreFilter(brand);
  const { data, isLoading, error, refetch } = usePosOutlets(storeId);
  const { mutate } = useUpdatePosOutlet();

  const outlets = useMemo(() => data ?? [], [data]);

  const columns = useMemo<ColumnDef<PosOutlet>[]>(() => {
    const save = (id: string, locationId: string | null) =>
      mutate(
        { id, location_id: locationId },
        {
          onSuccess: () => toast.success(t("saved")),
          onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
        },
      );
    return [
      {
        id: "code",
        header: t("columns.code"),
        cell: ({ row }) => row.original.code,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
      {
        id: "name",
        header: t("columns.name"),
        cell: ({ row }) => row.original.name,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "location",
        header: t("columns.location"),
        cell: ({ row }) => {
          const o = row.original;
          const loc = o.location;
          return (
            <div className="flex items-center gap-2">
              <div className="w-72">
                <LookupLocation
                  size="xs"
                  value={loc?.id ?? ""}
                  defaultLabel={loc ? `${loc.code} · ${loc.name}` : undefined}
                  disabled={!canWrite}
                  onValueChange={(id) => save(o.id, id || null)}
                />
              </div>
              {loc && canWrite && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={t("clear")}
                  onClick={() => save(o.id, null)}
                >
                  <X />
                </Button>
              )}
              {!loc && (
                <span className="text-warning-ink text-xs">
                  {t("notMapped")}
                </span>
              )}
            </div>
          );
        },
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
    ];
  }, [t, tErr, canWrite, mutate]);

  const table = useReactTable({
    data: outlets,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-3 pt-4">
      <PosStoreFilter stores={stores} storeId={storeId} onChange={setStoreId} />
      {storeId &&
        (error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <DataGrid
            table={table}
            recordCount={outlets.length}
            isLoading={isLoading}
            tableLayout={{ headerSticky: true }}
            emptyMessage={<EmptyComponent />}
          >
            <DataGridContainer className="flex flex-col">
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          </DataGrid>
        ))}
    </div>
  );
}
