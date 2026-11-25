import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, KeyRound, LogOut, User } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMutating } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { useLogout } from "@/hooks/use-logout";
import { SWITCH_BU_MUTATION_KEY } from "@/hooks/use-switch-bu";
import ChangePasswordDialog from "@/components/share/change-password-dialog";
import { formatName } from "@/lib/name";
import { cn } from "@/lib/utils";
import { LangSwitch } from "./lang-switch";
import { ThemeSwitch } from "./theme-switch";
import { FontScaleSwitch } from "./font-scale-switch";

/** รูปประกอบล้วน — ชื่ออยู่ข้าง ๆ เสมอ (ข้อความ หรือ sr-only) จึง alt="" ไม่ให้อ่านชื่อซ้ำ/อ่านอักษรย่อ */
function UserAvatar({
  avatarUrl,
  fallbackText,
  size,
  interactive,
  eager,
}: {
  readonly avatarUrl: string | null | undefined;
  readonly fallbackText: string;
  readonly size: "sm" | "md";
  readonly interactive?: boolean;
  readonly eager?: boolean;
}) {
  const isLarge = size === "md";
  return (
    <Avatar
      key={avatarUrl ?? "fallback"}
      className={cn(
        "ring-primary/20 ring-2",
        isLarge ? "size-11" : "size-7",
        interactive &&
          "group-hover:ring-primary/40 group-data-[state=open]:ring-primary/50 transition-all",
      )}
    >
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt=""
          className="object-cover"
          loading={eager ? "eager" : undefined}
          fetchPriority={eager ? "high" : undefined}
        />
      )}
      <AvatarFallback
        aria-hidden="true"
        className={cn(
          "bg-primary text-primary-foreground font-semibold",
          isLarge ? "text-xs" : "text-micro-legal",
        )}
      >
        {fallbackText}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserProfile() {
  const t = useTranslations("navbar");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const {
    data: profile,
    isLoading,
    isError,
    defaultBu,
    aliasName,
    avatarUrl,
  } = useProfile();
  const logoutMutation = useLogout();
  const isSwitchingBu =
    useIsMutating({ mutationKey: [...SWITCH_BU_MUTATION_KEY] }) > 0;

  // โหลดโปรไฟล์ไม่ผ่าน (500/503 ฯลฯ) — เดิม return null ทั้งเมนู ผลคือปุ่มออกจาก
  // ระบบหายไปด้วย คนที่ session ค้างเลยติดอยู่หน้า error ตลอด ล้าง session ไม่ได้
  // เลยนอกจากไปลบ localStorage เอง · เมนูยังต้องอยู่ แต่ตัดส่วนที่ต้องใช้ข้อมูล
  // โปรไฟล์ออก เหลือค่าตั้งค่าเครื่องกับปุ่มออกจากระบบ
  if (isError) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger className="data-[state=open]:bg-muted/60 focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 outline-none focus-visible:ring-[3px]">
            <UserAvatar
              avatarUrl={undefined}
              fallbackText="?"
              size="sm"
              interactive
              eager
            />
            <ChevronDown
              className="size-3 shrink-0 opacity-50"
              aria-hidden="true"
            />
            <span className="sr-only">{t("profile")}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 p-2"
            align="end"
            sideOffset={6}
          >
            <LangSwitch />
            <ThemeSwitch />
            <FontScaleSwitch />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2 rounded-md px-2 py-2 text-xs"
              onSelect={(e) => {
                e.preventDefault();
                setLogoutOpen(true);
              }}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="text-destructive size-4" />
              {logoutMutation.isPending ? t("loggingOut") : t("logOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <LogoutConfirmDialog
          open={logoutOpen}
          onOpenChange={setLogoutOpen}
          onConfirm={() => logoutMutation.mutate()}
          isPending={logoutMutation.isPending}
        />
      </>
    );
  }

  if (isLoading || isSwitchingBu || !profile) {
    return (
      <div
        className="flex items-center gap-1.5 px-1.5 py-1"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="hidden items-center @2xl/navbar:grid"
          aria-hidden="true"
        >
          <Skeleton className="mb-1 h-3 w-24" />
          <Skeleton className="ml-auto h-2.5 w-16" />
        </div>
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <span className="sr-only">{t("profile")}</span>
      </div>
    );
  }

  // มาถึงตรงนี้ profile guaranteed not null (เพิ่ง guard ไป)
  const name = `${profile.user_info.firstname} ${profile.user_info.lastname}`;
  const department = defaultBu?.department?.name ?? "";
  const convertName = formatName(
    profile.user_info.firstname,
    profile.user_info.lastname,
  );
  const fallbackText = aliasName ?? convertName;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group data-[state=open]:bg-muted/60 data-[state=open]:border-border/60 focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-1 py-1 text-right transition-colors outline-none hover:border-none hover:bg-none focus-visible:ring-[3px] @2xl/navbar:px-1.5">
        <div className="hidden text-xs leading-tight @2xl/navbar:grid">
          <span className="w-content truncate font-semibold">{name}</span>
          <span
            className={`text-micro-legal w-full truncate text-right ${department ? "text-muted-foreground" : "text-warning-ink"}`}
          >
            {department || t("noDepartment")}
          </span>
        </div>
        <UserAvatar
          avatarUrl={avatarUrl}
          fallbackText={fallbackText}
          size="sm"
          interactive
          eager
        />
        <ChevronDown
          className="hidden size-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-80 group-data-[state=open]:opacity-100 @2xl/navbar:block"
          aria-hidden="true"
        />
        {/* แถบแคบซ่อนชื่อ — ปุ่มเหลือแต่รูป ซึ่งเป็นภาพประกอบ (alt="") จึงต้องมีชื่อให้ screen reader */}
        <span className="sr-only @2xl/navbar:hidden">
          {t("profile")}: {name}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-72 p-2" align="end" sideOffset={6}>
        <div className="flex items-start gap-3 px-2 py-2">
          <UserAvatar
            avatarUrl={avatarUrl}
            fallbackText={fallbackText}
            size="md"
          />
          <div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
            <span className="truncate text-sm font-semibold">{name}</span>
            <span className="text-muted-foreground text-micro truncate">
              {profile.email}
            </span>
            <span
              className={`text-micro truncate ${department ? "text-muted-foreground" : "text-warning-ink"}`}
            >
              {department || t("noDepartment")}
            </span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-micro-legal px-2 pt-1 pb-0.5 font-semibold tracking-wider uppercase">
          {t("sectionAccount")}
        </DropdownMenuLabel>
        <DropdownMenuItem
          asChild
          className="cursor-pointer gap-2 rounded-md px-2 py-2 text-xs"
        >
          <Link to="/profile">
            <User className="size-4" />
            {t("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 rounded-md px-2 py-2 text-xs"
          onClick={() => setPasswordOpen(true)}
        >
          <KeyRound className="size-4" />
          {t("changePassword")}
        </DropdownMenuItem>
        <DropdownMenuLabel className="text-muted-foreground text-micro-legal px-2 pt-2 pb-0.5 font-semibold tracking-wider uppercase">
          {t("sectionPreferences")}
        </DropdownMenuLabel>
        <LangSwitch />
        <ThemeSwitch />
        <FontScaleSwitch />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2 rounded-md px-2 py-2 text-xs"
          onSelect={(e) => {
            e.preventDefault();
            setLogoutOpen(true);
          }}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="text-destructive size-4" />
          {logoutMutation.isPending ? t("loggingOut") : t("logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />

      <LogoutConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={() => logoutMutation.mutate()}
        isPending={logoutMutation.isPending}
      />
    </DropdownMenu>
  );
}

function LogoutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
  readonly isPending: boolean;
}) {
  const t = useTranslations("navbar");
  const tCommon = useTranslations("common");
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => !isPending && onOpenChange(o)}
    >
      <AlertDialogContent className="sm:max-w-sm">
        <div className="flex items-start gap-3">
          <div className="bg-muted text-destructive flex size-9 shrink-0 items-center justify-center rounded-lg">
            <LogOut className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <AlertDialogTitle className="text-sm">
              {t("confirmLogoutTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1">
              {t("confirmLogoutDesc")}
            </AlertDialogDescription>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {tCommon("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            size="default"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
          >
            <LogOut />
            {isPending ? t("loggingOut") : t("logOut")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
