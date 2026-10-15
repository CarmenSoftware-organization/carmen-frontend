import type { ReactNode } from "react";
import type { Table } from "@tanstack/react-table";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import type { XlsxColumn } from "@/lib/xlsx-utils";
import type { ListPageKey } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";

export interface ConfigTableHookOptions<TEntity> {
  data: TEntity[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (item: TEntity) => void;
  onDelete: (item: TEntity) => void;
  permissionPrefix?: string;
}

export type UseTableFn<TEntity> = (
  options: ConfigTableHookOptions<TEntity>,
) => Table<TEntity>;

export interface DialogRenderProps<TEntity> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: TEntity | null;
  /**
   * View-only mode — user มี view permission แต่ไม่มี update permission.
   * Dialog ต้อง disable form + ซ่อนปุ่ม save เมื่อ true.
   * Add mode (entity = null) จะส่ง false เสมอ (เพราะถูก gate ที่ปุ่ม Add ก่อนแล้ว)
   */
  readOnly: boolean;
}

export interface DeleteDialogRenderProps<TEntity> {
  target: TEntity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: () => void;
}

export interface CardRenderProps<TEntity> {
  item: TEntity;
  index?: number;
  onEdit: (item: TEntity) => void;
  onDelete: (item: TEntity) => void;
}

export interface ConfigListTemplateProps<TEntity extends { id: string }> {
  translationNamespace: string;
  entityNameField: keyof TEntity & string;

  useList: (
    params?: ParamsDto,
    options?: { enabled?: boolean },
  ) => {
    data?: { data?: TEntity[]; paginate?: { total: number; pages?: number } };
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };
  useDelete: () => {
    mutate: (
      id: string,
      options: {
        onSuccess: () => void;
      },
    ) => void;
    isPending: boolean;
  };

  useTable: UseTableFn<TEntity>;

  renderDialog?: (props: DialogRenderProps<TEntity>) => ReactNode;
  renderDeleteDialog?: (props: DeleteDialogRenderProps<TEntity>) => ReactNode;
  addPath?: string;
  getEditPath?: (entity: TEntity) => string;
  renderCard?: (props: CardRenderProps<TEntity>) => ReactNode;

  extraActions?: ReactNode;
  hideExportPrint?: boolean;
  exportColumns?: XlsxColumn<TEntity>[];
  exportFileNamePrefix?: string;
  exportSheetName?: string;
  defaultSort?: string;
  permissionPrefix?: string;
  /**
   * ให้ตารางแบ่งความกว้างตาม `size` ของแต่ละคอลัมน์ (DataGrid `width: "fixed"`)
   * แทนการแบ่งเท่ากันทุกคอลัมน์ — opt-in เพราะคอลัมน์ที่ไม่ได้ตั้ง `size` จะได้
   * 150 ของ TanStack ทันที หน้าที่เปิดต้องตั้ง `size` ให้ครบทุกคอลัมน์ของตัวเอง
   */
  fixedColumnWidths?: boolean;

  pageKey: ListPageKey;
  filterFields: FilterFieldDef[];
}
