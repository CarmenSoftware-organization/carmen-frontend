import { useRef, useState } from "react";
import {
  AtSign,
  Barcode,
  Building,
  Briefcase,
  FileText,
  GitBranch,
  Hotel,
  ImageIcon,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
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

  // โลโก้ช่องว่างเป็น 4:1 (h-16 w-64) — มีรูปแล้วสูงเท่าเดิม กว้างตามสัดส่วนรูป ไม่เกิน 4:1
  const landscapeBox = displayUrl ? "h-16 w-auto min-w-16 max-w-64" : "h-16 w-64";
  const boxClass = cn(
    "bg-muted/50 relative flex shrink-0 items-center justify-center overflow-hidden border",
    shape === "landscape"
      ? cn(landscapeBox, "rounded-md")
      : "size-16 rounded-full",
  );
  const imageClass =
    shape === "landscape"
      ? "h-full w-auto max-w-full object-contain"
      : "absolute inset-0 size-full object-cover";

  return (
    <>
      <div className="bg-background/50 flex flex-wrap items-center gap-3 rounded-lg border p-2">
        <div className={boxClass}>
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={text.title}
              className={imageClass}
              loading={priority ? "eager" : "lazy"}
            />
          ) : (
            <ImageIcon
              className="text-muted-foreground size-6"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {text.title}
          </p>
          <p className="text-muted-foreground text-micro-legal">{text.hint}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-3" aria-hidden="true" />
              )}
              {primaryButtonText}
            </Button>
            {hasImage && !isUploading && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={isDeleting}
                onClick={handleRemoveClick}
                aria-label={text.remove}
              >
                {isDeleting ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-3" aria-hidden="true" />
                )}
                {isDeleting ? text.removing : text.remove}
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT_ATTR}
            className="hidden"
            onChange={handleChange}
          />
        </div>
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

function InfoItem({
  icon: Icon,
  label,
  value,
  adornment,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  adornment?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 flex items-center gap-2 rounded-lg px-2 py-1.5">
      <span className="bg-background flex size-7 items-center justify-center rounded-md border">
        <Icon className="text-muted-foreground size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-muted-foreground text-micro-legal font-semibold tracking-wide uppercase">
          {label}
        </dt>
        <dd
          className="flex items-center gap-1.5 text-xs font-semibold"
          title={value || undefined}
        >
          <span className="truncate">{value || "-"}</span>
          {adornment}
        </dd>
      </div>
    </div>
  );
}

function SubSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background/50 space-y-2 rounded-lg border p-2">
      <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        <Icon className="size-3.5" aria-hidden="true" />
        {title}
      </h4>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</dl>
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
    <section className="space-y-3">
      {(config.is_hq || !bu.is_active) && (
        <div className="flex items-center gap-1.5">
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
      )}

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

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <InfoItem
          icon={Barcode}
          label={t("buCode")}
          value={bu.code}
          adornment={
            bu.is_default && (
              <Badge variant="success-light" size="xs">
                {t("default")}
              </Badge>
            )
          }
        />
        <InfoItem icon={AtSign} label={t("alias")} value={bu.alias_name} />
        <InfoItem
          icon={Briefcase}
          label={tfl("department")}
          value={bu.department?.name}
        />
        <InfoItem
          icon={Layers}
          label={t("systemLevel")}
          value={bu.system_level}
        />
        <InfoItem
          icon={Users}
          label={t("hodDepartments")}
          value={bu.hod_department?.map((d) => d.name).join(", ")}
        />
        <InfoItem icon={Receipt} label={t("taxNo")} value={config.tax_no} />
        <InfoItem
          icon={GitBranch}
          label={t("branchNo")}
          value={config.branch_no}
        />
        {config.description && (
          <InfoItem
            icon={FileText}
            label={tfl("description")}
            value={config.description}
          />
        )}
      </dl>

      {config.hotel && (
        <SubSection title={t("hotel")} icon={Hotel}>
          <InfoItem
            icon={Hotel}
            label={tfl("name")}
            value={config.hotel.name}
          />
          <InfoItem
            icon={Phone}
            label={t("telephone")}
            value={config.hotel.tel}
          />
          <InfoItem
            icon={Mail}
            label={tfl("email")}
            value={config.hotel.email}
          />
          <InfoItem
            icon={MapPin}
            label={t("address")}
            value={config.hotel.address}
          />
        </SubSection>
      )}

      {config.company && (
        <SubSection title={t("company")} icon={Building}>
          <InfoItem
            icon={Building}
            label={tfl("name")}
            value={config.company.name}
          />
          <InfoItem
            icon={Phone}
            label={t("telephone")}
            value={config.company.tel}
          />
          <InfoItem
            icon={Mail}
            label={tfl("email")}
            value={config.company.email}
          />
          <InfoItem
            icon={MapPin}
            label={t("address")}
            value={config.company.address}
          />
        </SubSection>
      )}
    </section>
  );
}
