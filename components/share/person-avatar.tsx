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
  if (!first.trim() && !last.trim()) return "";
  return formatName(first, last);
}

export function PersonAvatar({
  name,
  firstname,
  lastname,
  avatarUrl,
  fallback = "initials",
  className,
  fallbackClassName,
}: PersonAvatarProps) {
  const initials =
    fallback === "initials" ? resolveInitials(name, firstname, lastname) : "";

  return (
    <Avatar key={avatarUrl ?? "fallback"} className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={cn(fallbackClassName)}>
        {initials || <User className="size-1/2" aria-hidden="true" />}
      </AvatarFallback>
    </Avatar>
  );
}
