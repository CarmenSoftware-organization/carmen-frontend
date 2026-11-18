import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { Building2, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";
import { useSwitchBu } from "@/hooks/use-switch-bu";

function BuAvatar({
  avatarUrl,
  alt,
  isActive,
  eager,
}: {
  readonly avatarUrl: string | null | undefined;
  readonly alt: string;
  readonly isActive: boolean;
  readonly eager?: boolean;
}) {
  return (
    <Avatar
      className={cn(
        "size-7 shrink-0 ring-2",
        isActive
          ? "ring-primary/20"
          : "ring-muted-foreground/15 group-hover/item:ring-primary/30",
      )}
    >
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={alt}
          className="object-cover"
          loading={eager ? "eager" : undefined}
          fetchPriority={eager ? "high" : undefined}
        />
      )}
      <AvatarFallback
        className={cn(
          "relative",
          isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted/40 text-muted-foreground group-hover/item:bg-primary/5 group-hover/item:text-primary",
        )}
      >
        <Building2 className="size-3.5 shrink-0" />
      </AvatarFallback>
    </Avatar>
  );
}

export default function BuSwitcher() {
  const tt = useTranslations("toast");
  const tErr = useTranslations("errors");
  const navigate = useNavigate();
  const {
    data: profile,
    isLoading,
    isError,
    defaultBu,
    hasDefaultBu,
  } = useProfile();
  const switchBuMutation = useSwitchBu();
  const [isSwitching, setIsSwitching] = useState(false);

  const departments = profile?.business_unit ?? [];
  const currentDept = defaultBu;

  if (isError) {
    return null;
  }

  // โหลดจบแล้วแต่ไม่มี BU สักอัน (คนที่เพิ่งสมัคร ยังไม่มีใคร assign เข้าโรงแรม) —
  // ซ่อน switcher ไปเลยเหมือนเคส error ของเดิมยัดรวมกับ loading ทำให้ navbar
  // หมุน skeleton ค้างถาวรทั้งที่ไม่มีอะไรจะโหลดแล้ว ProfileGate เป็นคนอธิบาย
  // สถานะให้ผู้ใช้อยู่แล้ว
  if (!isLoading && !isSwitching && !currentDept) {
    return null;
  }

  if (isLoading || isSwitching || !currentDept) {
    return (
      <div
        className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-1.5 @2xl/navbar:gap-2 @2xl/navbar:px-2"
        aria-live="polite"
        aria-busy="true"
      >
        <Skeleton className="ring-primary/20 hidden size-7 shrink-0 rounded-full ring-2 @2xl/navbar:block" />
        <Skeleton className="hidden h-3 w-8 @xs/navbar:block @2xl/navbar:w-28" />
        <Skeleton className="size-3 shrink-0 rounded-sm" />
      </div>
    );
  }

  const alias = currentDept.alias_name?.trim() || "";
  const buLabel = alias ? `${alias} - ${currentDept.name}` : currentDept.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title={buLabel}
          aria-label={buLabel}
          className="group data-[state=open]:border-border/60 data-[state=open]:bg-muted/60 h-8 gap-1.5 rounded-lg border border-transparent px-1.5 text-xs font-semibold hover:border-none hover:bg-none @2xl/navbar:gap-2 @2xl/navbar:px-2"
        >
          {/* แถบแคบ: รหัส BU (alias) แทนโลโก้ — มือถือต้องรู้ว่าอยู่กิจการไหนโดยไม่ต้องกด
              ไม่มี alias ก็ใช้โลโก้แทน · แถบกว้าง (@2xl/navbar): โลโก้ + ชื่อเต็ม */}
          <span
            className={alias ? "hidden @2xl/navbar:inline-flex" : "inline-flex"}
          >
            <BuAvatar
              avatarUrl={currentDept.avatar_url}
              alt={currentDept.name}
              isActive
              eager
            />
          </span>
          {/* แถบแคบกว่า 320px (Galaxy Fold 280): ซ่อนรหัสด้วย ให้ชื่อหน้ามีที่พอ — ไม่งั้น
              เหลือ "Purchas…" · ปุ่มยังกดได้จาก ⇅ และชื่อเต็มอยู่ใน title */}
          {alias && (
            <span className="hidden max-w-16 truncate font-semibold @xs/navbar:inline @2xl/navbar:hidden">
              {alias}
            </span>
          )}
          <span className="hidden max-w-60 min-w-24 truncate text-left font-semibold @2xl/navbar:block">
            {buLabel}
          </span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="min-w-64 p-1.5"
      >
        <div className="px-2 py-1.5">
          <p className="text-muted-foreground text-micro-legal font-semibold tracking-wider uppercase">
            Business Unit
          </p>
        </div>
        {departments.map((bu) => {
          // `defaultBu` fallback เป็น BU ตัวแรกเมื่อไม่มีแถวไหน is_default=true
          // ถ้าเชื่อมันตรง ๆ ตรงนี้ BU ตัวนั้นจะถูกมองว่า active แล้วโดนปิดปุ่ม
          // ผู้ใช้จึงกดตั้ง default ไม่ได้เลย และทุกหน้าที่ยิง /api/business-units
          // ค้าง 404 ถาวร — ไม่มี default จริงก็ต้องไม่มีตัวไหน active
          const isActive = hasDefaultBu && bu.id === currentDept.id;
          return (
            <DropdownMenuItem
              key={bu.id}
              disabled={isActive}
              onClick={async () => {
                if (isActive) return;
                setIsSwitching(true);
                try {
                  // resolve หลัง profile ใหม่มาถึงแล้ว (ดู useSwitchBu)
                  await switchBuMutation.mutateAsync(bu.id);
                  toast.success(tt("buSwitched", { name: bu.name }));
                  // ข้อมูลของ BU เดิมถูกล้างไปแล้ว หน้าที่ยืนอยู่อาจอ้างถึง id ที่ไม่มีใน BU ใหม่
                  navigate("/dashboard");
                } catch {
                  // เดิมเป็นภาษาอังกฤษฝังในโค้ด ทั้งที่ปุ่มนี้อยู่บนแถบบนสุด
                  // ที่ทุกคนเห็นทุกวัน
                  toast.error(tErr("buSwitchFailed"));
                } finally {
                  setIsSwitching(false);
                }
              }}
              className="group/item relative gap-2 rounded-md p-2 data-disabled:opacity-100"
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-full"
                />
              )}
              <BuAvatar
                avatarUrl={bu.avatar_url}
                alt={bu.name}
                isActive={isActive}
              />
              <div className="grid min-w-0 flex-1 text-xs leading-tight">
                <span className="truncate font-semibold">
                  {bu.alias_name && `${bu.alias_name} -`} {bu.name}
                </span>
                <span className="text-muted-foreground text-micro truncate">
                  {bu.config?.hotel?.name}
                </span>
              </div>
              {isActive && (
                <span className="bg-primary ml-auto inline-flex size-1.5 shrink-0 rounded-full" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
