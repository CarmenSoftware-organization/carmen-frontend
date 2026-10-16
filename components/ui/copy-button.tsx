import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * เขียนข้อความลง clipboard — คืน false เมื่อ clipboard ถูกบล็อก (ไม่ throw)
 *
 * @param text - ข้อความที่จะคัดลอก
 * @returns true เมื่อคัดลอกสำเร็จ
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface CopyButtonProps {
  /** ข้อความที่จะคัดลอก */
  readonly value: string;
  /** aria-label ของปุ่ม */
  readonly label: string;
  /** ข้อความ toast เมื่อคัดลอกสำเร็จ */
  readonly successMessage: string;
  readonly className?: string;
  /** เนื้อหานำหน้าไอคอน (เช่นตัวข้อความที่ถูกคัดลอก) */
  readonly children?: React.ReactNode;
}

/**
 * ปุ่มคัดลอกข้อความ — ไอคอน Copy สลับเป็น Check 2 วินาทีหลังคัดลอก + toast
 *
 * ถอดมาจากปุ่มรหัสข้อผิดพลาดใน `ErrorState` เพื่อใช้ซ้ำ (เช่น API key ของ BU)
 *
 * @param props - value, label, successMessage, className, children
 * @returns ปุ่มคัดลอก
 */
export function CopyButton({
  value,
  label,
  successMessage,
  className,
  children,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    if (!(await copyToClipboard(value))) return;
    setCopied(true);
    toast.success(successMessage);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        "border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground text-micro inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors",
        className,
      )}
    >
      {children}
      {copied ? (
        <Check className="text-success-ink size-3" aria-hidden="true" />
      ) : (
        <Copy className="size-3" aria-hidden="true" />
      )}
    </button>
  );
}
