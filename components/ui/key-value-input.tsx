import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createKeyValueRow, type KeyValueRow } from "@/lib/form-helpers";

interface KeyValueInputProps {
  readonly value: KeyValueRow[];
  readonly onChange: (value: KeyValueRow[]) => void;
  readonly disabled?: boolean;
  readonly keyPlaceholder?: string;
  readonly valuePlaceholder?: string;
  readonly addLabel?: string;
  readonly removeLabel?: string;
}

export function KeyValueInput({
  value,
  onChange,
  disabled,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  addLabel = "Add",
  removeLabel = "Remove row",
}: KeyValueInputProps) {
  const handleAdd = () => {
    onChange([...value, createKeyValueRow()]);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleChange = (
    index: number,
    field: "key" | "value",
    newVal: string,
  ) => {
    const updated = value.map((row, i) =>
      i === index ? { ...row, [field]: newVal } : row,
    );
    onChange(updated);
  };

  if (disabled && value.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  // โหมดอ่าน — ตารางคู่ค่า ไม่ใช่ช่องกรอกที่ถูกล็อก
  if (disabled) {
    return (
      <dl className="divide-border border-border divide-y rounded-md border text-xs">
        {value.map((row) => (
          <div
            key={row._id}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-1.5"
          >
            <dt className="text-muted-foreground truncate">{row.key}</dt>
            <dd className="text-foreground break-words">{row.value || "—"}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="text-muted-foreground flex-1 text-xs">
            {keyPlaceholder}
          </span>
          <span className="text-muted-foreground flex-1 text-xs">
            {valuePlaceholder}
          </span>
          {!disabled && <span className="w-6" />}
        </div>
      )}

      {value.map((row, index) => (
        <div key={row._id} className="flex items-center gap-1.5">
          <Input
            placeholder={keyPlaceholder}
            className="h-7 text-xs"
            value={row.key}
            onChange={(e) => handleChange(index, "key", e.target.value)}
            disabled={disabled}
            maxLength={50}
            aria-label={`${keyPlaceholder} ${index + 1}`}
          />
          <Input
            placeholder={valuePlaceholder}
            className="h-7 text-xs"
            value={row.value}
            onChange={(e) => handleChange(index, "value", e.target.value)}
            disabled={disabled}
            maxLength={100}
            aria-label={`${valuePlaceholder} ${index + 1}`}
          />
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={removeLabel}
              onClick={() => handleRemove(index)}
            >
              <X />
            </Button>
          )}
        </div>
      ))}

      {!disabled && (
        <Button type="button" variant="outline" size="xs" onClick={handleAdd}>
          <Plus aria-hidden="true" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
