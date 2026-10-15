import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Braces, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { useCreateRunningCode, useUpdateRunningCode } from "./use-running-code";
import type { RunningCode } from "@/types/running-code";
import { RunningCodeConfigFields } from "./running-code-config-fields";
import { parseConfig } from "./running-code-config";
import {
  createRunningCodeSchema,
  type RunningCodeFormValues,
  getDefaultValues,
} from "./running-code-form-schema";
import { useServerFieldErrors } from "@/hooks/use-server-field-errors";

interface RunningCodeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly runningCode?: RunningCode | null;
}

export function RunningCodeDialog({
  open,
  onOpenChange,
  runningCode,
}: RunningCodeDialogProps) {
  const isEdit = !!runningCode;
  const createRunningCode = useCreateRunningCode();
  const updateRunningCode = useUpdateRunningCode();
  const isPending = createRunningCode.isPending || updateRunningCode.isPending;
  const t = useTranslations("systemAdmin.runningCode");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");

  const runningCodeSchema = createRunningCodeSchema(tv, tfl);
  const form = useForm<RunningCodeFormValues>({
    resolver: zodResolver(runningCodeSchema) as Resolver<RunningCodeFormValues>,
    defaultValues: getDefaultValues(),
  });
  useServerFieldErrors(form, { RUNNING_CODE_ALREADY_EXISTS: "type" });

  // ประกาศหลัง `form` — ของเดิมอยู่เหนือ useForm แล้วรอดเพราะเป็น closure ที่เรียก
  // ตอนคลิก ถ้ามีใครย้ายไปเรียกตอน render เมื่อไหร่จะ throw TDZ ทันที
  const handleFormatJson = () => {
    const raw = form.getValues("config");
    if (!raw?.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      // shouldValidate ด้วย — จัดรูปสำเร็จแปลว่า JSON ถูกแล้ว error เดิมควรหายไป
      // ไม่ใช่ค้างจนกว่าจะกด submit
      form.setValue("config", JSON.stringify(parsed, null, 2), {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch {
      toast.warning(tv("invalidJson", { field: tfl("config") }));
    }
  };

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const configText = form.watch("config");
  // ตัวช่วยแก้ได้ไหม — JSON พังหรือรูปแบบแปลก ให้ตกไปที่ช่อง JSON อย่างเดียว
  const editable = useMemo(() => {
    try {
      return parseConfig(JSON.parse(configText?.trim() || "{}")) !== null;
    } catch {
      return false;
    }
  }, [configText]);

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(runningCode ?? undefined));
    }
  }, [open, runningCode, form]);

  const onSubmit = (values: RunningCodeFormValues) => {
    // schema refine parse ผ่านมาแล้ว แต่ผูกกันแบบไม่มีอะไรบังคับ — วันไหนมีคนแก้
    // schema ตัวนั้น submit จะ throw ทิ้งกลางทางโดยผู้ใช้ไม่เห็นอะไรเลย กันไว้ที่นี่
    // แล้วเด้ง error ลงช่อง config ให้เห็นตรงจุด
    let config: Record<string, unknown> = {};
    if (values.config?.trim()) {
      try {
        config = JSON.parse(values.config);
      } catch {
        form.setError("config", {
          message: tv("invalidJson", { field: tfl("config") }),
        });
        return;
      }
    }

    const payload = {
      type: values.type,
      config,
      note: values.note,
    };

    if (isEdit) {
      updateRunningCode.mutate(
        // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
        {
          id: runningCode.id,
          doc_version: runningCode.doc_version,
          ...payload,
        },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            onOpenChange(false);
          },
        },
      );
    } else {
      createRunningCode.mutate(payload, {
        onSuccess: () => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          onOpenChange(false);
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="gap-3 p-4 sm:max-w-lg">
        <DialogHeader className="gap-0 pb-1">
          <DialogTitle className="text-sm">
            {isEdit
              ? tf("editTitle", { entity: t("entity") })
              : tf("addTitle", { entity: t("entity") })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FieldGroup className="gap-3">
            <Field data-invalid={!!form.formState.errors.type}>
              <FieldLabel htmlFor="rc-type" className="text-xs" required>
                {tfl("type")}
              </FieldLabel>
              <Input
                id="rc-type"
                placeholder={t("typePlaceholder")}
                className="h-8"
                disabled={isPending || isEdit}
                readOnly={isEdit}
                maxLength={100}
                {...form.register("type")}
              />
              <FieldError>{form.formState.errors.type?.message}</FieldError>
            </Field>

            <Field data-invalid={!!form.formState.errors.config}>
              <FieldLabel htmlFor="rc-config" className="text-xs">
                {tfl("config")}
              </FieldLabel>

              <RunningCodeConfigFields
                value={configText}
                onChange={(next) =>
                  form.setValue("config", next, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                disabled={isPending}
              />
              {!editable && (
                <p className="text-muted-foreground text-micro">
                  {t("configUnreadable")}
                </p>
              )}

              {/* JSON ดิบยังอยู่ แต่พับเก็บ — backend รับคีย์อะไรก็ได้ ตัวช่วยข้างบน
                  รู้จักไม่ครบทุกกรณี ต้องมีทางแก้มือเสมอ · ทั้งสองอ่าน/เขียนค่า
                  เดียวกัน แก้ทางไหนอีกทางเห็นทันที */}
              <Collapsible
                open={advancedOpen || !editable}
                onOpenChange={setAdvancedOpen}
              >
                <CollapsibleTrigger
                  className="text-muted-foreground hover:text-foreground text-micro flex items-center gap-1"
                  disabled={!editable}
                >
                  <ChevronRight
                    className={`size-3 transition-transform ${advancedOpen || !editable ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                  {t("advancedConfig")}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-1.5">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={handleFormatJson}
                      disabled={isPending}
                    >
                      <Braces aria-hidden="true" />
                      {tc("formatJson")}
                    </Button>
                  </div>
                  <Textarea
                    id="rc-config"
                    placeholder='e.g. {"key":"value"}'
                    className="min-h-24 text-xs"
                    rows={4}
                    disabled={isPending}
                    {...form.register("config")}
                  />
                </CollapsibleContent>
              </Collapsible>

              <FieldError>{form.formState.errors.config?.message}</FieldError>
            </Field>

            <Field data-invalid={!!form.formState.errors.note}>
              <FieldLabel htmlFor="rc-note" className="text-xs">
                {tfl("note")}
              </FieldLabel>
              <Textarea
                id="rc-note"
                placeholder={t("notePlaceholder")}
                className="min-h-13 text-xs"
                rows={2}
                disabled={isPending}
                maxLength={256}
                {...form.register("note")}
              />
              <FieldError>{form.formState.errors.note?.message}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && isEdit && tf("saving")}
              {isPending && !isEdit && tf("creating")}
              {!isPending && isEdit && tc("save")}
              {!isPending && !isEdit && tc("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
