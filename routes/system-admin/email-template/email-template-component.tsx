import { useState } from "react";
import { Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { ListPageShell } from "@/components/share/list-page-shell";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { htmlToPlainText } from "@/lib/email-template";
import type { EmailTemplate } from "@/types/email-template";
import { EmailTemplateDialog } from "./email-template-dialog";

/**
 * หน้าตั้งค่าข้อความอีเมลของหน่วยธุรกิจ — สร้าง/แก้/ลบ และตั้งค่าเริ่มต้นต่อชนิดเอกสาร
 *
 * เก็บรวมเป็นอาเรย์เดียวใน app-config key `email_templates` (ไม่มี list endpoint
 * ไม่มี pagination) จึงใช้ตาราง HTML ธรรมดาเหมือนหน้าโปรไฟล์อีเมล
 *
 * ค่าเริ่มต้นแยกต่อชนิดเอกสาร — ตั้ง template ของ PO เป็นค่าเริ่มต้นไม่กระทบของ RFP
 */
export default function EmailTemplateComponent() {
  const t = useTranslations("systemAdmin.emailTemplate");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");

  const { value, isLoading, isError, save, isSaving } = useEmailTemplates();
  const { templates, defaults } = value;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleSave = (template: EmailTemplate) => {
    const isEdit = templates.some((x) => x.id === template.id);
    // ส่งทั้งชุดเสมอ — save เขียนทับ value ทั้งก้อน ไม่ใช่ partial update
    const nextTemplates = isEdit
      ? templates.map((x) => (x.id === template.id ? template : x))
      : [...templates, template];

    // ตัวแรกของชนิดเอกสารนั้น → เป็นค่าเริ่มต้นให้อัตโนมัติ
    const sameType = nextTemplates.filter(
      (x) => x.doc_type === template.doc_type,
    );
    const nextDefaults = { ...defaults };
    if (!defaults[template.doc_type] && sameType.length >= 1) {
      nextDefaults[template.doc_type] = sameType[0].id;
    }

    save(
      { defaults: nextDefaults, templates: nextTemplates },
      {
        onSuccess: () => {
          toast.success(
            isEdit
              ? tt("updateSuccess", { entity: t("entity") })
              : tt("createSuccess", { entity: t("entity") }),
          );
          setDialogOpen(false);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const nextTemplates = templates.filter((x) => x.id !== deleteTarget.id);
    const nextDefaults = { ...defaults };
    if (defaults[deleteTarget.doc_type] === deleteTarget.id) {
      // ตัวที่เป็นค่าเริ่มต้นถูกลบ → เลื่อนให้ตัวที่เหลือของชนิดเดียวกันตัวแรก
      // (ไม่มีเหลือ = ไม่มีค่าเริ่มต้น dialog ส่งเอกสารจะให้เลือกเอง)
      nextDefaults[deleteTarget.doc_type] =
        nextTemplates.find((x) => x.doc_type === deleteTarget.doc_type)?.id ??
        null;
    }

    save(
      { defaults: nextDefaults, templates: nextTemplates },
      {
        onSuccess: () => {
          toast.success(tt("deleteSuccess", { entity: t("entity") }));
          setDeleteTarget(null);
        },
      },
    );
  };

  const handleSetDefault = (template: EmailTemplate) => {
    save(
      {
        defaults: { ...defaults, [template.doc_type]: template.id },
        templates,
      },
      {
        onSuccess: () =>
          toast.success(t("setDefaultSuccess", { name: template.name })),
      },
    );
  };

  // ชิ้นส่วนของหนึ่งข้อความ — ใช้ทั้งในตาราง (กล่องกว้าง) และรายการแบบซ้อน (กล่องแคบ)
  const rows = templates.map((template) => {
    const isDefault = defaults[template.doc_type] === template.id;
    return {
      template,
      isDefault,
      subject:
        template.subject_template || htmlToPlainText(template.body_template),
      status: (
        <Badge variant={template.enabled ? "default" : "secondary"}>
          {template.enabled ? t("statusEnabled") : t("statusDisabled")}
        </Badge>
      ),
      actions: (
        <div className="flex items-center justify-end gap-1">
          {!isDefault && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleSetDefault(template)}
              disabled={isSaving}
            >
              <Star className="size-3" aria-hidden="true" />
              {t("setDefault")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              setEditing(template);
              setDialogOpen(true);
            }}
            aria-label={tc("edit")}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setDeleteTarget(template)}
            aria-label={tc("delete")}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    };
  });

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      actions={
        !isError && !isLoading ? (
          <DocumentListActions
            onAdd={openAdd}
            addLabel={t("add")}
            hideExportPrint
          />
        ) : undefined
      }
    >
      {isError && <ErrorState message={t("loadError")} />}

      {!isError && isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!isError && !isLoading && templates.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      )}

      {!isError && !isLoading && templates.length > 0 && (
        // `@container`: ตาราง ↔ รายการแบบซ้อน ตัดสินจากความกว้างของกล่องนี้ ไม่ใช่ของจอ
        // (skill carmen-blue-ui-design — แบบเดียวกับหน้า email-profile)
        <div className="@container">
          {/* กล่องแคบ (มือถือ): ซ้อนเป็นรายการ — ตาราง 5 คอลัมน์กว้างขั้นต่ำ ~890px ต้องเลื่อนแนวนอนในกรอบ
              และปุ่มของแถวหลุดไปนอกจอ */}
          <ul className="bg-card divide-y rounded-lg border @4xl:hidden">
            {rows.map(({ template, isDefault, subject, status, actions }) => (
              <li key={template.id} className="space-y-1.5 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{template.name}</span>
                  {isDefault && (
                    <Badge variant="success-light" size="xs">
                      {t("defaultBadge")}
                    </Badge>
                  )}
                </div>
                {template.note && (
                  <p className="text-muted-foreground line-clamp-2">
                    {template.note}
                  </p>
                )}
                <p>
                  {t(`docType.${template.doc_type}`)}
                  <span aria-hidden="true" className="text-muted-foreground">
                    {" · "}
                  </span>
                  <span className="text-muted-foreground break-words">
                    {subject}
                  </span>
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {status}
                  {actions}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border @4xl:block">
            <table className="w-full text-xs">
              {/* ชื่อ เอกสาร สถานะ และปุ่ม กว้างเท่าเนื้อหา (`w-px` + nowrap) · หัวเรื่องเป็นข้อความยาว
                  จึงเป็นคอลัมน์เดียวที่ยืดหด: รับที่เหลือและตัดด้วย … เมื่อไม่พอ (`max-w-0` ทำให้เซลล์
                  ไม่ดันตารางให้กว้างตามข้อความ) เดิมห้าคอลัมน์แบ่งที่เหลือกันเอง ชื่อกับเอกสารจึงห่างกัน
                  เป็นคืบบนจอกว้าง ส่วนที่ 1366px หัวเรื่องถูกจำกัดไว้ 256px ทั้งที่มีที่ */}
              <thead className="bg-muted border-b">
                <tr>
                  <th className="h-9 w-px px-3 pr-10 text-left font-medium whitespace-nowrap">
                    {t("table.name")}
                  </th>
                  <th className="h-9 w-px px-3 pr-10 text-left font-medium whitespace-nowrap">
                    {t("table.docType")}
                  </th>
                  <th className="h-9 min-w-40 px-3 pr-10 text-left font-medium">
                    {t("table.subject")}
                  </th>
                  <th className="h-9 w-px px-3 pr-10 text-left font-medium whitespace-nowrap">
                    {t("table.status")}
                  </th>
                  <th className="h-9 w-px px-3 text-right font-medium whitespace-nowrap">
                    {tc("rowActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(
                  ({ template, isDefault, subject, status, actions }) => (
                    <tr key={template.id} className="border-b last:border-0">
                      <td className="px-3 py-2 pr-10 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{template.name}</span>
                          {isDefault && (
                            <Badge variant="success-light" size="xs">
                              {t("defaultBadge")}
                            </Badge>
                          )}
                        </div>
                        {template.note && (
                          <p
                            className="text-muted-foreground mt-0.5 max-w-xs truncate"
                            title={template.note}
                          >
                            {template.note}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 pr-10 whitespace-nowrap">
                        {t(`docType.${template.doc_type}`)}
                      </td>
                      <td className="text-muted-foreground w-full max-w-0 px-3 py-2 pr-10">
                        <span className="block truncate" title={subject}>
                          {subject}
                        </span>
                      </td>
                      <td className="px-3 py-2 pr-10 whitespace-nowrap">
                        {status}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{actions}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EmailTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !isSaving && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={isSaving}
        onConfirm={handleDelete}
      />
    </ListPageShell>
  );
}
