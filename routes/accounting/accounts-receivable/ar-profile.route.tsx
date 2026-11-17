import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardActiveRow,
  ListCardRow,
} from "@/components/share/list-card";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import type { ConfigTableHookOptions } from "@/components/templates/types";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { QUERY_KEYS } from "@/constant/query-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import type { FilterFieldDef } from "@/types/list-filter";
import { readProfileExtension } from "./ar-profile-model";
import {
  useArCustomers,
  useDeleteArCustomer,
  type ArCustomer,
} from "./use-ar-customer";

const PROFILE_FILTERS: FilterFieldDef[] = [
  {
    key: "filter",
    control: "status",
    labelKey: "common.status",
    options: [
      { labelKey: "status.active", value: "is_active|boolean:true" },
      { labelKey: "status.inactive", value: "is_active|boolean:false" },
    ],
  },
];

export function Component() {
  const bu = useBuCode();
  const client = useQueryClient();
  const { canWrite } = useCan();
  const t = useTranslations("accounting.arProfile");
  const tc = useTranslations("common");
  const ts = useTranslations("status");

  return (
    <ConfigListTemplate<ArCustomer>
      key={bu}
      translationNamespace="accounting.arProfile"
      entityNameField="name"
      useList={useArCustomers}
      useDelete={useDeleteArCustomer}
      useTable={useArProfileTable}
      defaultSort="code:asc"
      fixedColumnWidths
      pageKey={LIST_PAGE_KEYS.AR_PROFILE}
      filterFields={PROFILE_FILTERS}
      extraActions={
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={tc("refresh")}
          onClick={() =>
            void client.invalidateQueries({
              queryKey: [QUERY_KEYS.CUSTOMERS, bu],
            })
          }
        >
          <RefreshCw />
        </Button>
      }
      exportColumns={[
        { header: t("code"), value: (row) => row.code },
        { header: t("name"), value: (row) => row.name },
        { header: t("taxId"), value: (row) => row.tax_no ?? "" },
        { header: t("creditTerm"), value: (row) => row.credit_term_name ?? "" },
        {
          header: tc("status"),
          value: (row) => ts(row.is_active !== false ? "active" : "inactive"),
        },
      ]}
      addPath="/accounting/accounts-receivable/profile/new"
      getEditPath={(entity) =>
        `/accounting/accounts-receivable/profile/${entity.id}?mode=edit`
      }
      renderCard={({ item, onDelete }) => (
        <ProfileView id={item.id} canWrite={canWrite}>
          {(open) => (
            <ListCard
              title={item.code}
              onOpen={open}
              onDelete={() => onDelete(item)}
            >
              <ListCardActiveRow active={item.is_active !== false} />
              <ListCardRow label={t("name")}>{item.name}</ListCardRow>
              <ListCardRow label={t("taxId")}>{item.tax_no || "—"}</ListCardRow>
              <ListCardRow label={t("creditTerm")}>
                {item.credit_term_name || "—"}
              </ListCardRow>
            </ListCard>
          )}
        </ProfileView>
      )}
    />
  );
}

function useArProfileTable(options: ConfigTableHookOptions<ArCustomer>) {
  "use no memo";
  const t = useTranslations("accounting.arProfile");
  const { canWrite } = useCan();
  const bu = useBuCode() ?? "";
  const columns = useMemo<ColumnDef<ArCustomer>[]>(
    () =>
      (
        [
          ["code", t("code")],
          ["registerDate", t("registerDate")],
          ["title", t("contactTitle")],
          ["firstName", t("firstName")],
          ["lastName", t("lastName")],
          ["name", t("companyName")],
          ["telephone", t("telephone")],
          ["tax_no", t("taxId")],
        ] as const
      ).map(([key, title]) => ({
        id: key,
        enableSorting: ["code", "name", "tax_no"].includes(key),
        accessorFn: (row) =>
          key in row
            ? row[key as keyof ArCustomer]
            : readProfileExtension(bu, row.id)[
                key as
                  | "registerDate"
                  | "title"
                  | "firstName"
                  | "lastName"
                  | "telephone"
              ],
        size: key === "name" ? 250 : key === "tax_no" ? 160 : 145,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={title} />
        ),
        meta: { headerTitle: title },
        cell: ({ row: { original } }) =>
          key === "code" ? (
            <ProfileView id={original.id} canWrite={canWrite}>
              {(open) => (
                <CellAction onClick={open}>{original.code}</CellAction>
              )}
            </ProfileView>
          ) : (
            String(
              key in original
                ? (original[key as keyof ArCustomer] ?? "—")
                : readProfileExtension(bu, original.id)[
                    key as
                      | "registerDate"
                      | "title"
                      | "firstName"
                      | "lastName"
                      | "telephone"
                  ] || "—",
            )
          ),
      })),
    [canWrite, bu, t],
  );
  return useConfigTable({
    ...options,
    columns,
    edit: canWrite ? { onClick: options.onEdit } : undefined,
  });
}

function ProfileView({
  id,
  children,
}: {
  readonly id: string;
  readonly canWrite: boolean;
  readonly children: (open: () => void) => ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <>
      {children(() =>
        navigate(`/accounting/accounts-receivable/profile/${id}`),
      )}
    </>
  );
}
