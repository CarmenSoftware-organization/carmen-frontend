import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { ErrorState } from "@/components/ui/error-state";
import {
  SettingSection,
  SettingSectionSkeleton,
} from "@/components/ui/setting-section";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { AskAiProviderCard, type AskAiDraft } from "./ask-ai-provider-card";
import {
  buildSaveBody,
  useAskAiConfig,
  useSaveAskAiConfig,
  type AskAiConfigItem,
} from "./use-ask-ai-config";

const FORM_ID = "ask-ai-form";

type Drafts = Record<string, AskAiDraft>;

function toDraft(item: AskAiConfigItem): AskAiDraft {
  return {
    enabled: item.bu_enabled ?? item.default_enabled_for_bu,
    prompt: item.bu_prompt ?? "",
  };
}

function toDrafts(items: readonly AskAiConfigItem[]): Drafts {
  return Object.fromEntries(items.map((i) => [i.code, toDraft(i)]));
}

function isChanged(item: AskAiConfigItem, draft: AskAiDraft): boolean {
  const base = toDraft(item);
  return base.enabled !== draft.enabled || base.prompt !== draft.prompt;
}

export default function AskAiComponent() {
  const tm = useTranslations("modules");
  const t = useTranslations("askAi");
  const { data, isLoading, isError, refetch } = useAskAiConfig();
  const save = useSaveAskAiConfig();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>({});

  const items = data?.items ?? [];
  const hasUnsaved =
    editing &&
    items.some((i) => drafts[i.code] && isChanged(i, drafts[i.code]));
  const discard = useDiscardConfirm({
    isDirty: hasUnsaved,
    isPending: save.isPending,
  });
  const navGuard = useNavigationGuard(hasUnsaved);

  const handleEdit = () => {
    setDrafts(toDrafts(items));
    setEditing(true);
  };
  const exitEdit = () => {
    setDrafts({});
    setEditing(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(buildSaveBody(items, drafts), {
      onSuccess: () => {
        toast.success(t("saved"));
        exitEdit();
      },
      // ไม่ต้อง onError — MutationCache กลาง toast ให้แล้ว
    });
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          mode={editing ? "edit" : "view"}
          formId={FORM_ID}
          isPending={save.isPending}
          title={tm("askAi")}
          subtitle={t("pageDescription")}
          permissionPrefix="system_admin.business_unit"
          onCancel={() => discard.confirm(exitEdit)}
          onEdit={!isError && !isLoading && data ? handleEdit : undefined}
        />
      }
    >
      {isError && (
        <ErrorState message={t("loadError")} onRetry={() => refetch()} />
      )}

      {!isError && isLoading && (
        <SettingSectionSkeleton first fields={["full", "full"]} />
      )}

      {!isError && !isLoading && data && (
        <form id={FORM_ID} onSubmit={onSubmit}>
          <SettingSection first plain title={tm("askAi")}>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            ) : (
              <div className="divide-y">
                {items.map((item) => (
                  <AskAiProviderCard
                    key={item.code}
                    item={item}
                    editing={editing}
                    draft={
                      editing
                        ? (drafts[item.code] ?? toDraft(item))
                        : toDraft(item)
                    }
                    onChange={(next) =>
                      setDrafts((prev) => ({ ...prev, [item.code]: next }))
                    }
                  />
                ))}
              </div>
            )}
          </SettingSection>
        </form>
      )}

      <DiscardDialog {...discard.dialogProps} variant="warning" />
      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />
    </FormPageShell>
  );
}
