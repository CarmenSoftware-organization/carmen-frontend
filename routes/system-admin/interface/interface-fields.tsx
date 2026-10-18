import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { READ_MODE_EMPTY, useInterfaceReadMode } from "./interface-read-mode";

export function TextField({
  label,
  field,
  error,
  placeholder,
  type,
  hint,
  className,
  revealLabels,
}: {
  readonly label: string;
  readonly field: UseFormRegisterReturn;
  readonly error?: string;
  readonly placeholder?: string;
  readonly type?: "text" | "password";
  readonly hint?: string;
  readonly className?: string;
  readonly revealLabels?: { readonly show: string; readonly hide: string };
}) {
  const id = useId();
  const readMode = useInterfaceReadMode();
  const [revealed, setRevealed] = useState(false);
  const isSecret = type === "password";
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          {...field}
          id={id}
          type={isSecret && !revealed ? "password" : "text"}
          placeholder={readMode ? READ_MODE_EMPTY : placeholder}
          className={isSecret ? "pr-8" : undefined}
        />
        {isSecret && (
          <button
            type="button"
            // ไม่ใช่ปุ่มของฟอร์ม — กัน Enter/tab ไปโดนแทนปุ่ม Save
            tabIndex={-1}
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? revealLabels?.hide : revealLabels?.show}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-8 items-center justify-center"
          >
            {revealed ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        )}
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

/**
 * ช่องเลือกค่าจากชุดที่กำหนดไว้ (enum ของ zod schema)
 *
 * รับ label กับ value ไม่ได้รับ schema — แต่ละ form ยังประกาศ field ของตัวเองอยู่
 * ตัวนี้แค่ห่อรูปแบบ Select ที่ทั้งสาม form เขียนเหมือนกัน
 *
 * @param props.optionLabel - แปลง option เป็นข้อความที่แสดง (ปกติเป็น `t()`)
 * @returns React element ของ enum field
 */
export function EnumField<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly optionLabel: (option: T) => string;
  readonly onChange: (next: T) => void;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        // กรองค่าที่ไม่อยู่ใน `options` ทิ้ง — Radix ยิง onValueChange("") ใส่เอง เมื่อ
        // `value` ถูกเปลี่ยนหลัง mount (เช่น form.reset ด้วยค่าที่โหลดมาจาก API) ผ่าน
        // hidden native <select> ที่มันซ่อนไว้ให้ form ค่าว่างนั้นจะทับค่าจริงใน form state
        // แล้ว field ค้างเป็น "" จน schema ไม่ผ่านและกด Save ไม่ติดโดยไม่มี error ให้เห็น
        // ค่าว่างไม่ใช่ตัวเลือกที่ถูกต้องของ field ประเภทนี้อยู่แล้ว จึงกันตั้งแต่ตรงนี้
        onValueChange={(v) => {
          if (options.includes(v as T)) onChange(v as T);
        }}
      >
        <SelectTrigger id={id} size="sm" className="w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-sm">
              {optionLabel(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 pt-1 sm:col-span-2">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
