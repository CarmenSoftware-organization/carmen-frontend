import { ChevronRight } from "lucide-react";
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
import { cn } from "@/lib/utils";
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
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (next: AskAiDraft) => void;
}

/**
 * หนึ่งแถวต่อ provider — ยุบไว้ = ไอคอน · ชื่อ · ที่มาของ prompt · สถานะ + prompt ที่ใช้จริง 1 บรรทัด
 * ขยาย = prompt เต็ม (view) หรือ editor (edit) · ขยายได้ทีละแถว (parent คุม `open`)
 */
export function AskAiProviderCard({
  item,
  draft,
  editing,
  open,
  onOpenChange,
  onChange,
}: AskAiProviderCardProps) {
  const t = useTranslations("askAi");
  const custom = draft.prompt.trim() !== "";
  const effectivePrompt = custom ? draft.prompt : item.default_prompt;
  const idPrefix = `ask-ai-${item.code}`;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="flex items-start gap-3 py-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-2 -my-1 flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1 text-left outline-none focus-visible:ring-[3px]"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                "text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform",
                open && "rotate-90",
              )}
            />
            {item.icon_url ? (
              <img
                src={item.icon_url}
                alt=""
                referrerPolicy="no-referrer"
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  !draft.enabled && "opacity-40 grayscale",
                )}
              />
            ) : (
              <ProviderIconMark
                iconKey={item.icon_key}
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  !draft.enabled && "opacity-40 grayscale",
                )}
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    !draft.enabled && "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
                <Badge
                  size="xs"
                  variant={custom ? "primary-light" : "invert-light"}
                  className={cn(!custom && "text-muted-foreground")}
                >
                  {custom ? t("customized") : t("usingDefault")}
                </Badge>
              </span>
              {!open && (
                // ตัวอย่างเท่านั้น — prompt เต็มอยู่ในส่วนที่ขยาย ไม่ให้ screen reader อ่านทั้งก้อนเป็นชื่อปุ่ม
                <span
                  aria-hidden
                  className="text-muted-foreground mt-0.5 block truncate text-xs"
                >
                  {effectivePrompt.replace(/\s+/g, " ")}
                </span>
              )}
            </span>
          </button>
        </CollapsibleTrigger>

        {editing ? (
          <Switch
            id={`${idPrefix}-enabled`}
            aria-label={`${item.label} — ${t("enabled")}`}
            checked={draft.enabled}
            onCheckedChange={(enabled) => onChange({ ...draft, enabled })}
            className="mt-0.5"
          />
        ) : (
          <span
            className={cn(
              "mt-0.5 flex shrink-0 items-center gap-1.5 text-xs",
              draft.enabled ? "text-success-ink" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                draft.enabled ? "bg-success" : "bg-muted-foreground/50",
              )}
            />
            {draft.enabled ? t("on") : t("off")}
          </span>
        )}
      </div>

      <CollapsibleContent>
        <div className="space-y-3 pb-4 pl-6">
          {editing ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`${idPrefix}-prompt`}
                  className="text-xs font-medium"
                >
                  {t("promptLabel")}
                </label>
                {custom ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange({ ...draft, prompt: "" })}
                  >
                    {t("resetPrompt")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange({ ...draft, prompt: item.default_prompt })
                    }
                  >
                    {t("startFromDefault")}
                  </Button>
                )}
              </div>
              <Textarea
                id={`${idPrefix}-prompt`}
                value={draft.prompt}
                maxLength={ASK_AI_PROMPT_MAX}
                placeholder={t("promptPlaceholder")}
                onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
                className="min-h-28"
              />
              <p className="text-muted-foreground text-xs">
                {/* ห้ามใส่ {items} ใน messages (ICU) จึงเขียนใน JSX ตรง ๆ */}
                {t("promptHintPrefix")} <code>{"{items}"}</code>{" "}
                {t("promptHintSuffix")}
              </p>
            </div>
          ) : (
            <PromptBlock
              label={custom ? t("customPromptLabel") : t("defaultPromptLabel")}
              text={effectivePrompt}
            />
          )}

          {/* แก้ prompt เองแล้ว → ยังเห็นค่ามาตรฐานไว้เทียบ */}
          {custom && (
            <PromptBlock
              label={t("defaultPromptLabel")}
              text={item.default_prompt}
              muted
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PromptBlock({
  label,
  text,
  muted,
}: {
  readonly label: string;
  readonly text: string;
  readonly muted?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <pre
        className={cn(
          "bg-muted max-h-64 overflow-y-auto rounded-md p-3 font-sans text-xs leading-relaxed break-words whitespace-pre-wrap",
          muted && "text-muted-foreground",
        )}
      >
        {text}
      </pre>
    </div>
  );
}
