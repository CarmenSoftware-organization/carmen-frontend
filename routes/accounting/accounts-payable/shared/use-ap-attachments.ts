import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type { ApAttachment, ApLiveAttachment } from "@/types/accounts-payable";

interface PendingFile {
  key: string;
  file: File;
  uploaded?: ApLiveAttachment;
}

/** Stage files until Save and retain successful uploads when a later upload/save fails. */
export function useApAttachments(initial: readonly ApAttachment[] = []) {
  const bu = useBuCode();
  const [attachments, setAttachments] = useState<ApAttachment[]>(() => [
    ...initial,
  ]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const pending = useRef(files);
  const [uploading, setUploading] = useState(false);
  const tc = useTranslations("commentSheet");

  const changeFiles = (next: PendingFile[]) => {
    pending.current = next;
    setFiles(next);
  };
  const prepare = async (): Promise<ApAttachment[]> => {
    if (!bu) throw new Error("Missing business unit");
    setUploading(true);
    try {
      for (const entry of pending.current) {
        if (entry.uploaded) continue;
        const body = new FormData();
        body.append("file", entry.file);
        const response = await httpClient.post(
          `${API_ENDPOINTS.DOCUMENTS(bu)}/upload`,
          body,
        );
        if (!response.ok)
          throw await ApiError.from(response, tc("uploadFailed"));
        const json = await response.json();
        const data = json?.data ?? json;
        // shortcut: failed AP saves can leave unlinked uploads; add server-managed staging cleanup if orphan storage grows.
        if (typeof data?.fileToken !== "string" || !data.fileToken.trim())
          throw new Error(tc("uploadFailed"));
        entry.uploaded = {
          originalName: entry.file.name,
          fileToken: data.fileToken,
          contentType: entry.file.type || "application/octet-stream",
        };
      }
      return [
        ...attachments,
        ...pending.current.map((entry) => entry.uploaded!),
      ];
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tc("uploadFailed"));
      throw error;
    } finally {
      setUploading(false);
    }
  };
  return {
    attachments,
    files,
    uploading,
    prepare,
    add: (added: readonly File[]) =>
      changeFiles([
        ...pending.current,
        ...added.map((file) => ({ key: crypto.randomUUID(), file })),
      ]),
    remove: (index: number) =>
      setAttachments((current) => current.filter((_, i) => i !== index)),
    removePending: (key: string) =>
      changeFiles(pending.current.filter((entry) => entry.key !== key)),
    reset: () => {
      setAttachments([...initial]);
      changeFiles([]);
    },
  };
}
