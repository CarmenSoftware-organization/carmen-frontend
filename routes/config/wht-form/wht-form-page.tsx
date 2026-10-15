import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { ListCardRow } from "@/components/share/list-card";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
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
  type WhtFormMaster,
  useAccountingMasterMock,
} from "../accounting-master-mock";
import { MockConfigList } from "../shared/mock-config-list";
import { mockCodeColumn } from "../shared/mock-code-column";
import { MockEntityDialog } from "../shared/mock-entity-dialog";

const FORM_TYPES = [
  { value: "pnd1", label: "ภ.ง.ด. 1 (เงินเดือนและค่าจ้างพนักงาน)" },
  { value: "pnd2", label: "ภ.ง.ด. 2 (ดอกเบี้ย เงินปันผล)" },
  { value: "pnd3", label: "ภ.ง.ด. 3 (หัก ณ ที่จ่ายบุคคลธรรมดา)" },
  { value: "pnd53", label: "ภ.ง.ด. 53 (หัก ณ ที่จ่ายนิติบุคคล)" },
  { value: "pnd54", label: "ภ.ง.ด. 54 (ส่งไปต่างประเทศ)" },
];

export default function WhtFormPage() {
  const store = useAccountingMasterMock();
  const [editing, setEditing] = useState<WhtFormMaster | null | undefined>();
  const [deleting, setDeleting] = useState<WhtFormMaster | null>(null);

  const columns = useMemo<ColumnDef<WhtFormMaster>[]>(
    () => [
      mockCodeColumn<WhtFormMaster>("Form Code", setEditing),
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Form Description" />
        ),
        meta: {
          headerTitle: "Form Description",
          skeleton: columnSkeletons.text,
        },
      },
      {
        accessorKey: "form_type",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Form Type" />
        ),
        cell: ({ row }) => (
          <Badge
            data-standard-chip=""
            variant="outline"
            size="sm"
            className="font-mono uppercase"
          >
            {row.original.form_type}
          </Badge>
        ),
        size: 120,
        meta: { headerTitle: "Form Type", skeleton: columnSkeletons.textShort },
      },
      {
        accessorKey: "gl_account_id",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="GL Control Account" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.gl_account_id || "—"}
          </span>
        ),
        meta: {
          headerTitle: "GL Control Account",
          skeleton: columnSkeletons.textShort,
        },
      },
    ],
    [],
  );

  return (
    <MockConfigList
      title="WHT Tax Return Forms"
      description="Revenue Department filing forms (ภ.ง.ด. 1/2/3/53/54) and their GL liability accounts"
      addLabel="Add WHT Form"
      exportName="WHT Forms"
      items={store.whtForms}
      searchText={(item) =>
        `${item.code} ${item.description} ${item.form_type} ${item.gl_account_id ?? ""}`
      }
      columns={columns}
      exportColumns={[
        { header: "Form Code", value: (r) => r.code, width: 14 },
        { header: "Form Description", value: (r) => r.description, width: 36 },
        { header: "Form Type", value: (r) => r.form_type, width: 12 },
        {
          header: "GL Control Account",
          value: (r) => r.gl_account_id ?? "",
          width: 20,
        },
        {
          header: "Status",
          value: (r) => (r.is_active ? "Active" : "Inactive"),
          width: 10,
        },
      ]}
      renderCardRows={(item) => (
        <>
          <ListCardRow label="Description">{item.description}</ListCardRow>
          <ListCardRow label="Form Type">
            <span className="font-mono uppercase">{item.form_type}</span>
          </ListCardRow>
        </>
      )}
      onAdd={() => setEditing(null)}
      onEdit={setEditing}
      onDelete={setDeleting}
    >
      <WhtFormDialog
        key={editing?.id ?? "new"}
        open={editing !== undefined}
        item={editing ?? null}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onSave={(value) => {
          store.saveWhtForm(value, editing?.id);
          toast.success(editing ? "WHT form updated" : "WHT form created");
          setEditing(undefined);
        }}
      />
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete WHT form?"
        description={
          deleting
            ? `Delete ${deleting.code} — ${deleting.description}?`
            : undefined
        }
        onConfirm={() => {
          if (!deleting) return;
          store.deleteWhtForm(deleting);
          toast.success("WHT form deleted");
          setDeleting(null);
        }}
      />
    </MockConfigList>
  );
}

function WhtFormDialog({
  open,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  item: WhtFormMaster | null;
  onOpenChange: (open: boolean) => void;
  onSave: (value: Omit<WhtFormMaster, "id" | "doc_version">) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [formType, setFormType] = useState(item?.form_type ?? "pnd3");
  const [glAccountId, setGlAccountId] = useState(item?.gl_account_id ?? "");
  const [active, setActive] = useState(item?.is_active ?? true);

  return (
    <MockEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={FileSpreadsheet}
      title={item ? "Edit WHT Form" : "Add WHT Form"}
      subtitle="Statutory withholding tax filing and liability mapping."
      isEdit={!!item}
      canSubmit={!!code.trim() && !!description.trim()}
      onSubmit={() =>
        onSave({
          code,
          description,
          form_type: formType,
          gl_account_id: glAccountId || null,
          is_active: active,
        })
      }
    >
      <Field>
        <FieldLabel htmlFor="form-code" required>
          Form Code
        </FieldLabel>
        <FieldInput
          id="form-code"
          className="h-8"
          value={code}
          disabled={!!item}
          maxLength={20}
          placeholder="e.g. PND3, PND53"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="form-desc" required>
          Form Description
        </FieldLabel>
        <FieldInput
          id="form-desc"
          className="h-8"
          value={description}
          maxLength={100}
          placeholder="e.g. ภ.ง.ด. 3 (บุคคลธรรมดา)"
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel required>Form Type</FieldLabel>
        <FieldSelect value={formType} onValueChange={setFormType}>
          <SelectContent>
            {FORM_TYPES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </FieldSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="form-gl">GL Liability Account</FieldLabel>
        <LookupChartOfAccount
          value={glAccountId}
          category="liability"
          placeholder="Select liability GL account"
          onValueChange={setGlAccountId}
        />
      </Field>
      <StatusSwitch
        id="wht-form-active"
        checked={active}
        onCheckedChange={setActive}
      />
    </MockEntityDialog>
  );
}
