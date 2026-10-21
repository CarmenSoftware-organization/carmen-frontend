import { AppVersionLabel } from "@/components/app-version-label";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import brandingLightUrl from "@/components/icons/carmen-branding-light.svg";
import brandingDarkUrl from "@/components/icons/carmen-branding-dark.svg";
import { EyeBrow } from "@/components/ui/eye-brow";
import { LocaleToggle } from "@/components/locale-toggle";
import type { LegalDocument } from "./legal-content";

/**
 * โครงหน้าเอกสารกฎหมาย ใช้ร่วมกันระหว่าง /terms กับ /privacy
 *
 * public ทั้งคู่ — คนที่ยังไม่ได้ login ต้องอ่านได้ก่อนกดสมัคร และหน้าพวกนี้อยู่
 * นอก app shell จึงพกปุ่มสลับภาษามาเอง (เอกสารกฎหมายที่อ่านไม่ออกไม่มีประโยชน์)
 *
 * ความกว้างถูกล็อกไว้ที่ ~68ch ซึ่งสวนทางกับ docs/DESIGN.md ที่ให้เนื้อหาไหลเต็ม
 * viewport — กฎนั้นมีไว้เพื่อตาราง ERP ที่ยิ่งกว้างยิ่งอ่านง่าย ส่วนหน้านี้เป็น
 * ข้อความยาวล้วน บรรทัดที่ยาวเกิน measure ทำให้สายตาหาบรรทัดถัดไปไม่เจอ
 */
export function LegalPage({
  document,
  crossTo,
}: {
  readonly document: LegalDocument;
  readonly crossTo: "/terms" | "/privacy";
}) {
  return (
    <div className="bg-background min-h-svh">
      <LegalHeader />

      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[13rem_1fr] lg:py-14">
        <TableOfContents document={document} />

        <article className="max-w-[68ch]">
          <EyeBrow>{document.eyebrow}</EyeBrow>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {document.title}
          </h1>
          <p className="text-muted-foreground text-micro-legal mt-2">
            {document.effective}
          </p>
          <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
            {document.intro}
          </p>

          <div className="mt-8 space-y-8">
            {document.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24"
              >
                <h2 className="text-foreground text-base font-semibold tracking-tight">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((text) => (
                  <p
                    key={text}
                    className="text-muted-foreground mt-3 text-sm leading-relaxed"
                  >
                    {text}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="text-muted-foreground marker:text-muted-foreground/40 mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                    {section.bullets.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <LegalFooter document={document} crossTo={crossTo} />
        </article>
      </main>

      <AppVersionLabel className="px-6 pb-6" />
    </div>
  );
}

function LegalHeader() {
  return (
    <header className="border-border/60 border-b">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
        <Link to="/login" className="shrink-0">
          <img
            src={brandingLightUrl}
            alt="Carmen Blue"
            className="h-7 w-auto dark:hidden"
          />
          <img
            src={brandingDarkUrl}
            alt="Carmen Blue"
            className="hidden h-7 w-auto dark:block"
          />
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <LocaleToggle />
          <Link
            to="/login"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">CARMEN BLUE</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function TableOfContents({ document }: { readonly document: LegalDocument }) {
  return (
    <nav className="hidden lg:block" aria-label={document.tocLabel}>
      <div className="sticky top-14">
        <EyeBrow className="mb-3">{document.tocLabel}</EyeBrow>
        <ul className="space-y-2">
          {document.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-muted-foreground hover:text-primary block text-xs leading-snug transition-colors"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function LegalFooter({
  document,
  crossTo,
}: {
  readonly document: LegalDocument;
  readonly crossTo: "/terms" | "/privacy";
}) {
  return (
    <div className="border-border/60 mt-12 border-t pt-6">
      <Link
        to={crossTo}
        className="text-primary group inline-flex items-center gap-1.5 text-xs font-semibold underline-offset-4 hover:underline"
      >
        {document.crossLink}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
