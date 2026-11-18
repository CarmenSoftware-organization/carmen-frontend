import {
  Line,
  VIZ_ACCENT,
  VIZ_WRAP,
} from "@/components/share/landing/landing-viz";

/*
 * ภาพประกอบการ์ดของ landing รายงาน — เส้นล้วน ไม่มีชื่อรายงาน เวลา หรือจำนวนแถวแต่ง
 * (skill `carmen-blue-ui-design` §Landing pages ข้อ 7) แต่ละภาพวาดเรื่องเดียวกับหน้าของมัน:
 * รายการรายงานที่กดรันได้ · ตารางสัปดาห์ของรายงานที่รันเอง · เส้นเวลาของรายงานที่รันไปแล้ว
 */

const PANEL = "bg-card border-border rounded-sm border";

/* ผสมสีใน oklab ไม่ใช่ oklch — oklch หมุน hue ระหว่าง primary (น้ำเงิน) กับพื้นการ์ดที่เกือบเทา
   ใน dark mode จึงได้สีม่วงแดง oklab ผสมเป็นเส้นตรง ไม่ผ่าน hue อื่น */

/** Report List — แถวรายงาน: ไอคอนเอกสาร + ชื่อ + ปุ่มรัน */
export function ReportListViz() {
  const rows = ["72%", "58%", "50%"];
  return (
    <div className={VIZ_WRAP}>
      <div className={`${PANEL} px-1.5 py-1`}>
        {rows.map((w, i) => (
          <div
            key={w}
            className={`flex items-center gap-1.5 px-1 py-1.5 ${
              i === rows.length - 1 ? "" : "border-border-subtle border-b"
            }`}
          >
            <span className="bg-card border-muted-foreground block h-3 w-2.5 shrink-0 rounded-[1px] border" />
            <div className="min-w-0 flex-1">
              <Line w={w} strong={i === 0} />
            </div>
            <span
              className="block h-2.5 w-5 shrink-0 rounded-sm"
              style={{
                background:
                  i === 0
                    ? VIZ_ACCENT
                    : "color-mix(in oklab, var(--primary), var(--card) 80%)",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Schedules — สัปดาห์ 7 ช่อง บางวันมีรายงานที่ตั้งให้รันเอง */
export function ReportScheduleViz() {
  // จำนวนรายการต่อวัน (จันทร์–อาทิตย์) — เป็นรูปทรง ไม่ใช่ข้อมูล
  const perDay = [2, 1, 1, 0, 1, 0, 1];
  return (
    <div className={VIZ_WRAP}>
      <div className={`${PANEL} grid grid-cols-7 gap-1 p-1.5`}>
        {perDay.map((n, d) => (
          <div key={`day-${d}`} className="flex min-h-14 flex-col gap-1">
            <span className="bg-muted-foreground/30 mb-0.5 block h-1 rounded-full" />
            {Array.from({ length: n }, (_, i) => (
              <span
                key={`slot-${i}`}
                className="block h-3.5 rounded-[2px]"
                style={{
                  background:
                    "color-mix(in oklab, var(--primary), var(--card) 85%)",
                  borderLeft: `2px solid ${VIZ_ACCENT}`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** History — เส้นเวลา: จุดบนสุดกำลังรัน (วงแหวน) ที่เหลือรันจบแล้ว */
export function ReportHistoryViz() {
  const rows = ["64%", "52%", "70%", "46%"];
  return (
    <div className={VIZ_WRAP}>
      <div className={`${PANEL} relative py-1 pr-1.5 pl-5`}>
        <span
          aria-hidden
          className="bg-border absolute top-2.5 bottom-2.5 left-2.5 w-px"
        />
        {rows.map((w, i) => (
          <div key={w} className="relative flex items-center gap-1.5 py-1.5">
            <span
              className="bg-card absolute -left-3.5 block size-2 rounded-full border-2"
              style={{
                borderColor: i === 0 ? VIZ_ACCENT : "var(--muted-foreground)",
                boxShadow:
                  i === 0
                    ? "0 0 0 2px color-mix(in oklab, var(--primary), transparent 80%)"
                    : undefined,
              }}
            />
            <span className="w-5 shrink-0">
              <Line w="100%" />
            </span>
            <div className="min-w-0 flex-1">
              <Line w={w} strong={i === 0} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
