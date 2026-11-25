import { useState } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Loader2, Mail, Send, Settings, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useEmailSenders } from "@/hooks/use-email-senders";
import { useEmailMessages } from "@/hooks/use-email-messages";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import {
  EMAIL_PLACEHOLDERS,
  fillTemplate,
  htmlToPlainText,
  plainTextToHtml,
  templatesForDocType,
} from "@/lib/email-template";
import type { EmailSender } from "@/hooks/use-email-senders";
import type { EmailTemplate } from "@/types/email-template";
import { useRfpSendEmail } from "./use-rfp-send-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * รายการอีเมลแบบ chip — พิมพ์แล้วกด Enter/เพิ่ม เพื่อเติม กด × ที่ chip เพื่อลบ
 *
 * เขียนซ้ำกับของ `po-send-email-dialog.tsx` โดยตั้งใจ — สองไฟล์อยู่คนละโมดูล
 * (`procurement` / `vendor-management`) ซึ่ง ESLint ห้ามอ้างข้ามกัน วันที่ RFP
 * ส่งอีเมลจากระบบได้จริง ค่อยยกตัวนี้ไป `components/` ให้ทั้งคู่ใช้ร่วมกัน
 */
function EmailChipField({
  id,
  value,
  onChange,
  placeholder,
}: {
  readonly id: string;
  readonly value: string[];
  readonly onChange: (next: string[]) => void;
  readonly placeholder: string;
}) {
  const t = useTranslations("vendorManagement.requestPriceList.sendEmail");
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
            if (e.key !== "Enter") return;
            e.preventDefault();
            commit();
          }}
          placeholder={placeholder}
          aria-invalid={!!error}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={commit}
          disabled={!draft.trim()}
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
                onClick={() => onChange(value.filter((e) => e !== email))}
                className="hover:bg-muted rounded-sm p-0.5"
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

interface RfpSendEmailDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** ไม่มี id = คำขอยังไม่ถูกบันทึก ส่งไม่ได้ (ปุ่มส่งปิดพร้อมบอกเหตุผล) */
  readonly rfpId?: string;
  readonly vendorId?: string;
  readonly vendorName: string;
  readonly vendorEmail?: string | null;
  readonly contactPerson?: string | null;
  readonly rfpName: string;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly vendorUrl: string;
}

/**
 * Dialog ส่งคำขอรายการราคาให้ผู้ขาย
 *
 * ทรงเดียวกับ `po-send-email-dialog.tsx` ต่างกันสามอย่าง: ไม่มีตัวเลือกแนบไฟล์
 * (คำขอราคาไม่มี PDF ให้แนบ สิ่งที่ผู้ขายต้องได้คือลิงก์กรอกราคาซึ่งอยู่ในเนื้อความ),
 * ส่งได้ทีละผู้ขายหนึ่งราย (ลิงก์เป็นของผู้ขายรายนั้น ส่งรวมไม่ได้), และคำขอที่ยัง
 * ไม่ถูกบันทึกจะไม่มี `rfpId` ให้ยิง — ปุ่มส่งปิดพร้อมบอกเหตุผลแทนที่จะได้ 404
 *
 * ข้อความตั้งต้นมาจากคลัง `email_templates` (ชนิด `rfp`) ถ้า BU ยังไม่ได้ตั้งไว้
 * จึงตกไปใช้ข้อความมาตรฐานจากไฟล์แปลเหมือนเดิม
 */
export function RfpSendEmailDialog({
  open,
  onOpenChange,
  rfpId,
  vendorId,
  vendorName,
  vendorEmail,
  contactPerson,
  rfpName,
  startDate,
  endDate,
  vendorUrl,
}: RfpSendEmailDialogProps) {
  const t = useTranslations("vendorManagement.requestPriceList.sendEmail");
  const tc = useTranslations("common");
  const { defaultBu, dateFormat } = useProfile();
  const {
    value: emailProfiles,
    isLoading: profilesLoading,
    isError,
  } = useEmailSenders();
  const { value: emailTemplates, isLoading: templatesLoading } =
    useEmailMessages();
  const sendEmail = useRfpSendEmail(rfpId ?? "");

  const isLoading = profilesLoading || templatesLoading;
  const enabledProfiles = emailProfiles.profiles.filter((p) => p.enabled);
  const hasNoProfiles = !isLoading && (isError || enabledProfiles.length === 0);
  const rfpTemplates = templatesForDocType(emailTemplates, "rfp");

  const placeholderValues = {
    rfp_name: rfpName,
    vendor_name: vendorName,
    contact_person: contactPerson ?? "",
    bu_name: defaultBu?.name ?? "",
    start_date: startDate ? formatDate(startDate, dateFormat) : "",
    end_date: endDate ? formatDate(endDate, dateFormat) : "",
    portal_url: vendorUrl,
  };

  const defaultTemplate =
    rfpTemplates.find((x) => x.id === emailTemplates.defaults.rfp) ??
    rfpTemplates[0];

  // ผู้เรียก mount dialog เฉพาะตอนเปิด (ดู VendorActionsCell) — ค่าตั้งต้นจึงทำ
  // ตอน mount ได้เลย ไม่ต้องมี effect คอยเติมค่าเมื่อ `open` เปลี่ยน
  const [to, setTo] = useState<string[]>(vendorEmail ? [vendorEmail] : []);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [toError, setToError] = useState(false);

  /**
   * หัวเรื่อง/เนื้อความตั้งต้นของ template หนึ่งอัน — ไม่มี template ในคลัง
   * จึงใช้ข้อความมาตรฐานจากไฟล์แปล (พฤติกรรมเดิมก่อนมี `email_templates`)
   */
  const subjectFrom = (template?: EmailTemplate) =>
    template
      ? fillTemplate(
          template.subject_template,
          placeholderValues,
          "text",
          "rfp",
        )
      : t("defaultSubject", { name: rfpName });

  const bodyFrom = (template?: EmailTemplate) =>
    template
      ? fillTemplate(template.body_template, placeholderValues, "html", "rfp")
      : plainTextToHtml(
          t("defaultBody", {
            vendor: vendorName,
            name: rfpName,
            url: vendorUrl,
          }),
        );

  // โปรไฟล์กับ CC มาจากข้อมูลที่โหลดทีหลัง — เก็บเฉพาะ "ค่าที่ผู้ใช้เลือกเอง"
  // แล้วค่อยตกไปใช้ค่าตั้งต้นตอน render แทนการ setState ใน effect ซึ่งจะทำให้
  // render ซ้อนกันเป็นทอด ๆ
  const [pickedProfileId, setPickedProfileId] = useState<string | null>(null);
  const [pickedCc, setPickedCc] = useState<string[] | null>(null);

  const selectedTemplate =
    rfpTemplates.find((x) => x.id === templateId) ?? defaultTemplate;
  // หัวเรื่อง/เนื้อความยึดจาก template จนกว่าผู้ใช้จะพิมพ์ทับ — เก็บเฉพาะสิ่งที่
  // ผู้ใช้แก้เอง แล้วตกไปใช้ค่าจาก template ตอน render (แทน setState ใน effect)
  const currentSubject = subject ?? subjectFrom(selectedTemplate);
  const currentBody = body ?? bodyFrom(selectedTemplate);

  const defaultProfile =
    enabledProfiles.find((p) => p.id === emailProfiles.default_profile_id) ??
    enabledProfiles[0];
  const profileId = pickedProfileId ?? defaultProfile?.id ?? "";
  // CC ตั้งต้นมาจากข้อความที่เลือกในคลังเท่านั้น — โปรไฟล์ผู้ส่งไม่ถือ CC ประจำแล้ว
  const cc = pickedCc ?? selectedTemplate?.default_cc ?? [];

  /**
   * สลับข้อความสำเร็จรูป — ทับหัวเรื่อง/เนื้อความที่ยังไม่ได้แก้เองเท่านั้น
   * (`subject`/`body` เป็น null ตราบใดที่ผู้ใช้ยังไม่พิมพ์ทับ)
   */
  const handleTemplateChange = (nextId: string) => {
    setTemplateId(nextId);
    const template = rfpTemplates.find((x) => x.id === nextId);
    if (template?.default_cc?.length) setPickedCc(template.default_cc);
  };

  const handleSend = () => {
    if (!rfpId) return;
    // backend บังคับ subject/body ห้ามว่าง (RequestForPricingSendEmailSchema) —
    // เช็คที่นี่ด้วย ไม่งั้นข้อความที่ถูกลบจนหมดจะได้ 400 ที่ไม่บอกว่าช่องไหนว่าง
    // เนื้อความเป็น HTML แล้ว `<p></p>` ที่ตัวแก้ไขทิ้งไว้จึงไม่นับว่ามีเนื้อหา
    const hasSubject = currentSubject.trim().length > 0;
    const hasBody = htmlToPlainText(currentBody).length > 0;
    if (to.length === 0 || !hasSubject || !hasBody) {
      setToError(to.length === 0);
      if (!hasSubject || !hasBody) toast.error(t("subjectBodyRequired"));
      return;
    }
    sendEmail.mutate(
      {
        profile_id: profileId,
        to,
        cc,
        subject: currentSubject,
        body: currentBody,
        ...(vendorId && { vendor_id: vendorId }),
      },
      {
        onSuccess: (response) => {
          // gateway ห่อผลลัพธ์ไว้ใต้ `data` เสมอ และ 200 ไม่ได้แปลว่าถึงผู้รับ
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && sendEmail.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 gap-1 px-5 pt-5 pr-12 pb-4">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Mail className="size-4" aria-hidden="true" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("desc", { vendor: vendorName, name: rfpName })}
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
              <p className="text-muted-foreground text-sm">
                {isError ? t("loadError") : t("noProfiles")}
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
                <FieldLabel htmlFor="rse-profile">{t("profile")}</FieldLabel>
                <Select value={profileId} onValueChange={setPickedProfileId}>
                  <SelectTrigger id="rse-profile" className="w-full">
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

              {rfpTemplates.length > 0 && (
                <Field>
                  <FieldLabel htmlFor="rse-template">
                    {t("template")}
                  </FieldLabel>
                  <Select
                    value={selectedTemplate?.id ?? ""}
                    onValueChange={handleTemplateChange}
                  >
                    <SelectTrigger id="rse-template" className="w-full">
                      <SelectValue placeholder={t("templatePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {rfpTemplates.map((template: EmailTemplate) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field data-invalid={toError}>
                <FieldLabel htmlFor="rse-to" required>
                  {t("to")}
                </FieldLabel>
                <EmailChipField
                  id="rse-to"
                  value={to}
                  onChange={(next) => {
                    setTo(next);
                    if (next.length > 0) setToError(false);
                  }}
                  placeholder={t("toPlaceholder")}
                />
                {toError && <FieldError>{t("toRequired")}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="rse-cc">{t("cc")}</FieldLabel>
                <EmailChipField
                  id="rse-cc"
                  value={cc}
                  onChange={setPickedCc}
                  placeholder={t("ccPlaceholder")}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="rse-subject">{t("subject")}</FieldLabel>
                <Input
                  id="rse-subject"
                  value={currentSubject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sendEmail.isPending}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="rse-body">{t("body")}</FieldLabel>
                {/* ลิงก์กรอกราคาอยู่ในเนื้อความที่เดียว — ผู้ใช้ย้ายหรือตัดได้
                    สิ่งที่เห็นตรงนี้คือสิ่งที่ถูกส่งออกไปจริง */}
                <RichTextEditor
                  id="rse-body"
                  value={currentBody}
                  onChange={setBody}
                  placeholders={EMAIL_PLACEHOLDERS.rfp}
                  placeholderLabel={t("insertVariable")}
                  disabled={sendEmail.isPending}
                />
              </Field>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={sendEmail.isPending}
          >
            {tc("cancel")}
          </Button>
          {!isLoading && !hasNoProfiles && (
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              // คำขอที่ยังไม่ถูกบันทึกไม่มี id ให้ยิง — บอกเหตุผลแทนการปล่อยให้ได้ 404
              disabled={!rfpId || !profileId || sendEmail.isPending}
              title={rfpId ? undefined : t("unsavedRfp")}
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
