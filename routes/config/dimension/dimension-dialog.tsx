import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type {
  DimensionDataType,
  DimensionMaster,
} from "@/types/accounting-master";
import { DIMENSION_DATA_TYPES } from "./dimension-data-types";
import { DimensionValuesTable } from "./dimension-values-table";
import {
  saveDimensionWithValues,
  type DimensionValueDraft,
} from "./save-dimension-with-values";

export function DimensionDialog({
  open,
  readOnly = false,
  focusValues = false,
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
  const isLookup = dataType === "lookup";
  const tableRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent
        onOpenAutoFocus={(event) => {
          if (!focusValues || !tableRef.current) return;
          event.preventDefault();
          const target = tableRef.current.querySelector<HTMLElement>(
            "input:not([disabled]), button:not([disabled])",
          );
          if (target) target.focus();
          else tableRef.current.scrollIntoView({ block: "nearest" });
        }}
        className={cn(
          "@container max-h-[90dvh] overflow-y-auto",
          isLookup ? "sm:max-w-5xl" : "sm:max-w-xl",
        )}
      >
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
        <div
          className={cn(
            "grid gap-4 py-2",
            isLookup && "@3xl:grid-cols-[16rem_minmax(0,1fr)]",
          )}
        >
          <fieldset
            disabled={readOnly || saving}
            className={cn(
              "grid content-start gap-4",
              !isLookup && "@md:grid-cols-2",
            )}
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
                  setCode(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  )
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
          {isLookup && (
            <fieldset disabled={saving} className="min-w-0">
              <DimensionValuesTable
                readOnly={readOnly}
                savedId={savedItem?.id}
                subValues={subValues}
                setSubValues={setSubValues}
                tableRef={tableRef}
              />
            </fieldset>
          )}
        </div>
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
