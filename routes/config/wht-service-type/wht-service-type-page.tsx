import { useTranslations } from "use-intl";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import type { ConfigTableHookOptions } from "@/components/templates/types";
import {
  ListCard,
  ListCardActiveRow,
  ListCardRow,
  ListCardAuditRows,
} from "@/components/share/list-card";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { WhtServiceTypeMaster } from "@/types/accounting-master";
import {
  AP_MASTER_FILTER_FIELDS,
  useApMasterTable,
} from "../shared/use-ap-master-table";
import { MasterDeleteDialog } from "../shared/ap-master-dependencies";
import { whtServiceTypeCrud } from "./use-wht-service-type";
import { WhtServiceTypeDialog } from "./wht-service-type-dialog";

function useWhtServiceTypeTable(
  options: ConfigTableHookOptions<WhtServiceTypeMaster>,
) {
  const t = useTranslations("config.apMaster");
  return useApMasterTable(options, [
    {
      accessorKey: "rate_percent",
      size: 115,
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("defaultRate")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => `${Number(row.original.rate_percent).toFixed(2)}%`,
      meta: {
        headerTitle: t("defaultRate"),
        cellClassName: "text-right tabular-nums",
      },
    },
  ]);
}

export default function WhtServiceTypePage() {
  const t = useTranslations("config.apMaster");
  const tf = useTranslations("field");
  const ts = useTranslations("status");
  const deletion = whtServiceTypeCrud.useDeleteVersioned();
  return (
    <ConfigListTemplate<WhtServiceTypeMaster>
      translationNamespace="config.whtServiceType"
      mock
      entityNameField="code"
      useList={whtServiceTypeCrud.useList}
      useDelete={whtServiceTypeCrud.useDelete}
      useTable={useWhtServiceTypeTable}
      permissionPrefix="accounting.config.ap"
      pageKey={LIST_PAGE_KEYS.WHT_SERVICE_TYPE}
      filterFields={AP_MASTER_FILTER_FIELDS}
      defaultSort="code:asc"
      fixedColumnWidths
      exportColumns={[
        { header: tf("code"), value: (row) => row.code, width: 18 },
        {
          header: tf("description"),
          value: (row) => row.description,
          width: 50,
        },
        {
          header: t("defaultRate"),
          value: (row) => Number(row.rate_percent),
          width: 15,
        },
        {
          header: tf("status"),
          value: (row) => ts(row.is_active ? "active" : "inactive"),
          width: 12,
        },
      ]}
      renderDialog={(props) => <WhtServiceTypeDialog {...props} />}
      renderDeleteDialog={(props) => (
        <MasterDeleteDialog
          {...props}
          endpoint={whtServiceTypeCrud.endpoint}
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
          <ListCardRow label={t("defaultRate")}>
            {Number(item.rate_percent).toFixed(2)}%
          </ListCardRow>
          <ListCardAuditRows audit={item.audit} />
        </ListCard>
      )}
    />
  );
}
