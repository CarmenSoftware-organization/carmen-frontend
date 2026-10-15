import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { ListCardRow } from "@/components/share/list-card";
import { Badge } from "@/components/ui/badge";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { StatusSwitch } from "@/components/ui/status-switch";
import {
  type PaymentTypeMaster,
  useAccountingMasterMock,
} from "../accounting-master-mock";
import { MockConfigList } from "../shared/mock-config-list";
import { mockCodeColumn } from "../shared/mock-code-column";
import { MockEntityDialog } from "../shared/mock-entity-dialog";

const PAYMENT_METHODS = [
  { value: "transfer", label: "Bank Transfer (โอนเงินผ่านธนาคาร)" },
  { value: "cheque", label: "Bank Cheque (เช็คธนาคาร)" },
  { value: "cash", label: "Cash / Petty Cash (เงินสด/เงินสดย่อย)" },
  { value: "credit_card", label: "Credit Card (บัตรเครดิต)" },
  { value: "other", label: "Other (อื่นๆ)" },
];

export default function PaymentTypePage() {
  const store = useAccountingMasterMock();
  const [editing, setEditing] = useState<
    PaymentTypeMaster | null | undefined
  >();
  const [deleting, setDeleting] = useState<PaymentTypeMaster | null>(null);

  const columns = useMemo<ColumnDef<PaymentTypeMaster>[]>(
    () => [
      mockCodeColumn<PaymentTypeMaster>("Payment Type Code", setEditing),
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Description (EN)" />
        ),
        meta: {
          headerTitle: "Description (EN)",
          skeleton: columnSkeletons.text,
        },
      },
      {
        accessorKey: "description_local",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Description (TH)" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.description_local || "—"}
          </span>
        ),
        meta: {
          headerTitle: "Description (TH)",
          skeleton: columnSkeletons.text,
        },
      },
      {
        accessorKey: "payment_method",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Method" />
        ),
        cell: ({ row }) => (
          <Badge
            data-standard-chip=""
            variant="outline"
            size="sm"
            className="font-mono uppercase"
          >
            {row.original.payment_method}
          </Badge>
        ),
        size: 140,
        meta: { headerTitle: "Method", skeleton: columnSkeletons.textShort },
      },
    ],
    [],
  );

  return (
    <MockConfigList
      title="Payment Types"
      description="Payment instruments that categorize AP Payment Vouchers and AR Receipts"
      addLabel="Add Payment Type"
      exportName="Payment Types"
      items={store.paymentTypes}
      searchText={(item) =>
        `${item.code} ${item.description} ${item.description_local ?? ""} ${item.payment_method}`
      }
      columns={columns}
      exportColumns={[
        { header: "Payment Type Code", value: (r) => r.code, width: 18 },
        { header: "Description (EN)", value: (r) => r.description, width: 28 },
        {
          header: "Description (TH)",
          value: (r) => r.description_local ?? "",
          width: 28,
        },
        { header: "Method", value: (r) => r.payment_method, width: 14 },
        {
          header: "Status",
          value: (r) => (r.is_active ? "Active" : "Inactive"),
          width: 10,
        },
      ]}
      renderCardRows={(item) => (
        <>
          <ListCardRow label="Description">{item.description}</ListCardRow>
          <ListCardRow label="Method">
            <span className="font-mono uppercase">{item.payment_method}</span>
          </ListCardRow>
        </>
      )}
      onAdd={() => setEditing(null)}
      onEdit={setEditing}
      onDelete={setDeleting}
    >
      <PaymentTypeDialog
        key={editing?.id ?? "new"}
        open={editing !== undefined}
        item={editing ?? null}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onSave={(value) => {
          store.savePaymentType(value, editing?.id);
          toast.success(
            editing ? "Payment type updated" : "Payment type created",
          );
          setEditing(undefined);
        }}
      />
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete payment type?"
        description={
          deleting
            ? `Delete ${deleting.code} — ${deleting.description}?`
            : undefined
        }
        onConfirm={() => {
          if (!deleting) return;
          store.deletePaymentType(deleting);
          toast.success("Payment type deleted");
          setDeleting(null);
        }}
      />
    </MockConfigList>
  );
}

function PaymentTypeDialog({
  open,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  item: PaymentTypeMaster | null;
  onOpenChange: (open: boolean) => void;
  onSave: (value: Omit<PaymentTypeMaster, "id" | "doc_version">) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [descriptionLocal, setDescriptionLocal] = useState(
    item?.description_local ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    item?.payment_method ?? "transfer",
  );
  const [active, setActive] = useState(item?.is_active ?? true);

  return (
    <MockEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={CreditCard}
      title={item ? "Edit Payment Type" : "Add Payment Type"}
      subtitle="Defines the payment instrument for financial transactions."
      isEdit={!!item}
      canSubmit={!!code.trim() && !!description.trim()}
      onSubmit={() =>
        onSave({
          code,
          description,
          description_local: descriptionLocal || null,
          payment_method: paymentMethod,
          is_active: active,
        })
      }
    >
      <Field>
        <FieldLabel htmlFor="pm-code" required>
          Payment Type Code
        </FieldLabel>
        <FieldInput
          id="pm-code"
          className="h-8"
          value={code}
          disabled={!!item}
          maxLength={20}
          placeholder="e.g. TRANSFER, CHEQUE, CASH"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="pm-desc" required>
          Description (EN)
        </FieldLabel>
        <FieldInput
          id="pm-desc"
          className="h-8"
          value={description}
          maxLength={100}
          placeholder="e.g. Bank Transfer"
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="pm-desc-local">Description (TH)</FieldLabel>
        <FieldInput
          id="pm-desc-local"
          className="h-8"
          value={descriptionLocal}
          maxLength={100}
          placeholder="e.g. โอนเงินผ่านธนาคาร"
          onChange={(e) => setDescriptionLocal(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel required>Payment Method</FieldLabel>
        <FieldSelect value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectContent>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </FieldSelect>
      </Field>
      <StatusSwitch
        id="payment-type-active"
        checked={active}
        onCheckedChange={setActive}
      />
    </MockEntityDialog>
  );
}
