import { useState, type Dispatch, type Ref, type SetStateAction } from "react";
import { Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { DimensionValueMaster } from "@/types/accounting-master";
import type { DimensionValueDraft } from "./save-dimension-with-values";

/**
 * ตารางค่าย่อย (List Master Items) ใน dialog แก้ dimension — แก้ในแถว ค้างไว้จนกด Save ของ dialog
 * สถานะแถว: แก้แล้ว (แถบซ้าย) · ใหม่ (พื้นฟ้า) · จะลบ (ขีดฆ่า + Undo) · บันทึกไม่ผ่าน (พื้นแดง + ข้อความ)
 */
export function DimensionValuesTable({
  readOnly,
  savedId,
  subValues,
  setSubValues,
  tableRef,
}: {
  readOnly: boolean;
  savedId?: string;
  subValues: DimensionValueDraft[];
  setSubValues: Dispatch<SetStateAction<DimensionValueDraft[]>>;
  tableRef?: Ref<HTMLDivElement>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const selectedKeys = new Set(selected);
  // แถวที่กดลบแล้วแสดงปุ่ม Undo แทน checkbox จึงไม่นับเป็นแถวที่เลือกได้
  const selectableKeys = subValues
    .filter((value) => !value.deleted)
    .map((value) => value.key);
  const selectedCount = selectableKeys.filter((key) =>
    selectedKeys.has(key),
  ).length;
  const allState =
    selectableKeys.length > 0 && selectedCount === selectableKeys.length
      ? true
      : selectedCount > 0
        ? "indeterminate"
        : false;
  const liveCount = subValues.filter((value) => !value.deleted).length;
  const hasEdited = subValues.some((v) => v.id && v.dirty && !v.deleted);
  const hasNew = subValues.some((v) => !v.id);
  const hasDeleted = subValues.some((v) => v.deleted);
  const hasFailed = subValues.some((v) => v.error);
  const columnCount = readOnly ? 5 : 6;

  const patchRow = (key: string, patch: Partial<DimensionValueDraft>) =>
    setSubValues((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  const edit = (key: string, patch: Partial<DimensionValueMaster>) =>
    patchRow(key, { ...patch, dirty: true, error: undefined });

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          List Master Items · {liveCount}
        </h3>
        {!readOnly && (
          <div className="flex flex-wrap justify-end gap-2">
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
                        ? [{ ...row, deleted: true, error: undefined }]
                        : [],
                  ),
                );
                setSelected([]);
              }}
            >
              <Trash2 className="size-4" /> Delete
              {selected.length ? ` (${selected.length})` : ""}
            </Button>
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
                    description: "",
                    is_active: true,
                    dirty: true,
                  },
                ])
              }
            >
              <Plus className="size-4" /> Add Value
            </Button>
          </div>
        )}
      </div>
      <div
        ref={tableRef}
        className="max-h-[60dvh] overflow-auto rounded-md border"
      >
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0 z-10">
            <tr className="text-muted-foreground text-left">
              {!readOnly && (
                <th className="w-8 p-2">
                  <Checkbox
                    aria-label="Select all sub-values"
                    checked={allState}
                    disabled={!selectableKeys.length}
                    onCheckedChange={() =>
                      setSelected(allState === true ? [] : selectableKeys)
                    }
                  />
                </th>
              )}
              <th className="w-10 p-2 text-right font-medium">#</th>
              <th className="w-28 p-2 font-medium">Value *</th>
              <th className="p-2 font-medium">Label *</th>
              <th className="p-2 font-medium">Description</th>
              <th className="w-14 p-2 text-center font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subValues.length === 0 && (
              <tr>
                <td
                  colSpan={columnCount}
                  className="text-muted-foreground p-4 text-center"
                >
                  No list master items defined yet.
                </td>
              </tr>
            )}
            {subValues.map((value, index) => {
              const label = value.code || String(index + 1);
              const editable = !readOnly && !value.deleted;
              return (
                <tr
                  key={value.key}
                  className={cn(
                    "align-top",
                    value.id &&
                      value.dirty &&
                      "shadow-[inset_3px_0_var(--warning)]",
                    !value.id && "bg-info/10",
                    value.deleted && "text-muted-foreground",
                    value.error && "bg-destructive/10",
                  )}
                >
                  {!readOnly && (
                    <td className="p-2">
                      {value.deleted ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Undo delete ${label}`}
                          onClick={() =>
                            patchRow(value.key, {
                              deleted: false,
                              error: undefined,
                            })
                          }
                        >
                          <Undo2 className="size-4" />
                        </Button>
                      ) : (
                        <Checkbox
                          className="mt-2"
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
                    </td>
                  )}
                  <td className="text-muted-foreground p-2 text-right leading-8 tabular-nums">
                    {index + 1}
                  </td>
                  <td className="p-2 font-mono">
                    {editable ? (
                      <FieldInput
                        aria-label="Value"
                        value={value.code}
                        disabled={!!value.id}
                        maxLength={10}
                        className="font-mono"
                        onChange={(e) =>
                          edit(value.key, {
                            code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    ) : (
                      <span
                        className={cn(
                          "block py-1.5",
                          value.deleted && "line-through",
                        )}
                      >
                        {value.code}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {editable ? (
                      <FieldInput
                        aria-label="Label"
                        value={value.name}
                        maxLength={50}
                        onChange={(e) =>
                          edit(value.key, { name: e.target.value })
                        }
                      />
                    ) : (
                      <span
                        className={cn(
                          "block py-1.5",
                          value.deleted && "line-through",
                        )}
                      >
                        {value.name}
                      </span>
                    )}
                    {value.error && (
                      <p role="alert" className="text-destructive mt-1 text-xs">
                        {value.error}
                      </p>
                    )}
                  </td>
                  <td className="p-2">
                    {editable ? (
                      <FieldInput
                        aria-label="Description"
                        value={value.description ?? ""}
                        maxLength={500}
                        placeholder="Optional"
                        onChange={(e) =>
                          edit(value.key, { description: e.target.value })
                        }
                      />
                    ) : (
                      <span
                        className={cn(
                          "text-muted-foreground block py-1.5",
                          value.deleted && "line-through",
                        )}
                      >
                        {value.description || "—"}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <Checkbox
                      className="mt-2"
                      aria-label={`Active ${label}`}
                      checked={value.is_active}
                      disabled={!editable}
                      onCheckedChange={(checked) =>
                        edit(value.key, { is_active: checked === true })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(hasEdited || hasNew || hasDeleted || hasFailed) && (
        <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
          {hasEdited && (
            <span className="flex items-center gap-1">
              <span className="bg-warning inline-block h-3 w-1 rounded-sm" />
              Edited
            </span>
          )}
          {hasNew && (
            <span className="flex items-center gap-1">
              <span className="bg-info/10 border-info/40 inline-block size-3 rounded-sm border" />
              New
            </span>
          )}
          {hasDeleted && (
            <span className="flex items-center gap-1">
              <span className="line-through">abc</span>
              Will be deleted
            </span>
          )}
          {hasFailed && (
            <span className="flex items-center gap-1">
              <span className="bg-destructive/10 border-destructive/40 inline-block size-3 rounded-sm border" />
              Failed
            </span>
          )}
        </div>
      )}
    </section>
  );
}
