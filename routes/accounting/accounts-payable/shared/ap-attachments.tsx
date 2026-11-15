import { useState } from "react";
import { Download, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeletedAttachmentChip } from "@/components/ui/deleted-attachment-chip";
import { useAttachmentPolicy } from "@/hooks/use-attachment-policy";
import { useBuCode } from "@/hooks/use-bu-code";
import { useProfile } from "@/hooks/use-profile";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import {
  acceptFor,
  isFileAllowed,
  maxBytesOf,
  typesLabel,
} from "@/lib/attachment-policy";
import type { ApLiveAttachment } from "@/types/accounts-payable";
import type { useApAttachments } from "./use-ap-attachments";

export function ApAttachmentsPanel({
  state,
  editable,
  disabled,
}: {
  readonly state: ReturnType<typeof useApAttachments>;
  readonly editable: boolean;
  readonly disabled: boolean;
}) {
  const t = useTranslations("accounting.accountsPayable.ui");
  const tc = useTranslations("commentSheet");
  const common = useTranslations("common");
  const bu = useBuCode();
  const { dateFormat } = useProfile();
  const policy = useAttachmentPolicy(editable);
  const [downloading, setDownloading] = useState<string | null>(null);
  const download = async (attachment: ApLiveAttachment) => {
    if (!bu) return;
    setDownloading(attachment.fileToken);
    try {
      const id = attachment.fileToken.split("/").pop()!;
      const response = await httpClient.get(
        `${API_ENDPOINTS.DOCUMENTS(bu)}/${encodeURIComponent(id)}/download`,
      );
      if (!response.ok)
        throw await ApiError.from(response, t("attachmentDownloadFailed"));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.originalName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("attachmentDownloadFailed"),
      );
    } finally {
      setDownloading(null);
    }
  };
  return (
    <section className="space-y-3">
      {editable && (
        <>
          <Input
            type="file"
            multiple
            accept={acceptFor(policy)}
            aria-label={t("attachFiles")}
            disabled={disabled}
            onChange={(event) => {
              const valid: File[] = [];
              for (const file of Array.from(event.target.files ?? [])) {
                if (!isFileAllowed(file, policy))
                  toast.error(
                    tc("fileNotAllowed", {
                      name: file.name,
                      types: typesLabel(policy),
                    }),
                  );
                else if (file.size > maxBytesOf(policy))
                  toast.error(
                    tc("fileTooLarge", {
                      name: file.name,
                      max: policy.max_size_mb,
                    }),
                  );
                else valid.push(file);
              }
              state.add(valid);
              event.target.value = "";
            }}
          />
          <p className="text-muted-foreground text-xs">
            {t("attachmentsSaveHint")}
          </p>
        </>
      )}
      {!state.attachments.length && !state.files.length && (
        <p className="text-muted-foreground text-xs">{t("noAttachments")}</p>
      )}
      <ul className="divide-y">
        {state.attachments.map((attachment, index) => (
          <li
            key={attachment.deleted ? `deleted-${index}` : attachment.fileToken}
            className="flex min-w-0 items-center gap-2 py-2"
          >
            {attachment.deleted ? (
              <DeletedAttachmentChip
                deletedAt={attachment.deleted_at}
                dateFormat={dateFormat}
              />
            ) : (
              <>
                <Paperclip className="text-muted-foreground size-4 shrink-0" />
                <span
                  className="min-w-0 flex-1 truncate text-xs"
                  title={attachment.originalName}
                >
                  {attachment.originalName}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`${common("download")} ${attachment.originalName}`}
                  disabled={downloading === attachment.fileToken}
                  onClick={() => void download(attachment)}
                >
                  <Download className="size-4" />
                </Button>
                {editable && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={tc("removeFile", {
                      name: attachment.originalName,
                    })}
                    onClick={() => state.remove(index)}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </>
            )}
          </li>
        ))}
        {state.files.map((entry) => (
          <li key={entry.key} className="flex min-w-0 items-center gap-2 py-2">
            <Paperclip className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-xs">
              {entry.file.name}
            </span>
            <span className="text-muted-foreground text-xs">
              {t("pendingAttachment")}
            </span>
            {editable && (
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={disabled}
                aria-label={tc("removeFile", { name: entry.file.name })}
                onClick={() => state.removePending(entry.key)}
              >
                <X className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
