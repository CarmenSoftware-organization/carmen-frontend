import { useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ContractDocumentDialog } from "./ar-contract-dialog";
import type { ArContract } from "./ar-contract-model";

type Document = NonNullable<ArContract["document"]>;
export function ProfileAttachments({
  bu,
  id,
  canWrite,
  close,
}: {
  readonly bu: string;
  readonly id: string;
  readonly canWrite: boolean;
  readonly close: () => void;
}) {
  const t = useTranslations("accounting.arProfile");
  const tc = useTranslations("common");
  const storageKey = `carmen.ar.profile-attachments.v1.${bu}.${id}`;
  const [documents, setDocuments] = useState<Document[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState<Document>();
  const [loading, setLoading] = useState(false);
  const save = (next: Document[]) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
      setDocuments(next);
    } catch {
      toast.error(t("localSaveFailed"));
    }
  };
  async function add(file: File) {
    if (
      !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(
        file.type,
      ) ||
      file.size > 25 * 1024 * 1024
    ) {
      toast.error(t("attachmentInvalid"));
      return;
    }
    setLoading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      save([...documents, { name: file.name, mime: file.type, data }]);
    } catch {
      toast.error(t("localSaveFailed"));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("attachments")}</DialogTitle>
          <DialogDescription>{t("attachmentsMock")}</DialogDescription>
        </DialogHeader>
        {canWrite && (
          <Input
            type="file"
            aria-label={t("attachments")}
            accept="application/pdf,image/png,image/jpeg,image/webp"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void add(file);
              e.target.value = "";
            }}
          />
        )}
        <ul className="space-y-2">
          {documents.map((doc, index) => (
            <li
              key={`${doc.name}.${index}`}
              className="flex min-w-0 items-center gap-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs">
                {doc.name}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`${tc("view")} ${doc.name}`}
                onClick={() => setSelected(doc)}
              >
                <Eye />
              </Button>
              {canWrite && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  size="icon-sm"
                  aria-label={`${tc("delete")} ${doc.name}`}
                  disabled={loading}
                  onClick={() => save(documents.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {selected && (
          <ContractDocumentDialog
            document={selected}
            close={() => setSelected(undefined)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
