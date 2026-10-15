import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { ListCardRow } from "@/components/share/list-card";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { StatusSwitch } from "@/components/ui/status-switch";
import { WarningDialog } from "@/components/ui/warning-dialog";
import {
  type TitleMaster,
  useAccountingMasterMock,
} from "../accounting-master-mock";
import { MockConfigList } from "../shared/mock-config-list";
import { mockCodeColumn } from "../shared/mock-code-column";
import { MockEntityDialog } from "../shared/mock-entity-dialog";

export default function TitleMasterPage() {
  const store = useAccountingMasterMock();
  const [editing, setEditing] = useState<TitleMaster | null | undefined>();
  const [deleting, setDeleting] = useState<TitleMaster | null>(null);
  const [warning, setWarning] = useState("");

  const columns = useMemo<ColumnDef<TitleMaster>[]>(
    () => [
      mockCodeColumn<TitleMaster>("Title Code", setEditing),
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Description" />
        ),
        meta: { headerTitle: "Description", skeleton: columnSkeletons.text },
      },
      {
        accessorKey: "reference_count",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title="Linked records"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.reference_count}</span>
        ),
        size: 140,
        meta: {
          headerTitle: "Linked records",
          headerClassName: "text-right",
          cellClassName: "text-right",
          skeleton: columnSkeletons.number,
        },
      },
    ],
    [],
  );

  const remove = () => {
    if (!deleting) return;
    try {
      store.deleteTitle(deleting);
      toast.success("Title deleted");
      setDeleting(null);
    } catch (error) {
      setDeleting(null);
      setWarning(
        error instanceof Error ? error.message : "Unable to delete title",
      );
    }
  };

  return (
    <MockConfigList
      title="Title Master"
      description="Honorifics used by customer, guest and accounting profiles"
      addLabel="Add Title"
      exportName="Title Master"
      items={store.titles}
      columns={columns}
      exportColumns={[
        { header: "Title Code", value: (r) => r.code, width: 14 },
        { header: "Description", value: (r) => r.description, width: 32 },
        {
          header: "Linked records",
          value: (r) => r.reference_count,
          width: 14,
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
          <ListCardRow label="Linked">{item.reference_count}</ListCardRow>
        </>
      )}
      onAdd={() => setEditing(null)}
      onEdit={setEditing}
      onDelete={setDeleting}
    >
      <TitleDialog
        key={editing?.id ?? "new"}
        open={editing !== undefined}
        item={editing ?? null}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onSave={(values) => {
          try {
            store.saveTitle(values, editing?.id);
            toast.success(editing ? "Title updated" : "Title created");
            setEditing(undefined);
          } catch (error) {
            setWarning(
              error instanceof Error ? error.message : "Unable to save title",
            );
          }
        }}
      />
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete title?"
        description={
          deleting
            ? `Delete ${deleting.code} — ${deleting.description}?`
            : undefined
        }
        onConfirm={remove}
      />
      <WarningDialog
        open={!!warning}
        title="Action blocked"
        description={warning}
        onConfirm={() => setWarning("")}
      />
    </MockConfigList>
  );
}

function TitleDialog({
  open,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  item: TitleMaster | null;
  onOpenChange: (open: boolean) => void;
  onSave: (value: {
    code: string;
    description: string;
    is_active: boolean;
  }) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [active, setActive] = useState(item?.is_active ?? true);
  return (
    <MockEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={UserRound}
      title={item ? "Edit Title" : "Add Title"}
      subtitle="Code is locked after the title is created."
      isEdit={!!item}
      canSubmit={!!code.trim() && !!description.trim()}
      onSubmit={() => onSave({ code, description, is_active: active })}
    >
      <Field>
        <FieldLabel htmlFor="title-code" required>
          Title Code
        </FieldLabel>
        <FieldInput
          id="title-code"
          className="h-8"
          value={code}
          disabled={!!item}
          maxLength={15}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="title-description" required>
          Description
        </FieldLabel>
        <FieldInput
          id="title-description"
          className="h-8"
          value={description}
          maxLength={50}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <StatusSwitch
        id="title-active"
        checked={active}
        onCheckedChange={setActive}
      />
    </MockEntityDialog>
  );
}
