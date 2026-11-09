import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { useTranslations } from "use-intl";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProfile } from "@/hooks/use-profile";
import { useSwitchBu } from "@/hooks/use-switch-bu";
import type { BusinessUnit } from "@/types/profile";
import { qrRecordPath } from "./qr-record-path";

/** ชื่อ BU แบบเดียวกับตัวเลือก BU บน navbar — "ชื่อย่อ - ชื่อ" */
function buLabel(bu: Pick<BusinessUnit, "alias_name" | "name">): string {
  return bu.alias_name ? `${bu.alias_name} - ${bu.name}` : bu.name;
}

/**
 * ปลายทางของ QR บนเอกสารที่พิมพ์ใบเดียว — `/qr/<type>/<id>?bu=<bu_code>`
 *
 * ยังไม่ login: `RequireAuth` พาไป `/login?next=` แล้วกลับมาที่นี่เอง (มือถือที่สแกนส่วนใหญ่ยังไม่ login)
 *
 * - QR ไม่รู้จัก (ชนิด / id ผิด) → แจ้งว่า QR นี้ไม่ได้ชี้ไปที่เอกสารในระบบ
 * - เอกสารอยู่ใน BU ปัจจุบัน (หรือ QR ไม่ได้บอก BU) → ไปหน้าเอกสารเลย
 * - อยู่ใน BU อื่นที่บัญชีเป็นสมาชิก → ถามก่อนสลับ เพราะการสลับ BU ตั้งค่า BU หลักของบัญชีฝั่ง server
 *   มีผลกับทุกเครื่องที่ login อยู่ ไม่ใช่แค่แท็บนี้ · ยกเลิก = ไปหน้า dashboard
 * - BU ที่บัญชีไม่ได้เป็นสมาชิก → แจ้งว่าเปิดไม่ได้ (ไปหน้าเอกสารใน BU ปัจจุบันก็จะเจอ "ไม่พบ")
 *
 * ไม่ผ่าน bu-switcher บน navbar เพราะตัวนั้นพากลับ /dashboard หลังสลับ — ที่นี่ต้องไปหน้าเอกสาร
 */
export default function QrRedirect() {
  const t = useTranslations("qrLink");
  const navigate = useNavigate();
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const { data: profile, defaultBu } = useProfile();
  const switchBu = useSwitchBu();

  const path = qrRecordPath(type, id);
  if (!path) return <ErrorState notFoundMessage={t("invalidLink")} />;

  const buCode = searchParams.get("bu");
  const target = buCode
    ? profile?.business_unit.find((b) => b.code === buCode)
    : undefined;
  if (buCode && !target) {
    return <ErrorState notFoundMessage={t("noAccess", { bu: buCode })} />;
  }
  if (!target || target.code === defaultBu?.code) {
    return <Navigate to={path} replace />;
  }

  const switchAndOpen = async () => {
    try {
      await switchBu.mutateAsync(target.id);
      navigate(path, { replace: true });
    } catch {
      // MutationCache กลาง toast ให้แล้ว — คง dialog ไว้ให้ลองใหม่หรือยกเลิก
    }
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) navigate("/dashboard", { replace: true });
      }}
      title={t("switchTitle")}
      description={t("switchDescription", {
        target: buLabel(target),
        current: defaultBu ? buLabel(defaultBu) : "-",
      })}
      confirmText={t("switchAndOpen")}
      onConfirm={() => void switchAndOpen()}
      isPending={switchBu.isPending}
    />
  );
}
