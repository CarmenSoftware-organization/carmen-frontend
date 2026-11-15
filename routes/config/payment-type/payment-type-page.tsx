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
import { Badge } from "@/components/ui/badge";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { PaymentTypeMaster } from "@/types/accounting-master";
import {
  AP_MASTER_FILTER_FIELDS,
  useApMasterTable,
} from "../shared/use-ap-master-table";
import { MasterDeleteDialog } from "../shared/ap-master-dependencies";
import { paymentTypeCrud } from "./use-payment-type";
import { PaymentTypeDialog } from "./payment-type-dialog";
import { ApMasterMockStatus } from "../shared/ap-master-mock-status";

function usePaymentTypeTable(
  options: ConfigTableHookOptions<PaymentTypeMaster>,
) {
  const t = useTranslations("config.apMaster");
  const tf = useTranslations("field");
  const columns: ColumnDef<PaymentTypeMaster>[] = [];
  if ((options.containerWidth ?? 1000) >= 900)
    columns.push({
      id: "modules",
      size: 100,
      header: t("availableModules"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          {[
            row.original.available_ap && "AP",
            row.original.available_ar && "AR",
          ]
            .filter(Boolean)
            .map((module) => (
              <Badge variant="outline" size="sm" key={String(module)}>
                {module}
              </Badge>
            ))}
        </div>
      ),
      enableSorting: false,
      meta: { headerTitle: t("availableModules") },
    });
  if ((options.containerWidth ?? 1000) >= 1100)
    columns.push({
      accessorKey: "account_code",
      size: 200,
      header: tf("glAccount"),
      cell: ({ row }) =>
        [row.original.account_code, row.original.account_name]
          .filter(Boolean)
          .join(" · ") || "—",
      enableSorting: false,
      meta: { headerTitle: tf("glAccount") },
    });
  if ((options.containerWidth ?? 1000) >= 1400)
    columns.push({
      accessorKey: "cost_center_code",
      size: 180,
      header: tf("costCenter"),
      cell: ({ row }) =>
        [row.original.cost_center_code, row.original.cost_center_name]
          .filter(Boolean)
          .join(" · ") || "—",
      enableSorting: false,
      meta: { headerTitle: tf("costCenter") },
    });
  if ((options.containerWidth ?? 1000) >= 1200)
    columns.push({
      accessorKey: "cheque_form_name",
      size: 170,
      header: t("chequeForm"),
      cell: ({ row }) =>
        row.original.is_cheque ? row.original.cheque_form_name || "—" : "—",
      enableSorting: false,
      meta: { headerTitle: t("chequeForm") },
    });
  if ((options.containerWidth ?? 1000) >= 1000)
    columns.push({
      accessorKey: "is_cheque",
      size: 90,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("isCheque")} />
      ),
      cell: ({ row }) => (row.original.is_cheque ? "✓" : "—"),
      meta: { headerTitle: t("isCheque") },
    });
  return useApMasterTable(options, columns);
}

export default function PaymentTypePage() {
  const t = useTranslations("config.apMaster");
  const tf = useTranslations("field");
  const ts = useTranslations("status");
  const tc = useTranslations("common");
  const deletion = paymentTypeCrud.useDeleteVersioned();
  return (
    <ConfigListTemplate<PaymentTypeMaster>
      translationNamespace="config.paymentType"
      extraActions={<ApMasterMockStatus />}
      entityNameField="code"
      useList={paymentTypeCrud.useList}
      useDelete={paymentTypeCrud.useDelete}
      useTable={usePaymentTypeTable}
      permissionPrefix="accounting.config.ap"
      pageKey={LIST_PAGE_KEYS.PAYMENT_TYPE}
      filterFields={AP_MASTER_FILTER_FIELDS}
      defaultSort="code:asc"
      fixedColumnWidths
      exportColumns={[
        { header: tf("code"), value: (row) => row.code, width: 18 },
        {
          header: tf("description"),
          value: (row) => row.description,
          width: 35,
        },
        {
          header: t("availableModules"),
          value: (row) =>
            [row.available_ap && "AP", row.available_ar && "AR"]
              .filter(Boolean)
              .join(" / "),
          width: 15,
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
          header: t("isCheque"),
          value: (row) => tc(row.is_cheque ? "yes" : "no"),
          width: 12,
        },
        {
          header: tf("status"),
          value: (row) => ts(row.is_active ? "active" : "inactive"),
          width: 12,
        },
      ]}
      renderDialog={(props) => <PaymentTypeDialog {...props} />}
      renderDeleteDialog={(props) => (
        <MasterDeleteDialog
          {...props}
          endpoint={paymentTypeCrud.endpoint}
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
          <ListCardRow label={t("availableModules")}>
            {[item.available_ap && "AP", item.available_ar && "AR"]
              .filter(Boolean)
              .join(" · ")}
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
          <ListCardRow label={t("isCheque")}>
            {tc(item.is_cheque ? "yes" : "no")}
          </ListCardRow>
          <ListCardRow label={t("bankAccount")}>
            {item.bank_account_name || "—"}
          </ListCardRow>
          {item.is_cheque && (
            <ListCardRow label={t("chequeForm")}>
              {item.cheque_form_name || "—"}
            </ListCardRow>
          )}
          <ListCardAuditRows audit={item.audit} />
        </ListCard>
      )}
    />
  );
}
