import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Loader2, Mail, Send, Settings, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { useProfile } from "@/hooks/use-profile";
import { useEmailSenders } from "@/hooks/use-email-senders";
import { useEmailMessages } from "@/hooks/use-email-messages";
import { useVendorById } from "@/hooks/use-vendor";
import {
  EMAIL_PLACEHOLDERS,
  fillTemplate,
  htmlToPlainText,
  templatesForDocType,
} from "@/lib/email-template";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import type { EmailSender } from "@/hooks/use-email-senders";
import type { EmailTemplate } from "@/types/email-template";
import type { PurchaseOrder } from "@/types/purchase-order";
import { usePoSendEmail } from "./use-po-send-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PoSendEmailDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly purchaseOrder: PurchaseOrder;
}

/**
 * รายการอีเมลแบบ chip — พิมพ์แล้วกด Enter/Add เพื่อเติม กด × ที่ chip เพื่อลบ
 *
 * ใช้ร่วมกันทั้งช่อง To และ CC — validate รูปแบบอีเมลเบื้องต้นฝั่ง client เท่านั้น
 * (ชั้นที่ตัดสินจริงคือ backend ตอน parse ที่อยู่แต่ละรายการ)
 */
function EmailChipField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  readonly id: string;
  readonly value: string[];
  readonly onChange: (next: string[]) => void;
  readonly placeholder: string;
  readonly disabled?: boolean;
}) {
  const t = useTranslations("procurement.purchaseOrder.sendEmail");
  const tv = useTranslations("validation");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const email = draft.trim();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setError(tv("invalidEmail"));
      return;
    }
    if (value.some((e) => e.toLowerCase() === email.toLowerCase())) {
      setError(t("duplicateEmail"));
      return;
    }
    onChange([...value, email]);
    setDraft("");
    setError(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Input
          id={id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={commit}
          disabled={disabled || !draft.trim()}
        >
          {t("add")}
        </Button>
      </div>
      {error && <FieldError>{error}</FieldError>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((email) => (
            <Badge
              key={email}
              variant="outline"
              className="gap-1 py-0.5 pr-1 font-normal"
            >
              <span className="max-w-56 truncate">{email}</span>
              <button
                type="button"
                aria-label={t("remove", { email })}
                disabled={disabled}
                onClick={() => onChange(value.filter((e) => e !== email))}
                className="hover:bg-muted rounded-sm p-0.5 disabled:pointer-events-none"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Dialog เลือกโปรไฟล์ผู้ส่ง แก้ผู้รับ/หัวเรื่อง/ข้อความ แล้วส่งใบสั่งซื้อ (พร้อม PDF)
 * ให้ผู้ขายทางอีเมล
 *
 * - ไม่มีโปรไฟล์ที่เปิดใช้งานเลย → แสดงข้อความ + ลิงก์ไปหน้าตั้งค่า ไม่มีปุ่มส่งให้กด
 * - Subject/Body/CC ตั้งต้นจากข้อความที่เลือกในคลัง (`email_templates`) แทน placeholder
 *   ด้วยค่าจริงของ PO — ผู้ใช้แก้ช่องไหนแล้ว สลับข้อความจะไม่ทับช่องนั้นอีก (เก็บ dirty flag
 *   แยกต่อช่องผ่าน ref ไม่ใช้ `formState.isDirty` เพราะฟอร์มนี้ไม่ได้ใช้ react-hook-form)
 * - โปรไฟล์ผู้ส่งคุมแค่ "ส่งจากใคร/ผ่าน SMTP ไหน" เท่านั้น สลับโปรไฟล์จึงไม่แตะหัวเรื่อง
 *   เนื้อความ หรือ CC
 * - ส่งเสร็จอ่าน `sent`/`rejected` เสมอ — ไม่ปิด dialog ถ้าส่งไม่ถึงผู้รับบางคน/ทั้งหมด
 *   ให้ผู้ใช้เห็นค่าที่กรอกไว้และลองใหม่ได้ทันที
 */
export function PoSendEmailDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: PoSendEmailDialogProps) {
  const t = useTranslations("procurement.purchaseOrder.sendEmail");
  const tc = useTranslations("common");
  const { defaultBu, dateFormat } = useProfile();
  const {
    value: emailProfiles,
    isLoading: profilesLoading,
    isError: profilesError,
  } = useEmailSenders();
  const { value: emailTemplates, isLoading: templatesLoading } =
    useEmailMessages();
  const vendorQuery = useVendorById(purchaseOrder.vendor?.id ?? "");
  const sendEmail = usePoSendEmail(purchaseOrder.id);

  const enabledProfiles = emailProfiles.profiles.filter((p) => p.enabled);
  // คลังข้อความว่าง = ไม่ใช่ข้อผิดพลาด — หัวเรื่อง/เนื้อความเริ่มจากช่องว่างให้ผู้ใช้พิมพ์เอง
  const poTemplates = templatesForDocType(emailTemplates, "po");
  const isLoading =
    profilesLoading || templatesLoading || vendorQuery.isLoading;
  const hasNoProfiles =
    !isLoading && (profilesError || enabledProfiles.length === 0);

  const [profileId, setProfileId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [toError, setToError] = useState(false);
  const [subjectError, setSubjectError] = useState(false);
  const [bodyError, setBodyError] = useState(false);
  const isSubjectDirtyRef = useRef(false);
  const isBodyDirtyRef = useRef(false);
  const initializedRef = useRef(false);

  const placeholderValues = {
    po_no: purchaseOrder.po_no,
    vendor_name: purchaseOrder.vendor?.name ?? "",
    bu_name: defaultBu?.name ?? "",
    total:
      purchaseOrder.total_amount != null
        ? `${formatCurrency(purchaseOrder.total_amount)} ${purchaseOrder.currency?.code ?? ""}`.trim()
        : "",
    delivery_date: purchaseOrder.delivery_date
      ? formatDate(purchaseOrder.delivery_date, dateFormat)
      : "",
  };

  /**
   * หัวเรื่อง/เนื้อความตั้งต้นมาจากคลังข้อความ (`email_templates`) ทางเดียว —
   * โปรไฟล์ผู้ส่งไม่ถือเทมเพลตอีกแล้ว คลังว่าง = เริ่มจากช่องว่างให้ผู้ใช้พิมพ์เอง
   */
  const subjectFrom = (template?: EmailTemplate) =>
    fillTemplate(
      template?.subject_template ?? "",
      placeholderValues,
      "text",
      "po",
    );

  const bodyFrom = (template?: EmailTemplate) =>
    fillTemplate(
      template?.body_template ?? "",
      placeholderValues,
      "html",
      "po",
    );

  // เติมค่าตั้งต้นครั้งเดียวต่อการเปิด dialog หนึ่งรอบ — รอทั้งโปรไฟล์และผู้ขายโหลด
  // เสร็จก่อน (ไม่งั้น "To" จะว่างเพราะยังไม่รู้อีเมลผู้ขาย) ปิดแล้วเปิดใหม่ = เริ่มนับหนึ่งใหม่
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current || isLoading) return;
    initializedRef.current = true;

    const defaultId =
      enabledProfiles.find((p) => p.id === emailProfiles.default_profile_id)
        ?.id ??
      enabledProfiles[0]?.id ??
      "";

    const contacts = vendorQuery.data?.vendor_contact ?? [];
    const vendorEmail =
      contacts.find((c) => c.is_primary)?.email || contacts[0]?.email || "";

    const template =
      poTemplates.find((x) => x.id === emailTemplates.defaults.po) ??
      poTemplates[0];

    setProfileId(defaultId);
    setTemplateId(template?.id ?? "");
    setTo(vendorEmail ? [vendorEmail] : []);
    setCc(template?.default_cc ?? []);
    setSubject(subjectFrom(template));
    setBody(bodyFrom(template));
    setAttachPdf(true);
    setToError(false);
    setSubjectError(false);
    setBodyError(false);
    isSubjectDirtyRef.current = false;
    isBodyDirtyRef.current = false;
    // placeholderValues ไม่ใส่ใน deps โดยตั้งใจ — เป็น object ใหม่ทุก render, ค่าจริงมาจาก
    // purchaseOrder/defaultBu/dateFormat ซึ่งไม่เปลี่ยนระหว่าง dialog เปิดอยู่ (PoForm
    // ใช้ key={purchaseOrder.id} ทำให้เปลี่ยน PO = component นี้ remount ทั้งก้อนอยู่แล้ว)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    isLoading,
    enabledProfiles,
    emailProfiles.default_profile_id,
    emailTemplates,
    vendorQuery.data,
  ]);

  /**
   * เลือกข้อความจากคลัง — ทับหัวเรื่อง/เนื้อความที่ผู้ใช้ยังไม่ได้แก้เองเท่านั้น
   * (แก้แล้วแปลว่าตั้งใจเขียนของใบนี้ ไม่ควรโดนกลืนเพราะเผลอสลับ dropdown)
   */
  const handleTemplateChange = (nextId: string) => {
    setTemplateId(nextId);
    const template = poTemplates.find((x) => x.id === nextId);
    if (!template) return;
    if (template.default_cc?.length) setCc(template.default_cc);
    if (!isSubjectDirtyRef.current) setSubject(subjectFrom(template));
    if (!isBodyDirtyRef.current) setBody(bodyFrom(template));
  };

  const handleClose = (next: boolean) => {
    if (!next && sendEmail.isPending) return;
    onOpenChange(next);
  };

  const handleSend = () => {
    // A BU with no email message in the store starts with an empty subject/body, while the
    // backend's send-email DTO requires both non-empty (purchase-order.send-email.dto.ts,
    // subject/body: z.string().min(1)). Without this check the first user to hit that gap sees
    // a 400 with no explanation of which field is empty. Checked here, not just "to", for the
    // same reason "to" is checked: a genuine send attempt should never reach the backend
    // already known to fail.
    // BU ที่ยังไม่มีข้อความในคลัง = หัวเรื่อง/เนื้อความเริ่มจากว่าง แต่ backend บังคับทั้งคู่
    // ห้ามว่าง ถ้าไม่เช็คตรงนี้ผู้ใช้คนแรกที่เจอช่องว่างนี้จะได้ 400 โดยไม่รู้ว่าช่องไหนว่าง
    // จึงเช็คเหมือนที่เช็ค "to" อยู่แล้ว
    const trimmedSubject = subject.trim();
    // เนื้อความเป็น HTML แล้ว — `<p></p>` ที่ตัวแก้ไขทิ้งไว้ไม่ใช่เนื้อหา
    const hasSubjectError = trimmedSubject.length === 0;
    const hasBodyError = htmlToPlainText(body).length === 0;
    if (to.length === 0 || hasSubjectError || hasBodyError) {
      setToError(to.length === 0);
      setSubjectError(hasSubjectError);
      setBodyError(hasBodyError);
      return;
    }
    sendEmail.mutate(
      {
        profile_id: profileId,
        to,
        cc,
        subject,
        body,
        attach_pdf: attachPdf,
      },
      {
        onSuccess: (response) => {
          // gateway ห่อผลลัพธ์ไว้ใต้ `data` เสมอ — อ่านระดับบนสุดจะได้ undefined
          // แล้วขึ้น "ส่งไม่สำเร็จ" ทั้งที่ผู้ขายได้รับเมลไปแล้ว
          const result = response.data;
          if (!result?.sent) {
            toast.error(t("sendFailed"));
            return;
          }
          if (result.rejected && result.rejected.length > 0) {
            toast.warning(
              t("sendPartial", { emails: result.rejected.join(", ") }),
            );
            return;
          }
          toast.success(t("sendSuccess"));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 gap-1 px-5 pt-5 pr-12 pb-4">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Mail className="size-4" aria-hidden="true" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("desc", { poNo: purchaseOrder.po_no })}
          </DialogDescription>
        </DialogHeader>

        {/* หัว/ท้ายอยู่กับที่ เลื่อนเฉพาะเนื้อหาตรงกลาง — รายชื่อผู้รับกับข้อความ
            ยาวจนปุ่มส่งเลื่อนหายถ้าปล่อยให้ทั้งกล่องเลื่อนด้วยกัน */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto border-y px-5 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2
                className="text-muted-foreground size-5 animate-spin"
                aria-hidden="true"
              />
            </div>
          )}

          {!isLoading && hasNoProfiles && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Settings
                className="text-muted-foreground size-8"
                aria-hidden="true"
              />
              <p className="text-muted-foreground text-xs">
                {profilesError ? t("loadError") : t("noProfiles")}
              </p>
              <Button asChild size="sm" variant="outline">
                <Link to="/system-admin/email-profile">
                  {t("goToSettings")}
                </Link>
              </Button>
            </div>
          )}

          {!isLoading && !hasNoProfiles && (
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="pse-profile" required>
                  {t("profile")}
                </FieldLabel>
                <Select value={profileId} onValueChange={setProfileId}>
                  <SelectTrigger id="pse-profile" className="w-full">
                    <SelectValue placeholder={t("profilePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledProfiles.map((profile: EmailSender) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {poTemplates.length > 0 && (
                <Field>
                  <FieldLabel htmlFor="pse-template">
                    {t("template")}
                  </FieldLabel>
                  <Select
                    value={templateId}
                    onValueChange={handleTemplateChange}
                  >
                    <SelectTrigger id="pse-template" className="w-full">
                      <SelectValue placeholder={t("templatePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {poTemplates.map((template: EmailTemplate) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field data-invalid={toError}>
                <FieldLabel htmlFor="pse-to" required>
                  {t("to")}
                </FieldLabel>
                <EmailChipField
                  id="pse-to"
                  value={to}
                  onChange={(next) => {
                    setTo(next);
                    if (next.length > 0) setToError(false);
                  }}
                  placeholder={t("toPlaceholder")}
                  disabled={sendEmail.isPending}
                />
                {toError && <FieldError>{t("toRequired")}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="pse-cc">{t("cc")}</FieldLabel>
                <EmailChipField
                  id="pse-cc"
                  value={cc}
                  onChange={setCc}
                  placeholder={t("ccPlaceholder")}
                  disabled={sendEmail.isPending}
                />
              </Field>

              <Field data-invalid={subjectError}>
                <FieldLabel htmlFor="pse-subject" required>
                  {t("subject")}
                </FieldLabel>
                <Input
                  id="pse-subject"
                  value={subject}
                  onChange={(e) => {
                    isSubjectDirtyRef.current = true;
                    setSubject(e.target.value);
                    if (e.target.value.trim().length > 0)
                      setSubjectError(false);
                  }}
                  aria-invalid={subjectError}
                  disabled={sendEmail.isPending}
                />
                {subjectError && (
                  <FieldError>{t("subjectRequired")}</FieldError>
                )}
              </Field>

              <Field data-invalid={bodyError}>
                <FieldLabel htmlFor="pse-body" required>
                  {t("body")}
                </FieldLabel>
                <RichTextEditor
                  id="pse-body"
                  value={body}
                  onChange={(html) => {
                    isBodyDirtyRef.current = true;
                    setBody(html);
                    if (htmlToPlainText(html).length > 0) setBodyError(false);
                  }}
                  placeholders={EMAIL_PLACEHOLDERS.po}
                  placeholderLabel={t("insertVariable")}
                  ariaInvalid={bodyError}
                  disabled={sendEmail.isPending}
                />
                {bodyError && <FieldError>{t("bodyRequired")}</FieldError>}
              </Field>

              <Field orientation="horizontal">
                <Checkbox
                  id="pse-attach-pdf"
                  checked={attachPdf}
                  onCheckedChange={(v) => setAttachPdf(v === true)}
                  disabled={sendEmail.isPending}
                />
                <FieldLabel htmlFor="pse-attach-pdf">
                  {t("attachPdf")}
                </FieldLabel>
              </Field>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleClose(false)}
            disabled={sendEmail.isPending}
          >
            {tc("cancel")}
          </Button>
          {!isLoading && !hasNoProfiles && (
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={sendEmail.isPending || !profileId}
            >
              {sendEmail.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {sendEmail.isPending ? t("sending") : t("send")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
