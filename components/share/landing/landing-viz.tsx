/**
 * ตัวช่วยวาดภาพประกอบของการ์ด landing — เส้นแทนข้อความ ไม่มีชื่อ เลข หรือเวลาแต่ง
 * (skill `carmen-blue-ui-design` §Landing pages ข้อ 7) ใช้ร่วมระหว่างโมดูล
 */

/** กรอบของภาพในแถบหัวการ์ด — เว้นซ้าย 44px ให้ไอคอนที่ `LandingCard` วางทับมุม */
export const VIZ_WRAP =
  "absolute inset-0 flex flex-col justify-end px-2 pt-2 pb-2 pl-11";

/**
 * สีเดียวที่ภาพจำลองใช้ได้ — docs/DESIGN.md: "no second brand color exists"
 * การ์ดแยกกันด้วยไอคอน ชื่อ และตัวภาพ ไม่ใช่สี
 */
export const VIZ_ACCENT = "var(--primary)";

/** เส้นแทนบรรทัดข้อความ — ภาพจำลองของหน้าที่เพิ่มทีหลังไม่ใส่ตัวเลขหรือชื่อสมมติ (ดูเหมือนข้อมูลจริง) */
export function Line({
  w,
  strong,
}: {
  readonly w: string;
  readonly strong?: boolean;
}) {
  return (
    <span
      className={`block h-1.5 rounded-full ${strong ? "bg-foreground/60" : "bg-muted-foreground/30"}`}
      style={{ width: w }}
    />
  );
}

/**
 * แถวรายการของภาพจำลอง: จุดหน้าแถว + เส้นแทนข้อความ + ป้ายท้ายแถว
 *
 * ใช้กับหน้าที่เป็นรายการ (ผู้ใช้ ไฟล์ การเข้า–ออกระบบ ประวัติการแก้ไข) — เดิมแต่ละภาพใส่ชื่อคน
 * เลขที่เอกสาร และเวลาสมมติ ("A. Chen", "PO-12480", "2m ago") ซึ่งอ่านเป็นข้อมูลจริงได้
 * ป้ายท้ายแถวเป็นคำทั่วไปของหน้านั้น (ชื่อบทบาท ชนิดไฟล์ ชนิดการกระทำ) ไม่ใช่ข้อมูล
 */
export function ListViz({
  rows,
  dot = "round",
}: {
  readonly rows: readonly { readonly w: string; readonly chip: string }[];
  readonly dot?: "round" | "file";
}) {
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border rounded-sm border p-1.5">
        {rows.map((row, i) => (
          <div
            key={row.chip + i}
            className={`flex items-center gap-1.5 px-1 py-1.5 ${
              i === rows.length - 1 ? "" : "border-border-subtle border-b"
            }`}
          >
            {dot === "round" ? (
              <span
                className="block size-3.5 shrink-0 rounded-full"
                style={{
                  background:
                    "color-mix(in oklch, var(--primary), var(--card) 70%)",
                }}
              />
            ) : (
              <span className="bg-card border-muted-foreground block h-3 w-2.5 shrink-0 rounded-[1px] border" />
            )}
            <div className="min-w-0 flex-1">
              <Line w={row.w} strong />
            </div>
            <span
              className="text-micro-floor shrink-0 rounded-sm px-1.5 py-0.5 font-semibold tracking-wider uppercase"
              style={{
                background:
                  "color-mix(in oklch, var(--primary), var(--card) 80%)",
                color: VIZ_ACCENT,
              }}
            >
              {row.chip}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
