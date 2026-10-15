import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Percent } from "lucide-react";
import { toast } from "sonner";
import { ListCardRow } from "@/components/share/list-card";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { StatusSwitch } from "@/components/ui/status-switch";
import {
  type WhtServiceTypeMaster,
  useAccountingMasterMock,
} from "../accounting-master-mock";
import { MockConfigList } from "../shared/mock-config-list";
import { mockCodeColumn } from "../shared/mock-code-column";
import { MockEntityDialog } from "../shared/mock-entity-dialog";

export default function WhtServiceTypePage() {
  const store = useAccountingMasterMock();
  const [editing, setEditing] = useState<
    WhtServiceTypeMaster | null | undefined
  >();
  const [deleting, setDeleting] = useState<WhtServiceTypeMaster | null>(null);

  const columns = useMemo<ColumnDef<WhtServiceTypeMaster>[]>(
    () => [
      mockCodeColumn<WhtServiceTypeMaster>("Service Type Code", setEditing),
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Service Description" />
        ),
        meta: {
          headerTitle: "Service Description",
          skeleton: columnSkeletons.text,
        },
      },
      {
        id: "default_rate",
        accessorFn: (row) => Number(row.default_rate),
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title="Default Rate"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.default_rate}%</span>
        ),
        size: 130,
        meta: {
          headerTitle: "Default Rate",
          headerClassName: "text-right",
          cellClassName: "text-right",
          skeleton: columnSkeletons.number,
        },
      },
    ],
    [],
  );

  return (
    <MockConfigList
      title="WHT Service Types"
      description="Withholding tax service classifications and default rates for AP Payment Vouchers and WHT Certificates"
      addLabel="Add Service Type"
      exportName="WHT Service Types"
      items={store.whtServiceTypes}
      searchText={(item) =>
        `${item.code} ${item.description} ${item.default_rate}`
      }
      columns={columns}
      exportColumns={[
        { header: "Service Type Code", value: (r) => r.code, width: 18 },
        {
          header: "Service Description",
          value: (r) => r.description,
          width: 36,
        },
        { header: "Default Rate (%)", value: (r) => r.default_rate, width: 14 },
        {
          header: "Status",
          value: (r) => (r.is_active ? "Active" : "Inactive"),
          width: 10,
        },
      ]}
      renderCardRows={(item) => (
        <>
          <ListCardRow label="Description">{item.description}</ListCardRow>
          <ListCardRow label="Rate">{item.default_rate}%</ListCardRow>
        </>
      )}
      onAdd={() => setEditing(null)}
      onEdit={setEditing}
      onDelete={setDeleting}
    >
      <WhtServiceTypeDialog
        key={editing?.id ?? "new"}
        open={editing !== undefined}
        item={editing ?? null}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onSave={(value) => {
          store.saveWhtServiceType(value, editing?.id);
          toast.success(
            editing ? "WHT service type updated" : "WHT service type created",
          );
          setEditing(undefined);
        }}
      />
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete WHT service type?"
        description={
          deleting
            ? `Delete ${deleting.code} — ${deleting.description}?`
            : undefined
        }
        onConfirm={() => {
          if (!deleting) return;
          store.deleteWhtServiceType(deleting);
          toast.success("WHT service type deleted");
          setDeleting(null);
        }}
      />
    </MockConfigList>
  );
}

function WhtServiceTypeDialog({
  open,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  item: WhtServiceTypeMaster | null;
  onOpenChange: (open: boolean) => void;
  onSave: (value: Omit<WhtServiceTypeMaster, "id" | "doc_version">) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [defaultRate, setDefaultRate] = useState(item?.default_rate ?? "3.00");
  const [active, setActive] = useState(item?.is_active ?? true);

  return (
    <MockEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Percent}
      title={item ? "Edit WHT Service Type" : "Add WHT Service Type"}
      subtitle="Withholding tax rate category for vendor payment deductions."
      isEdit={!!item}
      canSubmit={!!code.trim() && !!description.trim() && !!defaultRate.trim()}
      onSubmit={() =>
        onSave({
          code,
          description,
          default_rate: defaultRate,
          is_active: active,
        })
      }
    >
      <Field>
        <FieldLabel htmlFor="wht-code" required>
          Service Type Code
        </FieldLabel>
        <FieldInput
          id="wht-code"
          className="h-8"
          value={code}
          disabled={!!item}
          maxLength={20}
          placeholder="e.g. WHT-SVC, WHT-RENT"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="wht-desc" required>
          Description
        </FieldLabel>
        <FieldInput
          id="wht-desc"
          className="h-8"
          value={description}
          maxLength={100}
          placeholder="e.g. Service Fee (ค่าจ้างทำของ/บริการ)"
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="wht-rate" required>
          Default Tax Rate (%)
        </FieldLabel>
        <FieldInput
          id="wht-rate"
          className="h-8"
          value={defaultRate}
          placeholder="e.g. 1.00, 2.00, 3.00, 5.00"
          onChange={(e) => setDefaultRate(e.target.value)}
        />
      </Field>
      <StatusSwitch
        id="wht-service-type-active"
        checked={active}
        onCheckedChange={setActive}
      />
    </MockEntityDialog>
  );
}
