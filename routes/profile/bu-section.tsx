import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import {
  useDeleteBuAvatar,
  useDeleteBuLogo,
  useUploadBuAvatar,
  useUploadBuLogo,
} from "@/hooks/use-profile";
import {
  IMAGE_MAX_BYTES,
  IMAGE_ACCEPT_ATTR,
  IMAGE_MIME_TYPES,
} from "@/lib/image-upload";
import { cn } from "@/lib/utils";
import type { BusinessUnit } from "@/types/profile";

type ImageUploadText = {
  readonly title: string;
  readonly hint: string;
  readonly upload: string;
  readonly change: string;
  readonly remove: string;
  readonly uploading: string;
  readonly removing: string;
  readonly uploaded: string;
  readonly removed: string;
  readonly typeError: string;
  readonly sizeError: string;
  readonly confirmTitle: string;
  readonly confirmDesc: string;
  readonly cancel: string;
};

function ImageUploadField({
  imageUrl,
  entityId,
  useUpload,
  useDelete,
  shape,
  text,
  priority,
}: {
  readonly imageUrl: string | null | undefined;
  readonly entityId: string;
  readonly useUpload: typeof useUploadBuLogo;
  readonly useDelete: typeof useDeleteBuLogo;
  readonly shape: "landscape" | "round";
  readonly text: ImageUploadText;
  readonly priority?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUpload();
  const remove = useDelete();
  const isUploading = upload.isPending;
  const isDeleting = remove.isPending;
  const isBusy = isUploading || isDeleting;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const displayUrl = preview ?? imageUrl;
  const hasImage = !!(preview || imageUrl);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      toast.warning(text.typeError);
      event.target.value = "";
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast.warning(text.sizeError);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    upload.mutate(
      { buId: entityId, file },
      {
        onSuccess: () => {
          toast.success(text.uploaded);
          setPreview(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: () => {
          setPreview(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
      },
    );
  };

  const handleRemoveClick = () => {
    if (preview) {
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!imageUrl) return;
    setConfirmOpen(true);
  };

  const handleConfirmRemove = () => {
    remove.mutate(entityId, {
      onSuccess: () => {
        toast.success(text.removed);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setConfirmOpen(false);
      },
    });
  };

  let primaryButtonText: string;
  if (isUploading) primaryButtonText = text.uploading;
  else if (hasImage) primaryButtonText = text.change;
  else primaryButtonText = text.upload;

  return (
    <>
      {/* ไทล์ = ช่องรูปสูงคงที่ + แถวชื่อกับปุ่มไอคอน · โลโก้กับ avatar ใช้โครงเดียวกัน จึงตรงแนวกัน
          ทุกขนาดไม่ว่ารูปจะกว้างเท่าไร · ไม่มีกรอบไทล์ซ้อนในการ์ด BU — กรอบมีแค่ช่องรูป */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="bg-muted/50 relative flex h-16 items-center justify-center overflow-hidden rounded-md border">
          {displayUrl ? (
            shape === "landscape" ? (
              <img
                src={displayUrl}
                alt={text.title}
                className="size-full object-contain p-1"
                loading={priority ? "eager" : "lazy"}
              />
            ) : (
              <img
                src={displayUrl}
                alt={text.title}
                className="size-13 rounded-full border object-cover"
                loading={priority ? "eager" : "lazy"}
              />
            )
          ) : (
            <ImageIcon
              className={cn(
                "text-muted-foreground size-5",
                // avatar ว่าง: วงกลมจาง ๆ บอกรูปทรงที่จะได้ ต่างจากช่องโลโก้ว่าง
                shape === "round" &&
                  "bg-background size-13 rounded-full border p-3.5",
              )}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="flex min-w-0 items-center gap-0.5">
          <span className="text-muted-foreground min-w-0 flex-1 text-xs">
            {text.title}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            aria-label={primaryButtonText}
            title={primaryButtonText}
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="size-3.5" aria-hidden="true" />
            )}
          </Button>
          {hasImage && !isUploading && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isDeleting}
              onClick={handleRemoveClick}
              aria-label={isDeleting ? text.removing : text.remove}
              title={text.remove}
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-3.5" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
        {/* คำแนะนำ (ชนิดไฟล์ ขนาด) ต้องใช้ตอนจะอัปโหลดครั้งแรกเท่านั้น — มีรูปแล้วซ่อน
            ไม่งั้นซ้ำทุก BU · ไฟล์ผิดชนิด/ใหญ่เกินยังมี toast เตือนอยู่ */}
        {!hasImage && (
          <p className="text-muted-foreground/80 text-micro leading-snug">
            {text.hint}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT_ATTR}
          className="hidden"
          onChange={handleChange}
        />
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => !o && !isDeleting && setConfirmOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{text.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{text.confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {text.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmRemove();
              }}
            >
              {isDeleting ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-3" aria-hidden="true" />
              )}
              {isDeleting ? text.removing : text.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** หมวดย่อยในการ์ดของ BU (โรงแรม / บริษัท) — หัวข้อเล็ก + กริดของช่อง ไม่มีกรอบซ้อน */
function SubSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-xs font-semibold">{title}</h4>
      {/* ไม่ dense: ชื่อบริษัท อีเมล ที่อยู่ ยาวทั้งนั้น — ครึ่งการ์ดมือถือตัดอีเมลกลางคำ
          และชื่อบริษัทยาว 4 บรรทัด ข้างกันเหลือแค่เบอร์โทร */}
      <FieldGrid>{children}</FieldGrid>
    </div>
  );
}

export default function BUSection({ bu }: { bu: BusinessUnit }) {
  const t = useTranslations("profile");
  const tfl = useTranslations("field");
  const { config } = bu;

  const logoText: ImageUploadText = {
    title: t("logo"),
    hint: t("logoHint"),
    upload: t("uploadLogo"),
    change: t("changeLogo"),
    remove: t("removeLogo"),
    uploading: t("uploadingLogo"),
    removing: t("removingLogo"),
    uploaded: t("logoUploaded"),
    removed: t("logoRemoved"),
    typeError: t("logoTypeError"),
    sizeError: t("logoSizeError"),
    confirmTitle: t("removeLogoConfirmTitle"),
    confirmDesc: t("removeLogoConfirmDesc", { name: bu.name }),
    cancel: t("cancel"),
  };

  const avatarText: ImageUploadText = {
    title: t("buAvatar"),
    hint: t("buAvatarHint"),
    upload: t("buUploadAvatar"),
    change: t("buChangeAvatar"),
    remove: t("buRemoveAvatar"),
    uploading: t("buUploadingAvatar"),
    removing: t("buRemovingAvatar"),
    uploaded: t("buAvatarUploaded"),
    removed: t("buAvatarRemoved"),
    typeError: t("buAvatarTypeError"),
    sizeError: t("buAvatarSizeError"),
    confirmTitle: t("removeBuAvatarConfirmTitle"),
    confirmDesc: t("removeBuAvatarConfirmDesc", { name: bu.name }),
    cancel: t("cancel"),
  };

  return (
    <section className="bg-card @container rounded-xl border p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold break-words">{bu.name}</h3>
        {bu.is_default && (
          <Badge variant="success-light" size="xs">
            {t("default")}
          </Badge>
        )}
        {config.is_hq && (
          <Badge variant="info-light" size="xs">
            {t("hq")}
          </Badge>
        )}
        {!bu.is_active && (
          <Badge variant="destructive-light" size="xs">
            {t("inactive")}
          </Badge>
        )}
      </div>

      {/* สองไทล์เคียงกันเท่ากัน — มือถือแบ่งครึ่งการ์ด · การ์ดกว้างไทล์ละ 15rem ชิดซ้าย ไม่ยืดตามจอ */}
      <div className="grid grid-cols-2 gap-3 @md:grid-cols-[repeat(2,15rem)]">
        <ImageUploadField
          imageUrl={bu.logo_url}
          entityId={bu.id}
          useUpload={useUploadBuLogo}
          useDelete={useDeleteBuLogo}
          shape="landscape"
          text={logoText}
          priority
        />
        <ImageUploadField
          imageUrl={bu.avatar_url}
          entityId={bu.id}
          useUpload={useUploadBuAvatar}
          useDelete={useDeleteBuAvatar}
          shape="round"
          text={avatarText}
          priority
        />
      </div>

      {/* dense: ค่าสั้น (รหัส ชื่อย่อ เลขภาษี) สองคอลัมน์ตั้งแต่จอแคบสุด — ช่อง fullWidth ยังกินเต็มแถว */}
      <div className="mt-4">
        <FieldGrid dense>
          <SettingField label={t("buCode")} value={bu.code} />
          <SettingField label={t("alias")} value={bu.alias_name} />
          <SettingField label={tfl("department")} value={bu.department?.name} />
          <SettingField label={t("systemLevel")} value={bu.system_level} />
          <SettingField
            label={t("hodDepartments")}
            value={bu.hod_department?.map((d) => d.name).join(", ")}
          />
          <SettingField label={t("taxNo")} value={config.tax_no} />
          <SettingField label={t("branchNo")} value={config.branch_no} />
          {config.description && (
            <SettingField
              label={tfl("description")}
              value={config.description}
              fullWidth
            />
          )}
        </FieldGrid>
      </div>

      {/* โรงแรม | บริษัท เป็นคู่กัน — เคียงกันเมื่อการ์ดกว้างพอ (ตัดสินจากการ์ด ไม่ใช่จอ) */}
      {(config.hotel || config.company) && (
        <div className="mt-4 grid gap-x-5 gap-y-4 border-t pt-4 @5xl:grid-cols-2">
          {config.hotel && (
            <SubSection title={t("hotel")}>
              <SettingField label={tfl("name")} value={config.hotel.name} />
              <SettingField label={t("telephone")} value={config.hotel.tel} />
              <SettingField label={tfl("email")} value={config.hotel.email} />
              <SettingField
                label={t("address")}
                value={config.hotel.address}
                fullWidth
              />
            </SubSection>
          )}
          {config.company && (
            <SubSection title={t("company")}>
              <SettingField label={tfl("name")} value={config.company.name} />
              <SettingField label={t("telephone")} value={config.company.tel} />
              <SettingField label={tfl("email")} value={config.company.email} />
              <SettingField
                label={t("address")}
                value={config.company.address}
                fullWidth
              />
            </SubSection>
          )}
        </div>
      )}
    </section>
  );
}
