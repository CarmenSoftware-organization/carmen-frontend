import { useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusSwitch } from "@/components/ui/status-switch";
import { useBuCode } from "@/hooks/use-bu-code";
import type {
  DimensionDataType,
  DimensionMaster,
  DimensionValueMaster,
} from "@/types/accounting-master";
import { DIMENSION_DATA_TYPES } from "./dimension-data-types";
import {
  saveDimensionWithValues,
  type DimensionValueDraft,
} from "./save-dimension-with-values";

export function DimensionDialog({
  open,
  readOnly = false,
  focusValues: _focusValues = false,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  readOnly?: boolean;
  /** เปิดจากปุ่มจำนวนค่าย่อย → focus ที่ตารางค่าย่อย */
  focusValues?: boolean;
  item: DimensionMaster | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    value: Omit<DimensionMaster, "id" | "doc_version" | "values">,
    current: DimensionMaster | null,
  ) => Promise<DimensionMaster>;
}) {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const [savedItem, setSavedItem] = useState(item);
  const [subValues, setSubValues] = useState<DimensionValueDraft[]>(() =>
    (item?.values ?? []).map((value) => ({
      ...value,
      key: value.id,
      dirty: false,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [failedSummary, setFailedSummary] = useState("");
  const initial = getDimensionFormDefaults(item);
  const [code, setCode] = useState(initial.code);
  const [name, setName] = useState(initial.name);
  const [nameLocal, setNameLocal] = useState(initial.name_local);
  const [active, setActive] = useState(initial.is_active);
  const [dataType, setDataType] = useState<DimensionDataType>(
    initial.data_type,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="@container max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? "Dimension Detail"
              : item
                ? "Edit Dimension"
                : "Add Dimension"}
          </DialogTitle>
          <DialogDescription>
            Defines a category of analytical tags (e.g., market segment,
            project).
          </DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={readOnly || saving}
          className="grid gap-4 py-2 @md:grid-cols-2"
        >
          <Field>
            <FieldLabel htmlFor="dim-code" required>
              Dimension Code (lowercase/underscore)
            </FieldLabel>
            <FieldInput
              id="dim-code"
              value={code}
              disabled={!!savedItem}
              maxLength={20}
              placeholder="e.g. market, project, event"
              onChange={(e) =>
                setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dim-name" required>
              Dimension Name (EN)
            </FieldLabel>
            <FieldInput
              id="dim-name"
              value={name}
              maxLength={100}
              placeholder="e.g. Market Segment"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dim-name-local">
              Dimension Name (TH)
            </FieldLabel>
            <FieldInput
              id="dim-name-local"
              value={nameLocal}
              maxLength={100}
              placeholder="e.g. กลุ่มตลาด"
              onChange={(e) => setNameLocal(e.target.value)}
            />
          </Field>
          <DimensionTypeFields
            dataType={dataType}
            disabled={readOnly || saving}
            onDataTypeChange={setDataType}
          />
          <StatusSwitch
            id="dim-active"
            checked={active}
            onCheckedChange={setActive}
          />
        </fieldset>
        {dataType === "lookup" && (
          <DimensionSubValues
            readOnly={readOnly || saving}
            savedId={savedItem?.id}
            subValues={subValues}
            setSubValues={setSubValues}
          />
        )}
        {failedSummary && (
          <p aria-live="polite" className="text-destructive text-xs">
            {failedSummary}
          </p>
        )}
        {saveError && (
          <p role="alert" className="text-destructive text-xs">
            {saveError}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button
              disabled={saving || !code.trim() || !name.trim()}
              onClick={async () => {
                setSaving(true);
                setSaveError("");
                setFailedSummary("");
                try {
                  const { failed } = await saveDimensionWithValues({
                    buCode,
                    values: {
                      code: code.trim(),
                      name: name.trim(),
                      name_local: nameLocal.trim() || null,
                      is_active: active,
                      data_type: dataType,
                    },
                    savedItem,
                    subValues:
                      dataType === "lookup"
                        ? subValues
                        : subValues.filter((value) => value.deleted),
                    onSave,
                    setSavedItem,
                    setSubValues,
                  });
                  if (failed > 0) {
                    setFailedSummary(
                      `${failed} item(s) failed to save. Fix them and press Save again.`,
                    );
                  } else {
                    toast.success("Dimension and sub-values saved");
                    onOpenChange(false);
                  }
                } catch (error) {
                  setSaveError(
                    error instanceof Error
                      ? error.message
                      : "Unable to save dimension. Retry Save.",
                  );
                } finally {
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: ["accounting-master", "dimensions", buCode],
                    }),
                    queryClient.invalidateQueries({
                      queryKey: [
                        "accounting-master",
                        "dimension-values",
                        buCode,
                      ],
                    }),
                  ]);
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : savedItem ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DimensionSubValues({
  readOnly,
  savedId,
  subValues,
  setSubValues,
}: {
  readOnly: boolean;
  savedId?: string;
  subValues: DimensionValueDraft[];
  setSubValues: Dispatch<SetStateAction<DimensionValueDraft[]>>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const selectedKeys = new Set(selected);
  const visibleValues = subValues.filter((value) => !value.deleted);
  return (
    <fieldset disabled={readOnly} className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">List Master Items</h3>
        {!readOnly && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setSubValues((current) => [
                  ...current,
                  {
                    key: crypto.randomUUID(),
                    id: "",
                    dimension_id: savedId ?? "",
                    doc_version: 0,
                    code: "",
                    name: "",
                    name_local: "",
                    is_active: true,
                    dirty: true,
                  },
                ])
              }
            >
              <Plus className="size-4" /> Add Value
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!selected.length}
              onClick={() => {
                setSubValues((current) =>
                  current.flatMap((row) =>
                    !selectedKeys.has(row.key)
                      ? [row]
                      : row.id
                        ? [{ ...row, deleted: true }]
                        : [],
                  ),
                );
                setSelected([]);
              }}
            >
              <Trash2 className="size-4" /> Delete
              {selected.length ? ` (${selected.length})` : ""}
            </Button>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Manage the values available for this dimension in Journal Vouchers.
      </p>
      {subValues.some((value) => value.deleted) && (
        <p className="text-muted-foreground text-xs">
          Selected items will be deleted when you save.
        </p>
      )}
      {!visibleValues.length && (
        <p className="text-muted-foreground text-xs">
          No list master items defined yet.
        </p>
      )}
      {visibleValues.map((value, index) => {
        const update = (patch: Partial<DimensionValueMaster>) =>
          setSubValues((current) =>
            current.map((row) =>
              row.key === value.key
                ? { ...row, ...patch, dirty: true, error: undefined }
                : row,
            ),
          );
        return (
          <div
            key={value.key}
            className={`grid gap-3 border-b pb-4 ${readOnly ? "@xl:grid-cols-3" : "@xl:grid-cols-[auto_1fr_1fr_1fr]"}`}
          >
            {!readOnly && (
              <Checkbox
                className="mb-2 self-end"
                aria-label={`Select sub-value ${index + 1}`}
                checked={selectedKeys.has(value.key)}
                onCheckedChange={(checked) =>
                  setSelected((current) =>
                    checked === true
                      ? [...current, value.key]
                      : current.filter((key) => key !== value.key),
                  )
                }
              />
            )}
            <Field>
              <FieldLabel htmlFor={`sub-code-${value.key}`} required>
                Code
              </FieldLabel>
              <FieldInput
                id={`sub-code-${value.key}`}
                value={value.code}
                disabled={!!value.id}
                maxLength={10}
                onChange={(e) => update({ code: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`sub-name-${value.key}`} required>
                Name (EN)
              </FieldLabel>
              <FieldInput
                id={`sub-name-${value.key}`}
                value={value.name}
                maxLength={50}
                onChange={(e) => update({ name: e.target.value })}
              />
              {value.error && (
                <p role="alert" className="text-destructive text-xs">
                  {value.error}
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor={`sub-local-${value.key}`}>
                Name (TH)
              </FieldLabel>
              <FieldInput
                id={`sub-local-${value.key}`}
                value={value.name_local ?? ""}
                maxLength={100}
                onChange={(e) => update({ name_local: e.target.value })}
              />
            </Field>
          </div>
        );
      })}
    </fieldset>
  );
}

function DimensionTypeFields({
  dataType,
  disabled,
  onDataTypeChange,
}: {
  dataType: DimensionDataType;
  disabled: boolean;
  onDataTypeChange: (value: DimensionDataType) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="dim-data-type" required>
        Data Type
      </FieldLabel>
      <Select
        value={dataType}
        disabled={disabled}
        onValueChange={(value) => onDataTypeChange(value as DimensionDataType)}
      >
        <SelectTrigger id="dim-data-type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIMENSION_DATA_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function getDimensionFormDefaults(item: DimensionMaster | null) {
  return {
    code: item?.code ?? "",
    name: item?.name ?? "",
    name_local: item?.name_local ?? "",
    is_active: item?.is_active ?? true,
    data_type: item ? (item.data_type ?? "lookup") : "string",
  } as const;
}
