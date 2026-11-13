import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useForm, type Resolver } from "react-hook-form";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, KeyRound, Loader2, Mail, Trash2, IdCard } from "lucide-react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  useDeleteUserAvatar,
  useProfile,
  useUpdateProfile,
  useUploadUserAvatar,
  useUploadUserSignature,
  useDeleteUserSignature,
} from "@/hooks/use-profile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  CompactSection,
  CompactSectionSkeleton,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import {
  getDefaultValues,
  createProfileSchema,
  type ProfileFormValues,
} from "./profile-form-schema";
import ChangePasswordDialog from "@/components/share/change-password-dialog";
import { AvatarCropDialog } from "./avatar-crop-dialog";
import { SignatureDialog } from "./signature-dialog";
import { McpTokensSection } from "./mcp-tokens-section";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import {
  IMAGE_MAX_BYTES,
  IMAGE_ACCEPT_ATTR,
  IMAGE_MIME_TYPES,
} from "@/lib/image-upload";
import { BackButton } from "@/components/share/back-button";

/** ช่องชื่อ/โทรศัพท์ของฟอร์ม: กว้างขั้นต่ำ 176px โตได้ถึง 320px แล้วหยุด (จอกว้างไม่ทำให้ช่องยืด) */
const NAME_FIELD = "w-auto max-w-xs min-w-44 flex-1 basis-44";

export default function UserProfileSetting() {
  const navigate = useNavigate();
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const tv = useTranslations("validation");
  const { data: profile, isLoading, isError } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadUserAvatar();
  const deleteAvatar = useDeleteUserAvatar();
  const isUploadingAvatar = uploadAvatar.isPending;
  const isDeletingAvatar = deleteAvatar.isPending;
  const uploadSignature = useUploadUserSignature();
  const deleteSignature = useDeleteUserSignature();
  const isUploadingSignature = uploadSignature.isPending;
  const isDeletingSignature = deleteSignature.isPending;
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [removeSignatureOpen, setRemoveSignatureOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [removeAvatarOpen, setRemoveAvatarOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  // Source image queued for the crop dialog. Separate from `avatarPreview`
  // (which only reflects the final image, post-crop).
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFilename, setCropFilename] = useState<string>("avatar.png");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Client-side guards — backend still validates authoritatively
    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      toast.warning(t("logoTypeError"));
      event.target.value = "";
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast.warning(t("logoSizeError"));
      event.target.value = "";
      return;
    }

    // Open the crop dialog with the picked file as source. The dialog will
    // call `handleConfirmCrop` with the final (cropped) File when the user
    // confirms — only then do we hit the upload API.
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      setCropSrc(dataUrl);
      setCropFilename(file.name || "avatar.png");
    };
    reader.readAsDataURL(file);
  };

  const handleCancelCrop = () => {
    setCropSrc(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleConfirmCrop = (cropped: File) => {
    // Show the cropped preview while the upload is in flight
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(cropped);

    uploadAvatar.mutate(cropped, {
      onSuccess: () => {
        toast.success(t("avatarUploaded"));
        setAvatarPreview(null);
        setCropSrc(null);
        if (avatarInputRef.current) avatarInputRef.current.value = "";
      },
      onError: () => {
        setAvatarPreview(null);
        setCropSrc(null);
        if (avatarInputRef.current) avatarInputRef.current.value = "";
      },
    });
  };

  const handleRemoveAvatar = () => {
    if (avatarPreview) {
      setAvatarPreview(null);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    if (!profile?.avatar_url) return;
    setRemoveAvatarOpen(true);
  };

  const handleConfirmRemoveAvatar = () => {
    deleteAvatar.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("avatarRemoved"));
        if (avatarInputRef.current) avatarInputRef.current.value = "";
        setRemoveAvatarOpen(false);
      },
      // ไม่ปิด dialog ตอนพลาด ให้ลองใหม่ได้ (toast ขึ้นจาก MutationCache กลาง)
    });
  };

  const handleConfirmSignature = (file: File) => {
    uploadSignature.mutate(file, {
      onSuccess: () => {
        toast.success(t("signatureUpdated"));
        setSignatureDialogOpen(false);
      },
    });
  };

  const handleConfirmRemoveSignature = () => {
    deleteSignature.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("signatureRemoved"));
        setRemoveSignatureOpen(false);
      },
    });
  };

  const profileSchema = createProfileSchema(tv, tfl);
  const defaultValues = getDefaultValues(profile);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormValues>,
    defaultValues,
    values: defaultValues,
    // profile refetch เบื้องหลัง (หลัง Save, อัปโหลดรูป, ลายเซ็น) ต้องไม่ทับช่องที่ผู้ใช้กำลังแก้อยู่
    resetOptions: { keepDirtyValues: true },
  });

  const discard = useDiscardConfirm({
    isDirty: form.formState.isDirty,
    isPending: updateProfile.isPending,
  });
  // useDiscardConfirm ดักได้แค่ปุ่มย้อนกลับในหน้านี้ — เมนู sidebar ต้องใช้ตัวนี้
  const navGuard = useNavigationGuard(form.formState.isDirty);

  const handleBack = () => discard.confirm(() => navigate("/profile"));

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate(values, {
      onSuccess: () => {
        toast.success(t("profileUpdated"));
        form.reset(values);
      },
    });
  };

  if (isLoading) return <ProfileSettingSkeleton />;

  if (isError || !profile)
    return <p className="text-destructive p-4 text-xs">{t("failedToLoad")}</p>;

  const initials = [profile.user_info?.firstname, profile.user_info?.lastname]
    .filter(Boolean)
    .map((n) => n!.charAt(0).toUpperCase())
    .join("");
  const fullName = [
    profile.user_info?.firstname,
    profile.user_info?.middlename,
    profile.user_info?.lastname,
  ]
    .filter(Boolean)
    .join(" ");
  const hasAvatar = Boolean(avatarPreview || profile.avatar_url);
  const hasSignature = Boolean(profile.signature_url);

  return (
    // ไม่มี slide-in: หน้าตั้งค่าเปิดซ้ำบ่อย แอนิเมชัน 500ms ทำให้รู้สึกช้า
    // เต็มความกว้างจอ (skill carmen-blue-ui-design) — ไม่มี max-w และไม่มีคอลัมน์หัวข้อด้านซ้าย
    <div className="animate-in fade-in w-full pb-[max(2rem,env(safe-area-inset-bottom))] duration-150">
      {/* Header — ไม่มีปุ่ม Save ที่นี่ เพราะ Save บันทึกแค่ข้อมูลส่วนตัว
          ส่วนรูป ลายเซ็น และโทเค็นบันทึกทันที ปุ่มจึงอยู่ท้ายฟอร์มนั้นแทน */}
      {/* พื้นหลังทึบจำเป็นเพราะ sticky บนมือถือ — ไม่มีแล้วหัวข้อ section เลื่อนทะลุมาทับชื่อหน้า */}
      <div className="bg-background/95 sticky top-0 z-20 mb-3 flex items-center gap-2 py-1 backdrop-blur-sm sm:static sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
        {/* touch target 44px บนมือถือ — header นี้ sticky อยู่บนสุดของหน้าโปรไฟล์
            ซึ่งเป็นหน้าที่เปิดจากมือถือบ่อย จงใจใหญ่กว่า icon-sm ปกติ */}
        <BackButton onClick={handleBack} className="h-11 w-11 sm:h-8 sm:w-8" />
        <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
      </div>

      {/* Account Info */}
      <CompactSection
        first
        title={t("accountInfo")}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPasswordOpen(true)}
          >
            <KeyRound className="size-3.5" aria-hidden="true" />
            {t("changePassword")}
          </Button>
        }
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="group/avatar relative">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              aria-label={t("uploadAvatar")}
              aria-busy={isUploadingAvatar}
              className="group ring-primary/30 ring-offset-background hover:ring-primary/60 focus-visible:ring-primary relative block size-14 cursor-pointer rounded-full ring-2 ring-offset-2 transition-all focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
            >
              <Avatar
                key={avatarPreview ?? profile.avatar_url ?? "fallback"}
                className="size-14"
              >
                {(avatarPreview ?? profile.avatar_url) && (
                  <AvatarImage
                    src={avatarPreview ?? profile.avatar_url ?? undefined}
                    alt={initials || "?"}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {profile.alias_name || initials || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="bg-foreground/55 pointer-events-none absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100">
                {isUploadingAvatar ? (
                  <Loader2
                    className="text-background size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Camera
                    className="text-background size-4"
                    aria-hidden="true"
                  />
                )}
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept={IMAGE_ACCEPT_ATTR}
              disabled={isUploadingAvatar}
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-semibold tracking-tight break-words">
                {fullName || profile.email || "-"}
              </span>
              {/* platform_role ว่างได้ (ผู้ใช้ระดับ BU) — badge เปล่าดูเหมือนบั๊ก */}
              {profile.platform_role && (
                <Badge variant="primary-light" size="sm">
                  {profile.platform_role}
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="break-all">{profile.email || "-"}</span>
            </div>
            {/* ปุ่มรูปแบบข้อความแทน hover-overlay + ถังขยะแดงติดมุมรูป:
                hover ไม่มีบนมือถือ และปุ่มลบ 20px ที่ขอบรูปกดพลาดง่าย */}
            <div className="-ml-2 flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={isUploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera className="size-3" aria-hidden="true" />
                {hasAvatar ? t("changeAvatar") : t("uploadAvatar")}
              </Button>
              {hasAvatar && !isUploadingAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isDeletingAvatar}
                  onClick={handleRemoveAvatar}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {isDeletingAvatar ? (
                    <Loader2
                      className="size-3 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 className="size-3" aria-hidden="true" />
                  )}
                  {t("removeAvatar")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CompactSection>

      {/* ข้อมูลส่วนตัว | ลายเซ็น — สองหมวดสูงใกล้กัน วางเคียงกันบนจอกว้าง */}
      <div className={SECTION_PAIR}>
        <CompactSection title={t("personalInfo")}>
          <form
            id="profile-form"
            onSubmit={form.handleSubmit(onSubmit, () =>
              scrollToFirstInvalidField(),
            )}
          >
            {/* แถวเดียวแบบ flex-wrap แทน FieldGrid: ฟอร์มมี 5 ช่อง + ปุ่ม Save ในกริดคอลัมน์ตายตัว
                Alias ตกไปอยู่แถวของตัวเองและ Save กินอีกแถว การ์ดสูงเป็นสองเท่าของเนื้อหา
                ช่องชื่อกว้าง 176–320px (ไม่ยืดตามจอ) · Alias 2 ตัวอักษรกว้างคงที่ · Save ต่อท้ายแถวเดียวกัน */}
            <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
              <Field
                data-invalid={!!form.formState.errors.firstname}
                className={NAME_FIELD}
              >
                <FieldLabel htmlFor="firstname" required>
                  {t("firstName")}
                </FieldLabel>
                <Input
                  id="firstname"
                  placeholder={t("enterFirstName")}
                  className="h-9 transition-colors"
                  maxLength={100}
                  disabled={updateProfile.isPending}
                  aria-invalid={!!form.formState.errors.firstname}
                  {...form.register("firstname")}
                />
                <FieldError>
                  {form.formState.errors.firstname?.message}
                </FieldError>
              </Field>

              <Field
                data-invalid={!!form.formState.errors.middlename}
                className={NAME_FIELD}
              >
                <FieldLabel htmlFor="middlename">{t("middleName")}</FieldLabel>
                <Input
                  id="middlename"
                  placeholder={t("enterMiddleName")}
                  className="h-9 transition-colors"
                  maxLength={100}
                  disabled={updateProfile.isPending}
                  aria-invalid={!!form.formState.errors.middlename}
                  {...form.register("middlename")}
                />
                <FieldError>
                  {form.formState.errors.middlename?.message}
                </FieldError>
              </Field>

              <Field
                data-invalid={!!form.formState.errors.lastname}
                className={NAME_FIELD}
              >
                <FieldLabel htmlFor="lastname" required>
                  {t("lastName")}
                </FieldLabel>
                <Input
                  id="lastname"
                  placeholder={t("enterLastName")}
                  className="h-9 transition-colors"
                  maxLength={100}
                  disabled={updateProfile.isPending}
                  aria-invalid={!!form.formState.errors.lastname}
                  {...form.register("lastname")}
                />
                <FieldError>
                  {form.formState.errors.lastname?.message}
                </FieldError>
              </Field>

              <Field
                data-invalid={!!form.formState.errors.telephone}
                className={NAME_FIELD}
              >
                <FieldLabel htmlFor="telephone">{t("telephone")}</FieldLabel>
                <Input
                  id="telephone"
                  placeholder={t("enterTelephone")}
                  className="h-9 transition-colors"
                  maxLength={20}
                  disabled={updateProfile.isPending}
                  aria-invalid={!!form.formState.errors.telephone}
                  {...form.register("telephone")}
                />
                <FieldError>
                  {form.formState.errors.telephone?.message}
                </FieldError>
              </Field>

              <Field
                data-invalid={!!form.formState.errors.alias_name}
                className="w-20 flex-none"
              >
                <FieldLabel htmlFor="alias_name">{t("alias")}</FieldLabel>
                <Input
                  id="alias_name"
                  placeholder={t("aliasPlaceholder")}
                  className="h-9 uppercase transition-colors"
                  maxLength={2}
                  hideCounter
                  disabled={updateProfile.isPending}
                  aria-invalid={!!form.formState.errors.alias_name}
                  {...form.register("alias_name")}
                />
                <FieldError>
                  {form.formState.errors.alias_name?.message}
                </FieldError>
              </Field>
              {/* mt-5.5 = ความสูงป้าย + gap ของ Field — ปุ่มอยู่ระดับเดียวกับช่องกรอก ไม่ใช่กับป้าย
                  ml-auto: ชิดขวาของแถวสุดท้าย */}
              <Button
                type="submit"
                size="sm"
                className="mt-5.5 ml-auto h-9"
                disabled={!form.formState.isDirty || updateProfile.isPending}
              >
                {updateProfile.isPending && (
                  <Loader2
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {updateProfile.isPending ? t("saving") : tc("save")}
              </Button>
            </div>
          </form>
        </CompactSection>

        <CompactSection
          title={t("signature")}
          description={
            <Badge
              variant={hasSignature ? "success-light" : "warning-light"}
              size="xs"
            >
              {hasSignature ? t("signatureSet") : t("signatureNotSet")}
            </Badge>
          }
          action={
            <div className="flex flex-wrap gap-2">
              {profile.signature_url && !isUploadingSignature && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isDeletingSignature}
                  onClick={() => setRemoveSignatureOpen(true)}
                >
                  {isDeletingSignature ? (
                    <Loader2
                      className="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  )}
                  {t("removeSignature")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploadingSignature}
                onClick={() => setSignatureDialogOpen(true)}
              >
                {profile.signature_url ? t("editSignature") : t("addSignature")}
              </Button>
            </div>
          }
        >
          {profile.signature_url ? (
            // หมึกลายเซ็นเป็นสีเข้มบนพื้นโปร่ง — วางบนพื้นขาวเสมอ ไม่งั้นมองไม่เห็นใน dark mode
            <div className="inline-flex max-w-full rounded-md border bg-white p-2">
              <img
                key={profile.signature_url}
                src={profile.signature_url}
                alt={t("signature")}
                className="max-h-28 max-w-full object-contain"
              />
            </div>
          ) : (
            // พื้นที่ว่างทั้งก้อนเป็นปุ่ม — ข้อความเดิมบอกให้ "คลิก" แต่คลิกแล้วไม่มีอะไรเกิดขึ้น
            <button
              type="button"
              disabled={isUploadingSignature}
              onClick={() => setSignatureDialogOpen(true)}
              className="border-border hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-ring/50 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-5 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
            >
              <span className="bg-muted/40 flex size-10 items-center justify-center rounded-full border">
                <IdCard
                  className="text-muted-foreground size-5"
                  aria-hidden="true"
                />
              </span>
              <span className="text-muted-foreground text-sm font-medium">
                {t("signatureEmptyHint")}
              </span>
            </button>
          )}
        </CompactSection>
      </div>

      <McpTokensSection />

      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />

      <SignatureDialog
        open={signatureDialogOpen}
        isSubmitting={isUploadingSignature}
        onOpenChange={setSignatureDialogOpen}
        onConfirm={handleConfirmSignature}
      />

      <AvatarCropDialog
        src={cropSrc}
        filename={cropFilename}
        isSubmitting={isUploadingAvatar}
        onClose={handleCancelCrop}
        onConfirm={handleConfirmCrop}
      />

      <AlertDialog
        open={removeAvatarOpen}
        onOpenChange={(o) =>
          !o && !isDeletingAvatar && setRemoveAvatarOpen(false)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeAvatarConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeAvatarConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAvatar}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingAvatar}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmRemoveAvatar();
              }}
            >
              {isDeletingAvatar ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-3" aria-hidden="true" />
              )}
              {isDeletingAvatar ? t("removingAvatar") : t("removeAvatar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={removeSignatureOpen}
        onOpenChange={(o) =>
          !o && !isDeletingSignature && setRemoveSignatureOpen(false)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("removeSignatureConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeSignatureConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSignature}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingSignature}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmRemoveSignature();
              }}
            >
              {isDeletingSignature ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-3" aria-hidden="true" />
              )}
              {isDeletingSignature
                ? t("removingSignature")
                : t("removeSignature")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DiscardDialog {...discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(open) => {
          if (!open) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />
    </div>
  );
}

/** โครงเดียวกับหน้าจริง: หัวหน้า · บัญชี · ข้อมูลส่วนตัว | ลายเซ็น · โทเค็น */
const ProfileSettingSkeleton = () => {
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-6 w-40" />
      </div>
      <CompactSectionSkeleton first className="h-24" />
      <div className={SECTION_PAIR}>
        <CompactSectionSkeleton className="h-44" />
        <CompactSectionSkeleton className="h-44" />
      </div>
      <CompactSectionSkeleton className="h-40" />
    </div>
  );
};
