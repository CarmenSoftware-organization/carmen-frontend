import type { VisualKey } from "./landing-types";

const VIZ_WRAP =
  "absolute inset-0 flex flex-col justify-end px-2 pt-2 pb-2 pl-11";

/**
 * สีเดียวที่ภาพจำลองใช้ได้
 *
 * เดิมแต่ละโมดูลรับ `tint` จาก `TONE_COLOR` ซึ่งเป็น map 5 สี (indigo/blue/
 * green/rose/orange) ใช้เข้ารหัสว่าโมดูลไหนเป็นหมวดไหน — docs/DESIGN.md บอกว่า
 * "no second brand color exists" การ์ดแยกกันด้วยไอคอน ชื่อ และตัวภาพอยู่แล้ว
 * ไม่ต้องใช้สีมาบอกหมวด
 */
const ACCENT = "var(--primary)";

export function ModuleVisual({ visualKey }: { readonly visualKey: VisualKey }) {
  switch (visualKey) {
    case "roles":
      return <RolesViz />;
    case "assign":
      return <AssignViz />;
    case "inventoryPeriod":
      return <InventoryPeriodViz />;
    case "workflows":
      return <WorkflowsViz />;
    case "docs":
      return <DocsViz />;
    case "userActivity":
      return <UserActivityViz />;
    case "monitor":
      return <MonitorViz />;
    case "interface":
      return <InterfaceViz />;
    case "notify":
      return <NotifyViz />;
    case "code":
      return <CodeViz />;
    case "company":
      return <CompanyViz />;
    case "settings":
      return <SettingsViz />;
    case "askAi":
      return <AskAiViz />;
    case "emailProfile":
      return <EmailProfileViz />;
    case "emailTemplate":
      return <EmailTemplateViz />;
    case "storage":
      return <StorageViz />;
    default:
      return null;
  }
}

function RolesViz() {
  const roles = ["Buyer", "Storekeeper", "Finance"];
  const perms = ["View", "Create", "Approve", "Export"];
  const matrix = [
    [1, 1, 0, 1],
    [1, 1, 0, 0],
    [1, 0, 1, 1],
  ];
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border rounded-sm border p-2">
        <div className="grid grid-cols-[3.75rem_repeat(4,1fr)] gap-1">
          <span />
          {perms.map((p) => (
            <span
              key={p}
              className="text-muted-foreground text-micro-floor text-center font-semibold tracking-wider uppercase"
            >
              {p}
            </span>
          ))}
        </div>
        {roles.map((r, i) => (
          <div
            key={r}
            className={`grid grid-cols-[3.75rem_repeat(4,1fr)] items-center gap-1 py-1 ${
              i === 0 ? "" : "border-border-subtle border-t"
            }`}
          >
            <span className="text-foreground text-micro-legal font-semibold">
              {r}
            </span>
            {matrix[i].map((v, j) => (
              <span
                key={j}
                className="h-2 w-full rounded-[1px]"
                style={
                  v
                    ? { background: ACCENT }
                    : {
                        background: "transparent",
                        border: "1px solid var(--border)",
                      }
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryPeriodViz() {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const status: ReadonlyArray<"c" | "o" | "f"> = [
    "c",
    "c",
    "c",
    "c",
    "o",
    "o",
    "f",
    "f",
    "f",
    "f",
    "f",
    "f",
  ];
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border rounded-sm border p-2">
        <div className="text-muted-foreground text-micro-eyebrow mb-1.5 font-semibold tracking-wider uppercase">
          Months
        </div>
        <div className="grid grid-cols-12 gap-0.5">
          {months.map((m, i) => {
            const s = status[i];
            const style =
              s === "c"
                ? {
                    background: "var(--border-subtle)",
                    color: "var(--muted-foreground)",
                  }
                : s === "o"
                  ? { background: ACCENT, color: "var(--primary-foreground)" }
                  : {
                      background: "transparent",
                      color: "var(--muted-foreground)",
                      border: "1px dashed var(--border)",
                    };
            return (
              <div
                key={m}
                className="text-micro-floor rounded-[1px] py-1 text-center font-semibold"
                style={style}
              >
                {m}
              </div>
            );
          })}
        </div>
        <div className="text-muted-foreground text-micro-floor mt-1.5 flex gap-2">
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-[1px]"
              style={{ background: ACCENT }}
            />
            Open
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="bg-border-subtle inline-block size-2 rounded-[1px]" />
            Closed
          </span>
        </div>
      </div>
    </div>
  );
}

function WorkflowsViz() {
  const nodes = [
    { x: 20, y: 50, l: "Draft", filled: false, accent: false },
    { x: 95, y: 30, l: "Dept.", filled: false, accent: false },
    { x: 95, y: 70, l: "Buyer", filled: false, accent: false },
    { x: 175, y: 50, l: "Finance", filled: true, accent: true },
    { x: 255, y: 50, l: "Done", filled: true, accent: false },
  ];
  const edges = [
    [42, 50, 73, 32],
    [42, 50, 73, 68],
    [117, 32, 153, 48],
    [117, 68, 153, 52],
    [197, 50, 233, 50],
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center px-2 pl-11">
      <svg
        viewBox="0 0 280 100"
        className="h-16 w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <marker
            id="wf-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={ACCENT} />
          </marker>
        </defs>
        {nodes.map((n, i) => {
          // "เสร็จแล้ว" ไม่ใช้เขียว — นั่นคือ accent ตัวที่สอง สเต็ปที่ผ่านแล้ว
          // กับสเต็ปปัจจุบันแยกกันด้วย accent เต็ม vs เทาทึบ ไม่ใช่คนละสี
          const fill = n.accent
            ? ACCENT
            : n.filled
              ? "var(--muted-foreground)"
              : "var(--card)";
          const text = n.filled
            ? "var(--primary-foreground)"
            : "var(--foreground)";
          return (
            <g key={i}>
              <rect
                x={n.x - 22}
                y={n.y - 11}
                width="44"
                height="22"
                rx="3"
                fill={fill}
                stroke={ACCENT}
                strokeWidth="1"
              />
              <text
                x={n.x}
                y={n.y + 3.5}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill={text}
              >
                {n.l}
              </text>
            </g>
          );
        })}
        {edges.map(([x1, y1, x2, y2], i) => (
          <path
            key={i}
            d={`M${x1} ${y1} L${x2} ${y2}`}
            stroke={ACCENT}
            strokeWidth="1.3"
            fill="none"
            markerEnd="url(#wf-arrow)"
          />
        ))}
      </svg>
    </div>
  );
}

function InterfaceViz() {
  return (
    <div className={VIZ_WRAP}>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: ACCENT, opacity: 0.3 + i * 0.25 }}
          />
        ))}
      </div>
      <div
        className="mt-1.5 h-5 w-10 rounded"
        style={{ background: ACCENT, opacity: 0.75 }}
      />
    </div>
  );
}

function NotifyViz() {
  const templates = [
    // ช่องทางเป็น In-app ทุกแถว — เทมเพลตการแจ้งเตือนเหลือช่องทางแอปช่องทางเดียว (ไม่มีอีเมลแล้ว)
    { n: "Approval Required", e: "onApprove", c: "In-app" },
    { n: "Request Submitted", e: "onSubmit", c: "In-app" },
    { n: "PR Rejected", e: "onReject", c: "In-app" },
  ];
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border rounded-sm border p-1.5">
        {templates.map((tpl, i) => (
          <div
            key={tpl.n}
            className={`flex items-center gap-1.5 px-1 py-1.5 ${
              i === templates.length - 1 ? "" : "border-border-subtle border-b"
            }`}
          >
            <span
              className="inline-flex size-4 shrink-0 items-center justify-center rounded-full"
              style={{
                background:
                  "color-mix(in oklch, var(--primary), var(--card) 80%)",
              }}
              aria-hidden
            >
              <svg viewBox="0 0 16 16" className="size-2.5" fill="none">
                <path
                  d="M8 3 C 5.8 3 5 4.4 5 6.3 C 5 8.5 4 9.6 4 9.6 H 12 C 12 9.6 11 8.5 11 6.3 C 11 4.4 10.2 3 8 3 Z"
                  fill={ACCENT}
                />
                <circle cx="8" cy="11.4" r="1" fill={ACCENT} />
              </svg>
            </span>
            <span className="text-foreground text-micro-legal flex-1 truncate font-semibold">
              {tpl.n}
            </span>
            <span
              className="text-micro-floor rounded-sm px-1 py-0.5 font-semibold"
              style={{
                background:
                  "color-mix(in oklch, var(--primary), var(--card) 80%)",
                color: ACCENT,
              }}
            >
              {tpl.e}
            </span>
            <span className="text-muted-foreground text-micro-floor font-semibold">
              {tpl.c}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** เส้นแทนบรรทัดข้อความ — ภาพจำลองของหน้าที่เพิ่มทีหลังไม่ใส่ตัวเลขหรือชื่อสมมติ (ดูเหมือนข้อมูลจริง) */
function Line({
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

function CompanyViz() {
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border flex items-center gap-2 rounded-sm border p-2">
        <span
          className="block size-8 shrink-0 rounded"
          style={{ background: ACCENT, opacity: 0.8 }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Line w="55%" strong />
          <Line w="80%" />
          <Line w="40%" />
        </div>
      </div>
    </div>
  );
}

function SettingsViz() {
  const rows = [true, false, true];
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border flex flex-col gap-1.5 rounded-sm border p-2">
        {rows.map((on, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <Line w={`${45 + i * 12}%`} />
            <span
              className="bg-muted relative block h-2.5 w-5 shrink-0 rounded-full"
              style={on ? { background: ACCENT } : undefined}
            >
              <span
                className="bg-card absolute top-0.5 block size-1.5 rounded-full"
                style={on ? { right: "0.125rem" } : { left: "0.125rem" }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AskAiViz() {
  return (
    <div className={VIZ_WRAP}>
      <div className="flex flex-col gap-1.5">
        <div
          className="ml-auto flex w-1/2 flex-col gap-1 rounded-md rounded-br-none p-1.5"
          style={{ background: ACCENT, opacity: 0.85 }}
        >
          <span className="bg-primary-foreground/80 block h-1 w-4/5 rounded-full" />
        </div>
        <div className="bg-card border-border flex w-3/4 flex-col gap-1 rounded-md rounded-bl-none border p-1.5">
          <Line w="90%" />
          <Line w="70%" />
          <Line w="45%" />
        </div>
      </div>
    </div>
  );
}

function EmailProfileViz() {
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border flex flex-col gap-1.5 rounded-sm border p-2">
        {["From", "SMTP"].map((label, i) => (
          <div
            key={label}
            className="text-muted-foreground text-micro-eyebrow flex items-center gap-2"
          >
            <span className="w-7 shrink-0 font-semibold">{label}</span>
            <Line w={i === 0 ? "60%" : "45%"} strong={i === 0} />
            <span
              className="ml-auto block size-1.5 shrink-0 rounded-full"
              style={{ background: ACCENT }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailTemplateViz() {
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border flex flex-col gap-1.5 rounded-sm border p-2">
        <Line w="50%" strong />
        <Line w="92%" />
        <Line w="85%" />
        <span
          className="mt-0.5 block h-3 w-12 rounded-sm"
          style={{ background: ACCENT, opacity: 0.8 }}
        />
      </div>
    </div>
  );
}

function StorageViz() {
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border flex flex-col gap-2 rounded-sm border p-2">
        {[
          { label: "Database", fill: "35%" },
          { label: "Attachments", fill: "62%" },
        ].map((row) => (
          <div key={row.label}>
            <div className="text-muted-foreground text-micro-eyebrow font-semibold">
              {row.label}
            </div>
            <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: row.fill, background: ACCENT }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * แถวรายการของภาพจำลอง: จุดหน้าแถว + เส้นแทนข้อความ + ป้ายท้ายแถว
 *
 * ใช้กับหน้าที่เป็นรายการ (ผู้ใช้ ไฟล์ การเข้า–ออกระบบ ประวัติการแก้ไข) — เดิมแต่ละภาพใส่ชื่อคน
 * เลขที่เอกสาร และเวลาสมมติ ("A. Chen", "PO-12480", "2m ago") ซึ่งอ่านเป็นข้อมูลจริงได้
 * ป้ายท้ายแถวเป็นคำทั่วไปของหน้านั้น (ชื่อบทบาท ชนิดไฟล์ ชนิดการกระทำ) ไม่ใช่ข้อมูล
 */
function ListViz({
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
                color: ACCENT,
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

function AssignViz() {
  return (
    <ListViz
      rows={[
        { w: "45%", chip: "Buyer" },
        { w: "70%", chip: "Storekeeper" },
        { w: "35%", chip: "Finance" },
      ]}
    />
  );
}

function DocsViz() {
  return (
    <ListViz
      dot="file"
      rows={[
        { w: "65%", chip: "PDF" },
        { w: "50%", chip: "XLSX" },
        { w: "75%", chip: "IMG" },
      ]}
    />
  );
}

function UserActivityViz() {
  return (
    <ListViz
      rows={[
        { w: "50%", chip: "Sign in" },
        { w: "65%", chip: "Sign out" },
        { w: "40%", chip: "Sign in" },
      ]}
    />
  );
}

/** Activity Monitor = ประวัติว่าใครแก้อะไร (ไม่ใช่กราฟ CPU ของเครื่องอย่างที่ภาพเดิมวาด) */
function MonitorViz() {
  return (
    <ListViz
      rows={[
        { w: "60%", chip: "Create" },
        { w: "45%", chip: "Update" },
        { w: "70%", chip: "Delete" },
      ]}
    />
  );
}

/** Running Code = รูปแบบเลขที่เอกสาร (ไม่ใช่สคริปต์ตามเวลาอย่างที่ภาพ terminal เดิมวาด) */
function CodeViz() {
  const parts = ["Prefix", "Date", "Running no."];
  return (
    <div className={VIZ_WRAP}>
      <div className="bg-card border-border flex flex-col gap-1.5 rounded-sm border p-2">
        <div className="flex items-center gap-1">
          {parts.map((part, i) => (
            <span
              key={part}
              className="text-micro-floor rounded-sm px-1.5 py-0.5 font-semibold tracking-wider uppercase"
              style={
                i === 0
                  ? { background: ACCENT, color: "var(--primary-foreground)" }
                  : {
                      background:
                        "color-mix(in oklch, var(--primary), var(--card) 80%)",
                      color: ACCENT,
                    }
              }
            >
              {part}
            </span>
          ))}
        </div>
        <Line w="55%" strong />
      </div>
    </div>
  );
}
