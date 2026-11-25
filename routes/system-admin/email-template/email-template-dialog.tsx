import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { Eye, PencilLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EMAIL_PLACEHOLDERS,
  EMAIL_PLACEHOLDER_SAMPLES,
  fillTemplate,
  sanitizeEmailHtml,
} from "@/lib/email-template";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import {
  EMAIL_DOC_TYPES,
  type EmailDocType,
  type EmailTemplate,
} from "@/types/email-template";
import {
  emailTemplateSchema,
  fromEmailTemplateFormValues,
  toEmailTemplateFormValues,
  type EmailTemplateFormValues,
} from "./email-template-schema";

interface EmailTemplateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly template?: EmailTemplate | null;
  readonly onSave: (template: EmailTemplate) => void;
  readonly isSaving: boolean;
}

/**
 * Dialog สร้าง/แก้ไขข้อความอีเมลหนึ่งรายการ
 *
 * เหมือน `email-profile-dialog` ตรงที่ **ไม่ถือ `templates[]` ทั้งชุด** — คืนรายการเดียว
 * ผ่าน `onSave` ให้หน้า list ประกอบเข้าอาเรย์เดิมก่อนบันทึก (save เขียนทับทั้งก้อน)
 *
 * ชนิดเอกสารคุมรายการตัวแปรที่แทรกได้และค่าตัวอย่างในพรีวิว — เปลี่ยนชนิดแล้ว
 * ตัวแปรของชนิดเดิมที่ค้างอยู่ในข้อความจะไม่ถูกแทนค่า (เห็นได้ทันทีในพรีวิว)
 */
export function EmailTemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
  isSaving,
}: EmailTemplateDialogProps) {
  const isEdit = !!template;
  const t = useTranslations("systemAdmin.emailTemplate");
  const tc = useTranslations("common");
  const tf = useTranslations("form");

  const [previewing, setPreviewing] = useState(false);

  const form = useForm<EmailTemplateFormValues>({
    resolver: zodResolver(
      emailTemplateSchema,
    ) as Resolver<EmailTemplateFormValues>,
    defaultValues: toEmailTemplateFormValues(),
  });

  useEffect(() => {
    if (open) {
      form.reset(toEmailTemplateFormValues(template ?? undefined));
      setPreviewing(false);
    }
  }, [open, template, form]);

  const submit = form.handleSubmit(
    (values) =>
      onSave(fromEmailTemplateFormValues(values, template ?? undefined)),
    () => scrollToFirstInvalidField(),
  );

  const docType = form.watch("doc_type") as EmailDocType;
  const enabled = form.watch("enabled");
  const bodyTemplate = form.watch("body_template");
  const subjectTemplate = form.watch("subject_template");
  const placeholders = EMAIL_PLACEHOLDERS[docType];
  const samples = EMAIL_PLACEHOLDER_SAMPLES[docType];

  return (
    <Dialog open={open} onOpenChange={isSaving ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        {/* หัว/ท้ายอยู่กับที่ เลื่อนเฉพาะฟอร์มตรงกลาง — ตัวแก้ไขเนื้อหาสูงจน
            ปุ่มบันทึกเลื่อนหายถ้าปล่อยให้ทั้งกล่องเลื่อนด้วยกัน */}
        <DialogHeader className="shrink-0 gap-1 px-5 pt-5 pr-12 pb-4">
          <DialogTitle className="text-sm">
            {isEdit
              ? tf("editTitle", { entity: t("entity") })
              : tf("addTitle", { entity: t("entity") })}
          </DialogTitle>
          {/* บริบทที่เลื่อนหายไปกับฟอร์ม: ชนิดเอกสารและสถานะของรายการนี้ */}
          <DialogDescription className="text-xs">
            {t(`docType.${docType}`)}
            <span aria-hidden="true"> · </span>
            {enabled ? t("statusEnabled") : t("statusDisabled")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <FieldGroup className="min-h-0 flex-1 gap-3 overflow-y-auto border-y px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="et-name" required>
                  {t("dialog.templateName")}
                </FieldLabel>
                <Input
                  id="et-name"
                  {...form.register("name")}
                  aria-invalid={!!form.formState.errors.name}
                />
                {form.formState.errors.name && (
                  <FieldError>{tc("required")}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="et-doc-type" required>
                  {t("dialog.docType")}
                </FieldLabel>
                <Select
                  value={docType}
                  onValueChange={(v) =>
                    form.setValue("doc_type", v as EmailDocType, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="et-doc-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_DOC_TYPES.map((dt) => (
                      <SelectItem key={dt} value={dt}>
                        {t(`docType.${dt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field data-invalid={!!form.formState.errors.subject_template}>
              <FieldLabel htmlFor="et-subject" required>
                {t("dialog.subject")}
              </FieldLabel>
              <Input
                id="et-subject"
                {...form.register("subject_template")}
                aria-invalid={!!form.formState.errors.subject_template}
                placeholder={t("dialog.subjectPlaceholder")}
              />
              {/* หัวเรื่องไม่มีตัวแก้ไขจึงไม่มีเมนูแทรกตัวแปรในตัว — วางชิปไว้ใต้ช่อง
                  ให้กดแล้วต่อท้ายได้ (ข้อความแปลใส่ {{ }} ไม่ได้ ICU จะอ่านเป็น argument) */}
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-muted-foreground text-micro">
                  {t("dialog.insertIntoSubject")}
                </span>
                {placeholders.map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    size="xs"
                    className="text-micro-legal h-5 px-1.5 font-mono"
                    onClick={() =>
                      form.setValue(
                        "subject_template",
                        `${subjectTemplate}{{${key}}}`,
                        { shouldDirty: true },
                      )
                    }
                  >
                    {`{{${key}}}`}
                  </Button>
                ))}
              </div>
              {form.formState.errors.subject_template && (
                <FieldError>{tc("required")}</FieldError>
              )}
            </Field>

            <Field data-invalid={!!form.formState.errors.body_template}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="et-body" required>
                  {t("dialog.body")}
                </FieldLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setPreviewing((p) => !p)}
                >
                  {previewing ? (
                    <PencilLine className="size-3" aria-hidden="true" />
                  ) : (
                    <Eye className="size-3" aria-hidden="true" />
                  )}
                  {previewing ? t("dialog.backToEdit") : t("dialog.preview")}
                </Button>
              </div>

              {previewing ? (
                <div className="rounded-md border">
                  <div className="text-muted-foreground border-b px-3 py-2 text-xs">
                    <span className="font-medium">{t("dialog.subject")}: </span>
                    {fillTemplate(subjectTemplate, samples, "text", docType)}
                  </div>
                  {/* เนื้อหาผ่าน sanitizeEmailHtml มาแล้วทั้งตอนพิมพ์และตอนโหลด —
                      พรีวิวจึงแสดงสิ่งเดียวกับที่จะถูกส่งออกไปจริง */}
                  <div
                    className="px-3 py-2 text-xs [&_a]:underline [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeEmailHtml(
                        fillTemplate(bodyTemplate, samples, "html", docType),
                      ),
                    }}
                  />
                </div>
              ) : (
                <RichTextEditor
                  id="et-body"
                  value={bodyTemplate}
                  onChange={(html) =>
                    form.setValue("body_template", html, { shouldDirty: true })
                  }
                  placeholders={placeholders}
                  placeholderLabel={t("dialog.insertVariable")}
                  ariaInvalid={!!form.formState.errors.body_template}
                  disabled={isSaving}
                />
              )}
              {form.formState.errors.body_template && (
                <FieldError>{tc("required")}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="et-cc">{t("dialog.defaultCc")}</FieldLabel>
              <Input
                id="et-cc"
                {...form.register("default_cc")}
                placeholder={t("dialog.defaultCcPlaceholder")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="et-note">{t("dialog.note")}</FieldLabel>
              <Textarea id="et-note" rows={2} {...form.register("note")} />
            </Field>

            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={enabled}
                onCheckedChange={(v) =>
                  form.setValue("enabled", v === true, { shouldDirty: true })
                }
              />
              {t("dialog.enabled")}
            </label>
          </FieldGroup>

          <DialogFooter className="shrink-0 gap-2 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
