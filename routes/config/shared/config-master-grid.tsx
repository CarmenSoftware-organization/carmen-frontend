import { flexRender, type Table } from "@tanstack/react-table";
import type { RefCallback } from "react";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import EmptyComponent from "@/components/empty-component";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
/** Reuse each table cell's actual actions; cards retain every field hidden in narrow tables. */
export function ConfigMasterGrid<T extends object>({
  table,
  gridRef,
  gridWidth,
  labels,
  titleColumn,
  isLoading = false,
}: {
  table: Table<T>;
  gridRef: RefCallback<HTMLDivElement>;
  gridWidth?: number;
  labels: Record<string, string>;
  titleColumn: string;
  isLoading?: boolean;
}) {
  "use no memo";
  return (
    <div ref={gridRef} className="@container min-w-0">
      {gridWidth != null && gridWidth < 768 ? (
        isLoading ? (
          <CardSkeletonGrid />
        ) : table.getRowModel().rows.length === 0 ? (
          <EmptyComponent />
        ) : (
          <div className="grid gap-3 @xl:grid-cols-2">
            {table.getRowModel().rows.map((row) => (
              <ListCard
                key={row.id}
                title={String(row.getValue(titleColumn) ?? "—")}
              >
                {row
                  .getAllCells()
                  .filter((cell) => labels[cell.column.id])
                  .map((cell) => (
                    <ListCardRow key={cell.id} label={labels[cell.column.id]}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </ListCardRow>
                  ))}
                {row
                  .getAllCells()
                  .filter((cell) => cell.column.id === "actions")
                  .map((cell) => (
                    <div key={cell.id} className="flex justify-end">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  ))}
              </ListCard>
            ))}
          </div>
        )
      ) : (
        <DataGrid
          table={table}
          recordCount={table.getRowModel().rows.length}
          isLoading={isLoading}
          emptyMessage={<EmptyComponent />}
          tableLayout={{ width: "fixed", headerSticky: true }}
          tableClassNames={{ bodyRow: "h-10" }}
        >
          <DataGridContainer scroll className="max-h-[calc(100dvh-14rem)]">
            <DataGridTable />
          </DataGridContainer>
        </DataGrid>
      )}
    </div>
  );
}
