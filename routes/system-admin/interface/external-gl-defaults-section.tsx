import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useState,
  type Ref,
} from "react";
import { useTranslations } from "use-intl";
import { SettingSection } from "@/components/ui/setting-section";
import { Field, FieldLabel } from "@/components/ui/field";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { useInterfaceConfig } from "./use-interface-config";

/** key ของ app-config ที่เก็บบัญชีตั้งต้นของ BU (ไม่ใช่ key ของ interface) */
export const GL_SETTING_KEY = "gl_setting";

/**
 * backend บังคับ `fiscal_year_start_month` (1–12, ไม่มี default) — BU ที่ยังไม่เคยมี
 * `gl_setting` (404) จึงต้องส่งค่านี้ไปด้วยตอนสร้างครั้งแรก 1 = ปีบัญชีเริ่มมกราคม
 */
const DEFAULT_FISCAL_YEAR_START_MONTH = 1;

/** สิ่งที่ฟอร์มแม่ใช้คุมส่วนนี้ — ส่วนนี้ถือ state เอง แต่ปุ่ม Save/Cancel เป็นของฟอร์มแม่ */
export type GlDefaultsHandle = {
  readonly isDirty: boolean;
  /** บันทึกเฉพาะเมื่อมีการแก้ — ถ้าไม่แก้เรียก onSuccess ทันที */
  readonly save: (onSuccess: () => void) => void;
  readonly reset: () => void;
};

type GlDefaultsBinding = {
  readonly handleRef: Ref<GlDefaultsHandle>;
  /** แจ้งฟอร์มแม่เมื่อ isDirty เปลี่ยน — ref ไม่ trigger render จึงต้องมีช่องนี้ให้ nav guard เห็น */
  readonly onDirtyChange: (dirty: boolean) => void;
};

const GlDefaultsHandleContext = createContext<GlDefaultsBinding | null>(null);

export const GlDefaultsHandleProvider = GlDefaultsHandleContext.Provider;

type Accounts = {
  readonly ap: string | null;
  readonly vat: string | null;
};

function readAccounts(value: Record<string, unknown> | undefined): Accounts {
  const ap = value?.ap_control_account_id;
  const vat = value?.input_vat_account_id;
  return {
    ap: typeof ap === "string" && ap ? ap : null,
    vat: typeof vat === "string" && vat ? vat : null,
  };
}

/**
 * ส่วน "บัญชีตั้งต้น" ของ interface External — บัญชีเจ้าหนี้ (AP control) และบัญชีภาษีซื้อ
 * ที่ระบบใช้เมื่อผังการผูกบัญชียังไม่ได้ระบุเอง (source `bu_default` ในหน้า mapping)
 *
 * อ่าน/เขียน key `gl_setting` ของ BU ซึ่งมีฟิลด์อื่นอีกมาก (เดือนเริ่มปีบัญชี, prefix JV,
 * บัญชี WHT ฯลฯ) และ PUT **แทนที่ทั้งก้อน** — save จึง spread ค่าปัจจุบันทั้งหมดแล้วทับ
 * เฉพาะสองฟิลด์นี้ ห้ามส่งแค่สองฟิลด์ไม่งั้นฟิลด์อื่นหายหมด
 *
 * ล้างช่อง = ตัด key ออกจากก้อน (zod ฝั่ง backend เป็น `.uuid().optional()` ไม่รับ null)
 *
 * ถือ state เอง ไม่รับ props — ฟอร์มแม่ผูกเข้ากับปุ่ม Save/Cancel ของ layout ผ่าน
 * `GlDefaultsHandleProvider` (ref ที่ expose isDirty/save/reset)
 *
 * @returns React element ของส่วนบัญชีตั้งต้น
 */
export function ExternalGlDefaultsSection() {
  const t = useTranslations("systemAdmin.interface.accounting.external");
  const binding = useContext(GlDefaultsHandleContext);
  const { value, isLoading, isError, refetch, save } =
    useInterfaceConfig(GL_SETTING_KEY);

  const saved = readAccounts(value);
  const [draft, setDraft] = useState<Accounts>(saved);

  // sync เมื่อโหลดเสร็จ/บันทึกแล้ว refetch กลับมา (กับ DEFAULT ฟอร์มแม่ที่ reset หลัง save)
  useEffect(() => {
    setDraft(readAccounts(value));
  }, [value]);

  const isDirty = draft.ap !== saved.ap || draft.vat !== saved.vat;

  const onDirtyChange = binding?.onDirtyChange;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useImperativeHandle(
    binding?.handleRef,
    () => ({
      isDirty,
      reset: () => setDraft(saved),
      save: (onSuccess) => {
        if (!isDirty) {
          onSuccess();
          return;
        }
        const next: Record<string, unknown> = { ...value };
        delete next.ap_control_account_id;
        delete next.input_vat_account_id;
        if (draft.ap) next.ap_control_account_id = draft.ap;
        if (draft.vat) next.input_vat_account_id = draft.vat;
        if (!value) {
          // ยังไม่เคยมี gl_setting (404) — schema บังคับฟิลด์นี้
          next.fiscal_year_start_month = DEFAULT_FISCAL_YEAR_START_MONTH;
        }
        save(next, { onSuccess });
      },
    }),
    [isDirty, saved.ap, saved.vat, draft, value, save],
  );

  return (
    <SettingSection
      title={t("glDefaults")}
      description={t("glDefaultsDesc")}
    >
      {isError ? (
        <div className="flex items-center gap-3 sm:col-span-2">
          <p className="text-destructive text-sm">{t("glLoadError")}</p>
          <button
            type="button"
            className="text-sm underline"
            onClick={refetch}
          >
            {t("retry")}
          </button>
        </div>
      ) : (
        <>
          <Field>
            <FieldLabel>{t("apControlAccount")}</FieldLabel>
            <LookupChartOfAccountById
              value={draft.ap}
              disabled={isLoading}
              onValueChange={(ap) => setDraft((d) => ({ ...d, ap }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t("inputVatAccount")}</FieldLabel>
            <LookupChartOfAccountById
              value={draft.vat}
              disabled={isLoading}
              onValueChange={(vat) => setDraft((d) => ({ ...d, vat }))}
            />
          </Field>
        </>
      )}
    </SettingSection>
  );
}
