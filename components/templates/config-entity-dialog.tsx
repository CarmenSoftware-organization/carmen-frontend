import { useEffect, type ReactNode } from "react";
import {
  useForm,
  type Resolver,
  type UseFormReturn,
  type DefaultValues,
  type FieldValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { type LucideIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import type { TranslationFn } from "@/lib/i18n-schema";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  useServerFieldErrors,
  type ServerFieldErrorMap,
} from "@/hooks/use-server-field-errors";

interface MutationLike<TVars> {
  mutate: (
    vars: TVars,
    options: {
      onSuccess: (data: unknown) => void;
    },
  ) => void;
  isPending: boolean;
}

export interface ConfigEntityDialogProps<
  TEntity extends { id: string; doc_version?: number },
  TFormValues extends FieldValues,
  TPayload,
> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly entity?: TEntity | null;
  readonly readOnly?: boolean;

  readonly icon: LucideIcon;
  readonly translationNamespace: string;

  readonly useCreate: () => MutationLike<TPayload>;
  readonly useUpdate: () => MutationLike<
    TPayload & { id: string; doc_version?: number }
  >;

  readonly buildSchema: (
    tv: TranslationFn,
    tfl: TranslationFn,
  ) => ZodType<TFormValues>;
  readonly toFormValues: (entity?: TEntity | null) => TFormValues;
  readonly toPayload: (values: TFormValues) => TPayload;

  readonly contentClassName?: string;
  readonly onCreated?: (result: unknown) => void;
  readonly stopPropagationOnSubmit?: boolean;
  /** รหัส catalog → ช่องที่ต้องขึ้น error แทน toast (ดู `useServerFieldErrors`) */
  readonly serverFieldErrors?: ServerFieldErrorMap<TFormValues>;
  readonly children: (ctx: {
    form: UseFormReturn<TFormValues>;
    disabled: boolean;
  }) => ReactNode;
}

/**
 * Template มาตรฐานของ config entity dialog (create/edit) — คู่ขนานกับ
 * `ConfigListTemplate` ของหน้า list
 *
 * ดูดงานซ้ำของ dialog ทุกโมดูลเข้ามาไว้ที่เดียว: create/update hooks,
 * `isPending`, translation hooks, `useForm` + resolver, reset ตอนเปิด,
 * `onSubmit` (payload + doc_version + toast + ปิด dialog), submit label และ
 * chrome (`Dialog` + header ไอคอน + `FieldGroup` + footer cancel/submit)
 *
 * แต่ละโมดูลส่งเฉพาะส่วนที่ต่าง: icon, namespace, hooks, schema, การ map
 * form/payload และ fields (ผ่าน `children`)
 *
 * @example
 * ```tsx
 * <ConfigEntityDialog
 *   open={open} onOpenChange={onOpenChange} entity={businessType} readOnly={readOnly}
 *   icon={Briefcase} translationNamespace="config.businessType"
 *   useCreate={useCreateBusinessType} useUpdate={useUpdateBusinessType}
 *   buildSchema={createBusinessTypeSchema}
 *   toFormValues={(e) => (e ? { name: e.name, is_active: e.is_active } : EMPTY_FORM)}
 *   toPayload={(v) => ({ name: v.name, is_active: v.is_active })}
 * >
 *   {({ form, disabled }) => ( ...fields... )}
 * </ConfigEntityDialog>
 * ```
 */
export function ConfigEntityDialog<
  TEntity extends { id: string; doc_version?: number },
  TFormValues extends FieldValues,
  TPayload,
>({
  open,
  onOpenChange,
  entity,
  readOnly,
  icon: Icon,
  translationNamespace,
  useCreate,
  useUpdate,
  buildSchema,
  toFormValues,
  toPayload,
  contentClassName,
  onCreated,
  stopPropagationOnSubmit,
  serverFieldErrors,
  children,
}: ConfigEntityDialogProps<TEntity, TFormValues, TPayload>) {
  const isEdit = !!entity;
  const create = useCreate();
  const update = useUpdate();
  const isPending = create.isPending || update.isPending;

  const t = useTranslations(translationNamespace);
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");

  const form = useForm<TFormValues>({
    // schema input type เป็น generic — cast ให้ผ่าน overload ของ zodResolver
    resolver: zodResolver(
      buildSchema(tv, tfl) as never,
    ) as Resolver<TFormValues>,
    defaultValues: toFormValues(null) as DefaultValues<TFormValues>,
  });
  useServerFieldErrors(form, serverFieldErrors);

  useEffect(() => {
    if (open) form.reset(toFormValues(entity) as DefaultValues<TFormValues>);
    // toFormValues เป็น pure mapper — reset เฉพาะตอนเปิด/เปลี่ยน entity เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entity, form]);

  const onSubmit = (values: TFormValues) => {
    const payload = toPayload(values);

    if (isEdit && entity) {
      update.mutate(
        { id: entity.id, doc_version: entity.doc_version, ...payload },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            onOpenChange(false);
          },
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: (data) => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          onOpenChange(false);
          onCreated?.(data);
        },
      });
    }
  };

  const submitLabel = isPending
    ? isEdit
      ? tf("saving")
      : tf("creating")
    : isEdit
      ? tc("save")
      : tc("create");

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden border-0 bg-transparent p-0 shadow-2xl sm:max-w-[425px]",
          contentClassName,
        )}
        showCloseButton={false}
      >
        <div className="border-border/60 bg-popover/80 relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-3xl">
          <form
            onSubmit={
              stopPropagationOnSubmit
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit(onSubmit)(e);
                  }
                : form.handleSubmit(onSubmit)
            }
            className="relative flex flex-col"
          >
            <div className="border-border/40 bg-background/40 border-b px-6 py-6">
              <div className="flex items-center gap-4">
                <div className="text-primary bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <DialogTitle className="text-foreground text-xl font-bold tracking-tight">
                    {isEdit
                      ? tf("editTitle", { entity: t("entity") })
                      : tf("addTitle", { entity: t("entity") })}
                  </DialogTitle>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <FieldGroup className="gap-5">
                {children({ form, disabled: isPending || !!readOnly })}
              </FieldGroup>
            </div>

            <div className="border-border/40 bg-background/40 flex justify-end gap-3 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="rounded-xl"
              >
                {readOnly ? tc("close") : tc("cancel")}
              </Button>
              {!readOnly && (
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl font-bold shadow-lg backdrop-blur-md transition-all"
                >
                  {submitLabel}
                </Button>
              )}
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
