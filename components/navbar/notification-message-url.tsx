import { useTranslations } from "use-intl";
import { CopyButton } from "@/components/ui/copy-button";
import { safeNavigationHref } from "@/lib/utils";

/**
 * URL ในข้อความแจ้งเตือน (เช่นลิงก์รายงานจาก schedule) — ลิงก์เปิดแท็บใหม่ + ปุ่มคัดลอก
 *
 * ลิงก์ viewer ยาวเกินกว่าจะลากเลือกเองได้สะดวก จึงมีปุ่มคัดลอกข้าง ๆ และให้ตัดบรรทัดได้ทุกตัวอักษร
 * ไม่ดันขอบ dialog · URL ที่ไม่ปลอดภัย (ไม่ใช่ http/https) แสดงเป็นข้อความธรรมดา
 *
 * @param props.href - URL ดิบจากข้อความ
 * @returns ลิงก์พร้อมปุ่มคัดลอก
 */
export function NotificationMessageUrl({ href }: { readonly href: string }) {
  const t = useTranslations("notifications");
  const safe = safeNavigationHref(href);
  if (!safe || !/^https?:\/\//i.test(safe)) return <>{href}</>;
  return (
    <span className="inline-flex max-w-full items-start gap-1.5 align-top whitespace-normal">
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:text-primary/80 font-medium break-all underline underline-offset-2"
      >
        {safe}
      </a>
      <CopyButton
        value={safe}
        label={t("copyLink")}
        successMessage={t("linkCopied")}
        className="shrink-0"
      />
    </span>
  );
}
