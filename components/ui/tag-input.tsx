import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const READ_MODE_EMPTY = "—";

interface TagInputProps {
  readonly id?: string;
  readonly value: string[];
  readonly onChange: (value: string[]) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  /** ความยาวสูงสุดต่อหนึ่งรายการ */
  readonly maxLength?: number;
  /** aria-label ของปุ่มลบ — รับชื่อรายการ เช่น `(tag) => t("remove", { tag })` */
  readonly removeLabel?: (tag: string) => string;
  readonly className?: string;
}

/** แยกข้อความที่วาง/พิมพ์เป็นรายการ — คั่นด้วยขึ้นบรรทัดใหม่หรือจุลภาค */
function splitTags(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ต่อรายการใหม่ท้ายของเดิม ตัดตัวซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) */
function appendTags(current: string[], incoming: string[]): string[] {
  const seen = new Set(current.map((s) => s.toLowerCase()));
  const next = [...current];
  for (const tag of incoming) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(tag);
  }
  return next;
}

/**
 * ช่องกรอกรายการสั้น ๆ เป็นชิป — Enter หรือ `,` เพิ่ม · Backspace ในช่องว่างลบตัวท้าย
 * · วางข้อความหลายบรรทัดแตกเป็นหลายรายการ · ข้อความที่พิมพ์ค้างไว้ถูกเพิ่มเมื่อ blur
 *
 * โหมด disabled แสดงชิปอย่างเดียว (ไม่มีกรอบ input) และ "—" เมื่อว่าง เพื่อให้หน้า
 * อ่านอย่างเดียวไม่ดูเป็นฟอร์มที่ถูกล็อก
 */
export function TagInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  maxLength = 100,
  removeLabel = (tag) => `Remove ${tag}`,
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const tags = splitTags(raw).map((s) => s.slice(0, maxLength));
    if (tags.length > 0) onChange(appendTags(value, tags));
    setDraft("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME (ภาษาไทย/ญี่ปุ่น) ยังประกอบคำอยู่ — Enter ตอนนั้นคือยืนยันตัวอักษร ไม่ใช่เพิ่มชิป
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[\n,]/.test(text)) return;
    e.preventDefault();
    commit(draft + text);
  };

  if (disabled) {
    if (value.length === 0) {
      return (
        <span className="text-muted-foreground text-xs">{READ_MODE_EMPTY}</span>
      );
    }
    return (
      <ul className={cn("flex flex-wrap gap-1.5", className)}>
        {value.map((tag, index) => (
          // ข้อมูลเก่าจาก API อาจมีตัวซ้ำ — key ผูก index ด้วย
          <li key={`${index}:${tag}`}>
            <Badge variant="secondary" size="default" className="font-medium">
              {tag}
            </Badge>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      className={cn(
        "border-input bg-field focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border px-1.5 py-1 transition-[color,box-shadow] focus-within:ring-2",
        className,
      )}
    >
      {value.map((tag, index) => (
        <Badge
          key={`${index}:${tag}`}
          variant="secondary"
          size="default"
          className="gap-0.5 pr-0.5 font-medium"
        >
          {tag}
          <button
            type="button"
            className="hover:bg-foreground/10 focus-visible:ring-ring inline-flex size-4 items-center justify-center rounded-sm outline-none focus-visible:ring-2"
            aria-label={removeLabel(tag)}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <X aria-hidden="true" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => commit(draft)}
        maxLength={maxLength}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent px-1.5 text-xs outline-none"
      />
    </div>
  );
}
