import { Clock, Tag } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { PersonAvatar } from "@/components/share/person-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBackendVersion } from "@/hooks/use-backend-version";
import { useProfile } from "@/hooks/use-profile";
import { useServerTime } from "@/hooks/use-server-time";
import { useWhatsNew } from "@/hooks/use-whats-new";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import {
  APP_BUILD_TIME,
  APP_COMMIT,
  APP_VERSION,
  BUILD_TIME_FORMAT,
} from "@/lib/version";

// Lazy: changelog.json (ยาวขึ้นเรื่อย ๆ ~57 รายการ/release) ต้องไม่ค้างอยู่ใน
// shared chunk ที่ทุกหน้าโหลด — loader ตัวนี้จะถูกเรียกก็ต่อเมื่อ dialog เปิด
// จริงเท่านั้น (ดู `shouldMount` ด้านล่าง) การ `lazy()` เฉย ๆ ไม่พอ เพราะถ้า
// render ตัว component ทุกครั้ง React จะเรียก loader ตั้งแต่ render แรก
const WhatsNewDialog = lazy(() =>
  import("./whats-new-dialog").then((m) => ({ default: m.WhatsNewDialog })),
);

/**
 * สีจุดสถานะรอบบัญชี — สัญญาณอยู่ที่จุดอย่างเดียว ตัวอักษรเป็นสีกลางเสมอ
 * (เหมือน `StatusDotBadge`) แต่แถบสูง 24px รับ chip เต็ม ๆ ไม่ไหว จึงเหลือแค่จุด
 *
 * `enum_period_status` ฝั่ง DB มี 3 ค่า แต่ `CurrentPeriod.status` เป็น `string`
 * เปล่า ๆ — ค่าที่ไม่รู้จักจึงตกไปที่จุดสีกลางแทนที่จะหายไปทั้งก้อน
 */
const PERIOD_STATUS_DOT: Record<string, string> = {
  open: "bg-success",
  locked: "bg-warning",
  closed: "bg-muted-foreground/50",
};

/**
 * แปลงรอบบัญชีเป็น `YYYY-MM` เพื่ออ่านออกโดยไม่ต้องแปลในหัว
 *
 * ฟิลด์ `period` ที่ backend เก็บเป็น `YYMM` (เช่น `2609`) ซึ่งกำกวมเกินไป
 * สำหรับป้ายที่ยืนอยู่ลำพัง จึงประกอบจาก `fiscal_year`/`fiscal_month` แทน
 *
 * @param period - รอบบัญชีปัจจุบันจาก profile
 * @returns สตริงรูปแบบ `YYYY-MM`
 */
function formatPeriodLabel(period: {
  fiscal_year: number;
  fiscal_month: number;
}): string {
  return `${period.fiscal_year}-${String(period.fiscal_month).padStart(2, "0")}`;
}

/**
 * Footer status bar
 *
 * Render `<footer role="contentinfo">` สูง h-6 แบ่งเป็นสองกลุ่มตามชนิดของข้อมูล
 * **ซ้าย = บริบทที่กำลังทำงานอยู่** (ชื่อผู้ใช้ · buCode · รอบบัญชีปัจจุบัน)
 * **ขวา = ข้อมูลระบบ** (เวลา server จาก `useServerTime` · เวอร์ชันแอปและ backend)
 * รอบบัญชีอยู่ฝั่งซ้ายเพราะมันตอบคำถามเดียวกับ buCode ว่า "ตอนนี้กำลังบันทึกลง
 * ที่ไหนของเวลาไหน" ส่วนเวอร์ชัน backend อยู่ฝั่งขวาเพราะเป็นข้อมูลบิลด์
 * ชุดเดียวกับเวอร์ชันแอป
 *
 * **รอบบัญชีไม่ต้องยิง request เพิ่ม** — `useProfile().currentPeriod` แบกมาให้แล้ว
 * จาก `/user/profile` ที่แถบนี้เรียกอยู่ก่อนแล้ว (ไม่ใช่ `/period-ends/current`
 * ซึ่งจะเป็นคำขอลูกที่สองของข้อมูลชุดเดียวกัน) แสดงรหัสรอบ + จุดสีสถานะ
 * ช่วงวันที่เต็มอยู่ใน tooltip
 *
 * **เวอร์ชัน backend fail-soft** — `useBackendVersion()` ยิง `GET /version` ที่
 * root ของ gateway ถ้า backend ยังเป็นรุ่นก่อนหน้า (404) ส่วนนี้หายไปเงียบ ๆ
 * แถบที่เหลือทำงานปกติ จึงปล่อย frontend ก่อน backend ได้
 *
 * เวอร์ชันแอป (`APP_VERSION`) ฉีดตอน build จาก `package.json` ชี้ที่ปุ่มเพื่อดู
 * commit/เวลา build ของ FE (และของ backend ถ้ามี) คลิกที่ปุ่ม
 * เพื่อเปิด What's New dialog และ dialog จะเด้งอัตโนมัติครั้งเดียวเมื่อมี
 * version ใหม่ (`useWhatsNew`) ใช้ `formatDate` ตาม `dateTimeFormat` จาก
 * profile ใส่ `suppressHydrationWarning` บน `<time>` รองรับ SSR/CSR mismatch
 *
 * `WhatsNewDialog` ถูก `lazy()` **และ** render เฉพาะตอนเปิดจริงเท่านั้น
 * (`shouldMount`) — `changelog.json` (ที่มันดึงมาแสดง) จึงอยู่ใน chunk แยก
 * (`changelog-*.js` ~27.7 kB gzip) ที่ browser ไม่ดึงเลยถ้าผู้ใช้ไม่เปิด dialog
 * ไม่ใช่แค่ย้ายออกจาก shared chunk แล้วโดน preload ตามมาทุกหน้าอยู่ดี
 *
 * ที่ต้องเป็น "เปิดครั้งแรกแล้วค้างไว้" (`everOpened` ไม่ใช่ `{open && …}`
 * เปล่า ๆ) เพราะ `DialogContent` มี exit animation
 * (`data-[state=closed]:animate-out`) ที่ Radix เล่นตอน `open` เป็น false —
 * ถ้า unmount พร้อมกันตอนปิด animation จะหายไป
 *
 * @returns JSX element ของ status bar
 * @example
 * ```tsx
 * // ใส่ใน root layout ใต้ main
 * <StatusBar />
 * ```
 */
export function StatusBar() {
  const {
    data: profile,
    aliasName,
    buCode,
    currentPeriod,
    avatarUrl,
    dateFormat,
    dateTimeFormat,
  } = useProfile();
  const { data: backend } = useBackendVersion();
  const now = useServerTime();
  const { shouldAutoOpen, markSeen } = useWhatsNew();
  const [manualOpen, setManualOpen] = useState(false);
  // เคยเปิดไปแล้วอย่างน้อยหนึ่งครั้ง → คง dialog ไว้ใน tree ต่อ ไม่ unmount
  // ตอนปิด (chunk โหลดมาแล้ว + ต้องให้ exit animation ของ Radix เล่นจนจบ)
  const [everOpened, setEverOpened] = useState(false);

  const whatsNewOpen = manualOpen || shouldAutoOpen;
  const shouldMount = whatsNewOpen || everOpened;

  const fullName = profile?.user_info
    ? `${profile.user_info.firstname ?? ""} ${profile.user_info.lastname ?? ""}`.trim()
    : "";
  const displayName = fullName || aliasName || "—";
  const formattedTime = now
    ? formatDate(now.toISOString(), dateTimeFormat)
    : "";
  const periodLabel = currentPeriod ? formatPeriodLabel(currentPeriod) : null;

  const handleOpenChange = (next: boolean) => {
    setManualOpen(next);
    setEverOpened(true);
    if (!next) markSeen();
  };

  return (
    <>
      <footer
        role="contentinfo"
        data-slot="status-bar"
        // `@container`: ของที่โชว์ในแถบตัดสินจาก **ความกว้างของแถบเอง** ไม่ใช่ของจอ —
        // แถบกว้างเท่าจอลบ sidebar ซึ่งพับ/กางได้ breakpoint ของจอ (`sm:`/`md:`) จึงเปิดของ
        // เพิ่มทั้งที่แถบยังไม่มีที่ เช่นจอ 768px แถบเหลือ ~705px แต่ `md:` เปิดทั้งป้าย
        // "Inventory period" เต็มและเวอร์ชัน API (~230px) จนสองฝั่งทับกัน
        // ลำดับที่ของโผล่เมื่อแถบกว้างขึ้น: เวลา + buCode + ป้าย "Period" (@md 448px) → commit hash
        // (@2xl 672px) → ป้าย "Inventory period" เต็ม + เวอร์ชัน API (@4xl 896px)
        className="bg-muted/40 text-muted-foreground text-micro @container flex h-6 shrink-0 items-center justify-between gap-3 border-t px-3"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <PersonAvatar
            fallback="icon"
            avatarUrl={avatarUrl}
            className="size-3 shrink-0"
            fallbackClassName="bg-transparent text-inherit"
            iconClassName="size-full"
          />
          <span className="truncate">{displayName}</span>
          {/* ซ่อน buCode เมื่อแถบแคบกว่า @md: แถบ 375px มีที่ไม่พอสำหรับทุกอย่าง และ buCode
              ยังอยู่บนตัวสลับ BU ที่ navbar ตลอดเวลา ต่างจากรอบบัญชีที่ไม่มีที่อื่น
              ให้ดูเลย — ถ้าปล่อยไว้ ชื่อผู้ใช้จะถูกบีบจนเหลือความกว้างศูนย์ */}
          {buCode && (
            <>
              <span
                aria-hidden="true"
                className="hidden shrink-0 opacity-50 @md:inline"
              >
                ·
              </span>
              <span className="hidden shrink-0 @md:inline">{buCode}</span>
            </>
          )}
          {currentPeriod && periodLabel && (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* tabIndex ทำให้ tooltip เปิดด้วยคีย์บอร์ดได้ และ aria-label พูด
                    สถานะออกมาเป็นคำ — จุดสีอย่างเดียวสื่อกับคนตาบอดสีไม่ได้ */}
                <span
                  tabIndex={0}
                  aria-label={`Inventory period ${periodLabel}, ${currentPeriod.status}`}
                  className="focus-visible:ring-ring ml-1.5 flex shrink-0 items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 rounded-full",
                      PERIOD_STATUS_DOT[currentPeriod.status] ??
                        "bg-muted-foreground/50",
                    )}
                  />
                  {/* ป้ายชื่อกำกับ: ตัวเลข `2026-09` ลอย ๆ ไม่บอกว่าเป็นรอบอะไร
                      ย่อลงตามที่ว่าง — เต็มที่ @4xl, เหลือ "Period" ที่ @md, และหายไป
                      ต่ำกว่านั้นเพราะบนจอ 375px ป้ายนี้กินที่จนชื่อผู้ใช้เหลือ 33px
                      (จุดสี + aria-label ยังบอกครบว่าคือรอบอะไร สถานะไหน) */}
                  <span className="text-muted-foreground/70 hidden @md:inline">
                    <span className="hidden @4xl:inline">Inventory period</span>
                    <span className="@4xl:hidden">Period</span>
                  </span>
                  <span className="tabular-nums">{periodLabel}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                <span className="tabular-nums">
                  {formatDate(currentPeriod.start_at, dateFormat)} –{" "}
                  {formatDate(currentPeriod.end_at, dateFormat)}
                </span>
                <span aria-hidden="true" className="opacity-50">
                  {" · "}
                </span>
                <span className="capitalize">{currentPeriod.status}</span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* เวลา server ซ่อนเมื่อแถบแคบกว่า @md (มือถือ): มันกิน ~125px จนชื่อผู้ใช้เหลือ
              37px ("Admi…") ทั้งที่เวลามีให้ดูบนเครื่องอยู่แล้ว ส่วนชื่อกับรอบบัญชีไม่มี */}
          <div className="hidden items-center gap-1.5 @md:flex">
            <Clock aria-hidden="true" className="h-3 w-3" />
            <time
              dateTime={now ? now.toISOString() : undefined}
              aria-live="off"
              suppressHydrationWarning
            >
              {formattedTime}
            </time>
          </div>
          <div className="flex items-center gap-1.5">
            {/* tooltip ผูกกับปุ่มเวอร์ชันแอป (ไม่ใช่ส่วน api) เพื่อให้ข้อมูลบิลด์ฝั่ง FE
                เปิดดูได้เสมอ แม้ backend ยังไม่มี `/version` — แถว API โผล่เมื่อดึงได้ */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  aria-label={`What's new — app version ${APP_VERSION}, build ${APP_COMMIT}`}
                  className="hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <Tag aria-hidden="true" className="h-3 w-3" />
                  <span className="font-mono tabular-nums">
                    <span className="opacity-70">App</span> v{APP_VERSION}
                    {/* commit hash อยู่ใน tooltip และ aria-label เสมอ — ในแถบโชว์เมื่อมีที่ */}
                    <span className="ml-2 hidden @2xl:inline">
                      {APP_COMMIT}
                    </span>
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="end">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  <dt className="text-muted-foreground">App</dt>
                  <dd className="tabular-nums">{APP_VERSION}</dd>
                  <dt className="text-muted-foreground">Build</dt>
                  <dd className="tabular-nums">{APP_COMMIT}</dd>
                  <dt className="text-muted-foreground">Built</dt>
                  <dd className="tabular-nums">
                    {formatDate(APP_BUILD_TIME, BUILD_TIME_FORMAT)}
                  </dd>
                  {backend && (
                    <>
                      <dt className="text-muted-foreground">API</dt>
                      <dd className="tabular-nums">{backend.version}</dd>
                      <dt className="text-muted-foreground">API build</dt>
                      <dd className="tabular-nums">{backend.commit}</dd>
                    </>
                  )}
                </dl>
              </TooltipContent>
            </Tooltip>
            {/* รูปแบบเดียวกับ `AppVersionLabel` ของหน้า auth: `App v… <commit> · API v<เต็ม>`
                เวลา build อยู่ใน tooltip — ซ่อน API เมื่อแถบแคบกว่า @4xl: สตริงเต็มยาว ~35 ตัว
                แถบ 24px บนจอแคบรับไม่ไหว และเป็นของที่ใช้ตอนแจ้งปัญหา ไม่ใช่ตอนทำงาน */}
            {backend && (
              <span className="hidden items-center gap-1.5 @4xl:flex">
                <span aria-hidden="true" className="opacity-50">
                  ·
                </span>
                <span className="font-mono tabular-nums">
                  <span className="opacity-70">API</span> v{backend.version}
                </span>
              </span>
            )}
          </div>
        </div>
      </footer>
      {shouldMount && (
        <Suspense fallback={null}>
          <WhatsNewDialog open={whatsNewOpen} onOpenChange={handleOpenChange} />
        </Suspense>
      )}
    </>
  );
}
