import { useElementWidth } from "@/hooks/use-element-width";
import { useState } from "react";
import type {
  ColumnDef,
  OnChangeFn,
  VisibilityState,
} from "@tanstack/react-table";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";

export interface ConfigTableLayout {
  grow: string;
  widths: Record<string, number>;
  /** Hide in this order when the box cannot fit; all remain available in the detail. */
  secondary?: string[];
}

export function configTableLayout<T>(
  columns: ColumnDef<T>[],
  layout: ConfigTableLayout,
  width: number,
  visibility: VisibilityState,
  chromeWidth: number,
) {
  const columnId = (column: ColumnDef<T>) =>
    column.id ?? ("accessorKey" in column ? String(column.accessorKey) : "");
  const sized = columns.map((column) => ({
    ...column,
    size: layout.widths[columnId(column)] ?? column.size ?? 150,
  }));
  const visible = { ...visibility };
  const total = () =>
    chromeWidth +
    sized.reduce(
      (sum, column) =>
        sum + (visible[columnId(column)] === false ? 0 : column.size),
      0,
    );
  for (const id of layout.secondary ?? []) {
    if (total() <= width) break;
    visible[id] = false;
  }
  return {
    columns: sized.map((column) => ({
      ...column,
      meta: {
        ...column.meta,
        grow: columnId(column) === layout.grow && total() <= width,
      },
    })),
    visibility: visible,
  };
}

/** Module-local composition: shared DataGrid and its permission/actions stay unchanged. */
export function useConfigListTable<T>({
  containerWidth,
  layout,
  ...options
}: Parameters<typeof useConfigTable<T>>[0] & {
  containerWidth?: number;
  layout: ConfigTableLayout;
}) {
  "use no memo";
  // Include the 55px select column even though ConfigListTemplate does not render it.
  const chromeWidth =
    55 +
    (options.hideIndex ? 0 : 60) +
    (options.hideStatus ? 0 : 100) +
    (options.onDelete ? 60 : 0);
  const responsive = useConfigTableLayout(
    options.columns,
    layout,
    containerWidth,
    options.initialState?.columnVisibility,
    chromeWidth,
  );
  const tableConfig = {
    ...options.tableConfig,
    state: { ...options.tableConfig.state, ...responsive.state },
    onColumnVisibilityChange: responsive.onColumnVisibilityChange,
  };
  return useConfigTable({
    ...options,
    columns: responsive.columns,
    tableConfig,
  });
}

export function useConfigTableLayout<T>(
  sourceColumns: ColumnDef<T>[],
  layout: ConfigTableLayout,
  containerWidth?: number,
  initialVisibility: VisibilityState = {},
  chromeWidth = 0,
) {
  const [preferences, setPreferences] =
    useState<VisibilityState>(initialVisibility);
  const { columns, visibility } = configTableLayout(
    sourceColumns,
    layout,
    containerWidth ?? Infinity,
    preferences,
    chromeWidth,
  );
  const onColumnVisibilityChange: OnChangeFn<VisibilityState> = (updater) => {
    const next = typeof updater === "function" ? updater(visibility) : updater;
    setPreferences((previous) => ({
      ...previous,
      ...Object.fromEntries(
        Object.entries(next).filter(([id, value]) => value !== visibility[id]),
      ),
    }));
  };
  return {
    columns,
    state: { columnVisibility: visibility },
    onColumnVisibilityChange,
  };
}

export function useMasterGridLayout<T>(
  columns: ColumnDef<T>[],
  layout: ConfigTableLayout,
) {
  const [gridRef, width] = useElementWidth();
  return {
    gridRef,
    gridWidth: width,
    ...useConfigTableLayout(
      columns,
      layout,
      width == null ? undefined : width - 2,
    ),
  };
}
