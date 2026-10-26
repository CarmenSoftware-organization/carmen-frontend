import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "use-intl";
import { ProviderIconMark } from "@/components/icons/provider-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AskAiConfigItem } from "./use-ask-ai-config";

export const ASK_AI_PROMPT_MAX = 4000;

export interface AskAiDraft {
  readonly enabled: boolean;
  readonly prompt: string;
}

interface AskAiProviderCardProps {
  readonly item: AskAiConfigItem;
  readonly draft: AskAiDraft;
  readonly editing: boolean;
  readonly onChange: (next: AskAiDraft) => void;
}

export function AskAiProviderCard({
  item,
  draft,
  editing,
  onChange,
}: AskAiProviderCardProps) {
  const t = useTranslations("askAi");
  const [showDefault, setShowDefault] = useState(false);
  const customized =
    draft.prompt.trim() !== "" || draft.enabled !== item.default_enabled_for_bu;
  const idPrefix = `ask-ai-${item.code}`;

  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <ProviderIconMark iconKey={item.icon_key} className="size-5 shrink-0" />
        <span className="text-sm font-medium">{item.label}</span>
        <Badge variant={customized ? "primary-light" : "secondary"}>
          {customized ? t("customized") : t("usingDefault")}
        </Badge>
        <label
          htmlFor={`${idPrefix}-enabled`}
          className="text-muted-foreground ml-auto flex items-center gap-2 text-xs"
        >
          {t("enabled")}
          <Switch
            id={`${idPrefix}-enabled`}
            checked={draft.enabled}
            disabled={!editing}
            onCheckedChange={(enabled) => onChange({ ...draft, enabled })}
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-prompt`} className="text-xs font-medium">
          {t("promptLabel")}
        </label>
        <Textarea
          id={`${idPrefix}-prompt`}
          value={draft.prompt}
          maxLength={ASK_AI_PROMPT_MAX}
          readOnly={!editing}
          placeholder={t("promptPlaceholder")}
          onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
        />
        <p className="text-muted-foreground text-xs">
          {/* ห้ามใส่ {items} ใน messages (ICU) จึงเขียนใน JSX ตรง ๆ */}
          {t("promptHintPrefix")} <code>{"{items}"}</code>{" "}
          {t("promptHintSuffix")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Collapsible
          open={showDefault}
          onOpenChange={setShowDefault}
          className="flex-1"
        >
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <ChevronDown
                className={
                  showDefault
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
              {showDefault ? t("hideDefault") : t("showDefault")}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="bg-muted text-muted-foreground mt-2 rounded-md p-3 text-xs break-words whitespace-pre-wrap">
              {item.default_prompt}
            </pre>
          </CollapsibleContent>
        </Collapsible>
        {editing && draft.prompt !== "" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...draft, prompt: "" })}
          >
            {t("resetPrompt")}
          </Button>
        )}
      </div>
    </div>
  );
}
