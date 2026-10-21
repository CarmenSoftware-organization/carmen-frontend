import { useTranslations } from "use-intl";
import { Hotel, ShieldCheck, Sparkles, Zap } from "lucide-react";
import brandingLightUrl from "@/components/icons/carmen-branding-light.svg";
import brandingDarkUrl from "@/components/icons/carmen-branding-dark.svg";
import { LocaleToggle } from "@/components/locale-toggle";
import { AppVersionLabel } from "@/components/app-version-label";

/**
 * โครงหน้า auth แบบแบ่งครึ่ง — ซ้ายเป็นการ์ดฟอร์ม ขวาเป็น hero (ซ่อนบนจอเล็ก)
 * ใช้ร่วมกันระหว่าง `/login` กับ `/register` เพื่อให้สองหน้านี้เป็นหน้าเดียวกัน
 * ในสายตาผู้ใช้ ตัวฟอร์มส่งเข้ามาเป็น children
 */
export function AuthSplitShell({
  title,
  subtitle,
  children,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly children: React.ReactNode;
}) {
  const t = useTranslations("auth");

  return (
    <div className="bg-background relative isolate min-h-svh overflow-hidden">
      {/* Inline keyframes — subtle entrance motion only */}
      <style>{`
        @keyframes title-reveal {
          0% { opacity: 0; transform: translateY(0.75rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-up-soft {
          0% { opacity: 0; transform: translateY(0.5rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* สลับภาษาได้ก่อน login — หน้านี้อยู่นอก app shell จึงไม่มีเมนูผู้ใช้ให้เปลี่ยน */}
      <LocaleToggle className="absolute top-3 right-3 z-20 sm:top-4 sm:right-4" />

      {/* ── 50/50 split ──────────────────────────────────── */}
      <div className="relative grid min-h-svh lg:grid-cols-2">
        {/* ╔══ LEFT — Form ═══════════════════════════════════════╗ */}
        <div className="flex items-center justify-center px-5 py-6 sm:px-8">
          <div
            className="w-full max-w-md"
            style={{ animation: "fade-up-soft 0.6s ease-out 0.1s both" }}
          >
            {/* Mobile-only branding */}
            <div className="mb-5 lg:hidden">
              <BrandMark size="sm" />
            </div>

            {/* Card */}
            <div className="bg-card rounded-2xl border p-5 sm:p-6">
              <h1
                className="mt-2 text-2xl leading-[1.05] font-semibold tracking-tight sm:text-[1.75rem]"
                style={{ animation: "title-reveal 0.7s ease-out 0.2s both" }}
              >
                {title}
              </h1>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {subtitle}
              </p>
              {children}
            </div>

            {/* เวอร์ชันแอป + API ใต้การ์ด — ทุกหน้า auth ได้ไปด้วย ไว้ให้ผู้ใช้
                อ่านบอกตอนแจ้งปัญหาทั้งที่ยังเข้าระบบไม่ได้ */}
            <AppVersionLabel className="mt-4" />
          </div>
        </div>

        {/* ╔══ RIGHT — Cinematic hero ═══════════════════════════ */}
        <div className="relative hidden items-center overflow-hidden lg:flex">
          <div
            className="relative w-full px-10 py-8 xl:px-14"
            style={{ animation: "fade-up-soft 0.7s ease-out 0.2s both" }}
          >
            {/* Brand */}
            <div className="flex items-center gap-3">
              <BrandMark size="lg" />
            </div>

            {/* Cinematic headline — compact */}
            <h2
              className="mt-6 max-w-[24ch] text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.03em] xl:text-[2.75rem]"
              style={{ animation: "title-reveal 0.9s ease-out 0.35s both" }}
            >
              {t("heroHeadlineStart")}{" "}
              <span className="text-primary">{t("heroHeadlineEmphasis")}</span>
            </h2>

            <p
              className="text-muted-foreground/90 mt-3 max-w-md text-[0.8125rem] leading-relaxed"
              style={{ animation: "fade-up-soft 0.7s ease-out 0.5s both" }}
            >
              {t("heroDescription")}
            </p>

            {/* Bento feature grid — compact */}
            <div
              className="mt-5 grid grid-cols-2 gap-2"
              style={{ animation: "fade-up-soft 0.7s ease-out 0.7s both" }}
            >
              <BentoCard
                icon={Zap}
                title={t("features.liveStockTitle")}
                desc={t("features.liveStockDesc")}
              />
              <BentoCard
                icon={ShieldCheck}
                title={t("features.roleAwareTitle")}
                desc={t("features.roleAwareDesc")}
              />
              <BentoCard
                icon={Hotel}
                title={t("features.multiPropertyTitle")}
                desc={t("features.multiPropertyDesc")}
              />
              <BentoCard
                icon={Sparkles}
                title={t("features.hospitalityTitle")}
                desc={t("features.hospitalityDesc")}
              />
            </div>

            {/* Tagline footer */}
            <div
              className="mt-6 flex items-center gap-2"
              style={{ animation: "fade-up-soft 0.7s ease-out 0.9s both" }}
            >
              <div className="bg-primary size-1 rounded-full" />
              <p className="text-muted-foreground text-micro font-semibold tracking-wide italic">
                {t("letsBegin")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-muted-foreground/40 text-micro-legal pointer-events-none absolute right-0 bottom-2 left-0 z-10 text-center">
        {t("platformFooter")}
      </p>
    </div>
  );
}

/* ── Brand atoms ─────────────────────────────────────── */

function BrandMark({ size = "sm" }: { readonly size?: "sm" | "lg" }) {
  return (
    <>
      <img
        src={brandingLightUrl}
        alt="Carmen Blue"
        className={`${size === "lg" ? "h-18 w-auto" : "h-7 w-auto"} dark:hidden`}
      />
      <img
        src={brandingDarkUrl}
        alt="Carmen Blue"
        className={`${size === "lg" ? "h-18 w-auto" : "h-7 w-auto"} hidden dark:block`}
      />
    </>
  );
}

/* ── Bento card for feature grid ────────────────────── */

function BentoCard({
  icon: Icon,
  title,
  desc,
}: {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly title: string;
  readonly desc: string;
}) {
  return (
    <div className="border-border bg-card hover:border-primary/40 rounded-xl border p-3 transition-colors">
      <div className="bg-primary/10 text-primary mb-2 flex size-7 items-center justify-center rounded-lg">
        <Icon className="size-3.5" />
      </div>
      <div className="text-foreground text-xs font-semibold tracking-tight">
        {title}
      </div>
      <p className="text-muted-foreground text-micro mt-0.5 leading-snug">
        {desc}
      </p>
    </div>
  );
}
