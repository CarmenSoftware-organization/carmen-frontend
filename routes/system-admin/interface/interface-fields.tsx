import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
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
import { SECTION_PAIR } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import { cn } from "@/lib/utils";
import { useInterfaceReadMode } from "./interface-read-mode";

/**
 * ช่องของฟอร์ม interface — ทุกตัวเป็นช่องหนึ่งของ `FieldGrid` (ป้ายบน ค่า/คอนโทรลล่าง) และรู้โหมด
 * อ่านเองผ่าน `useInterfaceReadMode()`: โหมดอ่านแสดงค่าเป็นข้อความ (ป้ายเงียบ ค่าเด่น ไม่มีกรอบ)
 * กรอบมีเฉพาะตอนแก้ได้จริง (skill `carmen-blue-ui-design`)
 */

/** ค่าที่แสดงแทน secret ในโหมดอ่าน — ไม่บอกความยาวจริงของค่า */
const SECRET_PLACEHOLDER = "••••••••";

/**
 * คู่หมวดแรกของหน้า: บนจอกว้าง (1700px ขึ้นไป) สองหมวดวางเคียงกัน ต่ำกว่านั้นเรียงลง
 * `-mt-5` หักระยะบนของหมวดแรกทิ้ง — ใส่ `first` ให้หมวดซ้ายไม่ได้ เพราะตอนวางเคียงกัน
 * หมวดขวายังมี `mt-5` อยู่ หัวข้อสองฝั่งจะเหลื่อมกัน 20px
 */
export const FIRST_SECTION_PAIR = cn(SECTION_PAIR, "-mt-5");

export function TextField({
  label,
  field,
  viewValue,
  error,
  placeholder,
  type,
  hint,
  revealLabels,
}: {
  readonly label: string;
  readonly field: UseFormRegisterReturn;
  /**
   * ค่าปัจจุบันของช่อง (`form.watch(...)`) ที่โหมดอ่านแสดงเป็นข้อความ — ต้องส่งเข้ามาเอง
   * เพราะ `field` (ผลของ `register`) ไม่มีค่าอยู่ในตัว
   */
  readonly viewValue: string | number;
  readonly error?: string;
  readonly placeholder?: string;
  readonly type?: "text" | "password";
  /** คำแนะนำตอนกรอก — แสดงเฉพาะโหมดแก้ */
  readonly hint?: string;
  readonly revealLabels?: { readonly show: string; readonly hide: string };
}) {
  const id = useId();
  const readMode = useInterfaceReadMode();
  const [revealed, setRevealed] = useState(false);
  const isSecret = type === "password";
  if (readMode) {
    return (
      <SettingField
        label={label}
        // secret: backend ส่ง mask กลับมาอยู่แล้ว แสดงแค่ว่า "ตั้งไว้แล้ว" ก็พอ
        value={isSecret && viewValue ? SECRET_PLACEHOLDER : viewValue}
      />
    );
  }
  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          {...field}
          id={id}
          type={isSecret && !revealed ? "password" : "text"}
          placeholder={placeholder}
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
  const readMode = useInterfaceReadMode();
  if (readMode) {
    return <SettingField label={label} value={optionLabel(value)} />;
  }
  return (
    <Field className="min-w-0">
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

/**
 * สวิตช์เปิด/ปิด — ป้ายบน สวิตช์ล่าง (สูงเท่าช่องกรอกแถวเดียวกันจึงเสมอกัน) ไม่ใช่แถวเต็ม
 * ความกว้าง · โหมดอ่านแสดง Yes/No เป็นข้อความ
 */
export function ToggleField({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
}) {
  const id = useId();
  const tc = useTranslations("common");
  const readMode = useInterfaceReadMode();
  if (readMode) {
    return (
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs">{label}</div>
        {/* ค่าปิดจางลง ค่าเปิดมีจุดนำ — กวาดตาแล้วเห็นว่าอะไรเปิดอยู่โดยไม่ต้องอ่านทุกช่อง
            (แบบเดียวกับ ConfigField ของหน้า Default Setting) */}
        <div
          className={cn(
            "mt-0.5 flex items-center gap-2 text-sm",
            checked ? "text-foreground font-medium" : "text-muted-foreground",
          )}
        >
          {checked && (
            <span
              aria-hidden
              className="bg-primary size-1.5 shrink-0 rounded-full"
            />
          )}
          {checked ? tc("yes") : tc("no")}
        </div>
      </div>
    );
  }
  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex h-8 items-center">
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
    </Field>
  );
}
