import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import type { ConfigTableHookOptions } from "@/components/templates/types";
import {
  ListCard,
  ListCardActiveRow,
  ListCardRow,
  ListCardAuditRows,
} from "@/components/share/list-card";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { WhtFormMaster } from "@/types/accounting-master";
import {
  AP_MASTER_FILTER_FIELDS,
  useApMasterTable,
} from "../shared/use-ap-master-table";
import { MasterDeleteDialog } from "../shared/ap-master-dependencies";
import { whtFormCrud } from "./use-wht-form";
import { WhtFormDialog } from "./wht-form-dialog";

function useWhtFormTable(options: ConfigTableHookOptions<WhtFormMaster>) {
  const tf = useTranslations("field");
  const columns: ColumnDef<WhtFormMaster>[] = [];
  if ((options.containerWidth ?? 1000) >= 900)
    columns.push({
      accessorKey: "account_code",
      size: 220,
      header: tf("glAccount"),
      cell: ({ row }) =>
        [row.original.account_code, row.original.account_name]
          .filter(Boolean)
          .join(" · ") || "—",
      enableSorting: false,
      meta: { headerTitle: tf("glAccount") },
    });
  if ((options.containerWidth ?? 1000) >= 1200)
    columns.push({
      accessorKey: "cost_center_code",
      size: 200,
      header: tf("costCenter"),
      cell: ({ row }) =>
        [row.original.cost_center_code, row.original.cost_center_name]
          .filter(Boolean)
          .join(" · ") || "—",
      enableSorting: false,
      meta: { headerTitle: tf("costCenter") },
    });
  return useApMasterTable(options, columns);
}

export default function WhtFormPage() {
  const tf = useTranslations("field");
  const ts = useTranslations("status");
  const deletion = whtFormCrud.useDeleteVersioned();
  return (
    <ConfigListTemplate<WhtFormMaster>
      translationNamespace="config.whtForm"
      mock
      entityNameField="code"
      useList={whtFormCrud.useList}
      useDelete={whtFormCrud.useDelete}
      useTable={useWhtFormTable}
      permissionPrefix="accounting.config.ap"
      pageKey={LIST_PAGE_KEYS.WHT_FORM}
      filterFields={AP_MASTER_FILTER_FIELDS}
      defaultSort="code:asc"
      fixedColumnWidths
      exportColumns={[
        { header: tf("code"), value: (row) => row.code, width: 18 },
        {
          header: tf("description"),
          value: (row) => row.description,
          width: 40,
        },
        {
          header: tf("glAccount"),
          value: (row) =>
            [row.account_code, row.account_name].filter(Boolean).join(" · "),
          width: 30,
        },
        {
          header: tf("costCenter"),
          value: (row) =>
            [row.cost_center_code, row.cost_center_name]
              .filter(Boolean)
              .join(" · "),
          width: 25,
        },
        {
          header: tf("status"),
          value: (row) => ts(row.is_active ? "active" : "inactive"),
          width: 12,
        },
      ]}
      renderDialog={(props) => <WhtFormDialog {...props} />}
      renderDeleteDialog={(props) => (
        <MasterDeleteDialog
          {...props}
          endpoint={whtFormCrud.endpoint}
          remove={deletion.mutate}
          isPending={deletion.isPending}
          error={deletion.error}
          reset={deletion.reset}
        />
      )}
      renderCard={({ item, onEdit, onDelete }) => (
        <ListCard
          title={item.code}
          onOpen={() => onEdit(item)}
          onDelete={() => onDelete(item)}
        >
          <ListCardActiveRow active={item.is_active} />
          <ListCardRow label={tf("description")}>
            {item.description}
          </ListCardRow>
          <ListCardRow label={tf("glAccount")}>
            {[item.account_code, item.account_name]
              .filter(Boolean)
              .join(" · ") || "—"}
          </ListCardRow>
          <ListCardRow label={tf("costCenter")}>
            {[item.cost_center_code, item.cost_center_name]
              .filter(Boolean)
              .join(" · ") || "—"}
          </ListCardRow>
          <ListCardRow label={tf("dimension")}>
            {item.dimensions
              .map(
                (dimension) =>
                  `${dimension.dimension_code}: ${dimension.value_code || "—"}`,
              )
              .join(" · ") || "—"}
          </ListCardRow>
          <ListCardAuditRows audit={item.audit} />
        </ListCard>
      )}
    />
  );
}
