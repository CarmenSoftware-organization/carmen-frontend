import { User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatName } from "@/lib/name";
import { cn } from "@/lib/utils";

interface PersonAvatarProps {
  /** ชื่อเต็ม ใช้ทำตัวย่อเมื่อไม่ได้ส่ง firstname/lastname */
  readonly name?: string | null;
  readonly firstname?: string | null;
  readonly lastname?: string | null;
  readonly avatarUrl?: string | null;
  readonly fallback?: "initials" | "icon";
  /** ขนาด/รูปทรงจาก call site เดิม */
  readonly className?: string;
  /** พื้น/สีตัวอักษรของ fallback จาก call site เดิม */
  readonly fallbackClassName?: string;
  /**
   * คลาสของไอคอน fallback (ค่าเริ่มต้น size-1/2 ของวง)
   * ไอคอนเปล่า ๆ ไม่มีวง (เช่น header เอกสาร/status bar):
   * className="size-3" fallbackClassName="bg-transparent text-inherit" iconClassName="size-full"
   */
  readonly iconClassName?: string;
}

function resolveInitials(
  name?: string | null,
  firstname?: string | null,
  lastname?: string | null,
): string {
  let first = firstname ?? "";
  let last = lastname ?? "";
  if (!first && !last && name) {
    const [head = "", ...rest] = name.trim().split(/\s+/);
    first = head;
    last = rest.length > 0 ? rest[rest.length - 1] : "";
  }
  if (!first.trim()) return "";
  const result = formatName(first, last);
  // formatName คืน "U" เป็น placeholder เมื่อชื่อว่างหลังตัดสระไทย
  if (result === "U" && !/^u/i.test(first.trim())) return "";
  return result;
}

export function PersonAvatar({
  name,
  firstname,
  lastname,
  avatarUrl,
  fallback = "initials",
  className,
  fallbackClassName,
  iconClassName,
}: PersonAvatarProps) {
  const initials =
    fallback === "initials" ? resolveInitials(name, firstname, lastname) : "";

  return (
    <Avatar key={avatarUrl ?? "fallback"} className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={fallbackClassName}>
        {initials || <User className={cn("size-1/2", iconClassName)} aria-hidden="true" />}
      </AvatarFallback>
    </Avatar>
  );
}
