import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  MessageSquare,
  Send,
  Workflow,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface StageOption {
  readonly key: string;
  readonly name: string;
}

export interface ActionDialogItem {
  readonly index: number;
  readonly productName: string;
  readonly locationName: string;
}

type ActionVariant = "default" | "destructive" | "success" | "info" | "warning";

interface SrActionDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly srNo?: string;
  readonly confirmLabel?: string;
  readonly confirmVariant?: ActionVariant;
  readonly isPending?: boolean;
  readonly showMessage?: boolean;
  readonly stages?: StageOption[];
  readonly stagesLoading?: boolean;
  readonly items?: ActionDialogItem[];
  readonly onConfirm: (
    messages: Record<number, string>,
    desStage?: string,
  ) => void;
}

const TONE: Record<
  ActionVariant,
  {
    iconBg: string;
    iconColor: string;
    icon: LucideIcon;
    titleColor: string;
  }
> = {
  default: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    icon: Send,
    titleColor: "text-foreground",
  },
  success: {
    iconBg: "bg-success/10",
    iconColor: "text-success-ink",
    icon: CheckCircle2,
    titleColor: "text-foreground",
  },
  destructive: {
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    icon: XCircle,
    titleColor: "text-destructive",
  },
  warning: {
    iconBg: "bg-warning/10",
    iconColor: "text-warning-ink",
    icon: AlertTriangle,
    titleColor: "text-warning-ink",
  },
  info: {
    iconBg: "bg-info/10",
    iconColor: "text-info-ink",
    icon: Info,
    titleColor: "text-foreground",
  },
};

export function SrActionDialog({
  open,
  onOpenChange,
  title,
  description,
  srNo,
  confirmLabel,
  confirmVariant = "warning",
  isPending,
  showMessage = true,
  stages,
  stagesLoading,
  items = [],
  onConfirm,
}: SrActionDialogProps) {
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const t = useTranslations("storeOperation.storeRequisition");
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [selectedStage, setSelectedStage] = useState("");

  const tone = TONE[confirmVariant];
  const Icon = tone.icon;
  const showStages = !!stages || !!stagesLoading;
  const stageRequired = showStages && !selectedStage;
  const hasItems = items.length > 0;

  const handleConfirm = () => {
    onConfirm(messages, showStages ? selectedStage : undefined);
    setMessages({});
    setSelectedStage("");
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setMessages({});
      setSelectedStage("");
    }
    onOpenChange(value);
  };

  const setMessage = (index: number, value: string) =>
    setMessages((prev) => ({ ...prev, [index]: value }));

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className={`flex max-h-[85vh] flex-col gap-0 p-0 ${
          hasItems ? "sm:max-w-lg" : "sm:max-w-md"
        }`}
      >
        <div className="shrink-0 p-5">
          <div className="flex items-start gap-3">
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone.iconBg} ${tone.iconColor}`}
            >
              <Icon className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className={`text-sm ${tone.titleColor}`}>
                {title}
              </AlertDialogTitle>
              {(description || srNo) && (
                <AlertDialogDescription className="mt-1">
                  {srNo && (
                    <strong className="text-foreground font-semibold">
                      {srNo}
                    </strong>
                  )}
                  {srNo && description ? " — " : null}
                  {description}
                </AlertDialogDescription>
              )}
              {hasItems && (
                <div className="mt-2">
                  <Badge variant="outline" size="xs" className="tabular-nums">
                    {items.length}{" "}
                    {items.length === 1 ? tc("itemSingular") : tc("itemPlural")}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {(showStages || showMessage) && (
          <div className="flex-1 space-y-4 overflow-y-auto border-t px-5 py-4">
            {showStages && (
              <section className="space-y-2">
                <div className="text-muted-foreground text-micro-legal flex items-center gap-1.5 font-semibold tracking-wider uppercase">
                  <Workflow className="size-3" />
                  {tfl("stage")}
                  <span className="text-destructive">*</span>
                </div>
                {stagesLoading && (
                  <p className="text-muted-foreground text-xs">
                    {tc("loading")}
                  </p>
                )}
                {!stagesLoading && (
                  <RadioGroup
                    value={selectedStage}
                    onValueChange={setSelectedStage}
                    disabled={isPending}
                    className="gap-1.5"
                  >
                    {(stages ?? []).map((s) => {
                      const selected = selectedStage === s.name;
                      return (
                        <Label
                          key={s.key}
                          htmlFor={`sr-stage-${s.key}`}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 text-xs transition-colors ${
                            selected
                              ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                              : "hover:bg-muted/40 hover:border-primary/30 bg-card"
                          }`}
                        >
                          <RadioGroupItem
                            value={s.name}
                            id={`sr-stage-${s.key}`}
                          />
                          <span className="font-semibold">{s.name}</span>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                )}
              </section>
            )}

            {showMessage && hasItems && (
              <section className="space-y-2">
                <div className="text-muted-foreground text-micro-legal flex items-center gap-1.5 font-semibold tracking-wider uppercase">
                  <MessageSquare className="size-3" />
                  {tfl("reason")}
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div
                      key={item.index}
                      className="bg-muted/30 space-y-1.5 rounded-lg border p-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="bg-background text-muted-foreground text-micro-legal flex size-5 shrink-0 items-center justify-center rounded-md border font-semibold tabular-nums">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs leading-snug font-semibold">
                            {item.productName || "—"}
                          </p>
                        </div>
                      </div>
                      <Input
                        className="bg-background h-8 text-xs placeholder:text-xs"
                        placeholder={t("reasonPlaceholder")}
                        maxLength={256}
                        value={messages[item.index] ?? ""}
                        onChange={(e) => setMessage(item.index, e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showMessage && !hasItems && (
              <section className="space-y-1.5">
                <div className="text-muted-foreground text-micro-legal flex items-center gap-1.5 font-semibold tracking-wider uppercase">
                  <MessageSquare className="size-3" />
                  {tfl("reason")}
                  <span className="text-muted-foreground font-normal normal-case">
                    ({tfl("optional")})
                  </span>
                </div>
                <Textarea
                  className="resize-none text-sm"
                  placeholder={t("reasonPlaceholder")}
                  maxLength={256}
                  rows={3}
                  value={messages[0] ?? ""}
                  onChange={(e) => setMessage(0, e.target.value)}
                  disabled={isPending}
                />
              </section>
            )}
          </div>
        )}

        <AlertDialogFooter className="bg-muted/20 shrink-0 border-t px-5 py-3">
          <AlertDialogCancel disabled={isPending}>
            {tc("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            size="default"
            variant={confirmVariant}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isPending || stageRequired}
          >
            <Icon />
            {isPending ? tc("processing") : (confirmLabel ?? tc("confirm"))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
