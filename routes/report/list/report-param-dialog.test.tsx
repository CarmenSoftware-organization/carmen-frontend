import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { setRuntimeConfigForTests } from "@/lib/runtime-config";
import type { Report } from "@/types/report";
import { reportParamKey, saveReportParams } from "./report-param-memory";

/**
 * กดเปิดช่องเลือกที่ดึงข้อมูลจากที่อื่น ต้องดึงรายการใหม่ทุกครั้ง
 *
 * dialog ดึงรอบแรกตอนเปิดอยู่แล้ว แต่ผู้ใช้เปิด dialog ค้างไว้ได้ — มีคนเพิ่มสินค้า
 * ระหว่างนั้น กดช่อง Product กี่ครั้งก็ต้องเห็นตัวใหม่ ไม่ใช่รายการตอนเปิด dialog
 */

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU1" }));

// jsdom ไม่มีความสูงให้ virtualizer วัด รายการจริงจึงไม่ render แถวไหนเลย — แทนด้วยรายการธรรมดา
vi.mock("@/components/ui/virtual-command-list", () => ({
  VirtualCommandList: <T,>({
    items,
    children,
  }: {
    items: T[];
    children: (item: T, index: number) => React.ReactNode;
  }) => <div>{items.map((item, i) => children(item, i))}</div>,
}));

const { ReportParamDialog } = await import("./report-param-dialog");

const report = {
  Id: 1,
  ReportName: "Stock Card",
  Dialog:
    '<Dialog><Label Text="Product"/><Lookup Name="Product" DataSource="@product_list"/></Dialog>',
} as unknown as Report;

const lookupResponse = () =>
  new Response(
    JSON.stringify({ data: { product: [{ code: "P1", name: "Product 1" }] } }),
    { status: 200 },
  );

const lookupCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes("/lookups"))
    .length;

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <IntlProvider locale="en" messages={en}>
        <ReportParamDialog open onOpenChange={() => {}} report={report} />
      </IntlProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  setRuntimeConfigForTests({ BACKEND_URL: "", X_APP_ID: "app-test" });
});

describe("ReportParamDialog lookup fields", () => {
  it("refetches the list every time a lookup field is opened", async () => {
    const fetchMock = vi.fn(async () => lookupResponse());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderDialog();
    // รอบแรก: ตอนเปิด dialog (ช่องเลือกโผล่หลังได้รายการ — ค่าเริ่มต้นคือ All)
    const trigger = await screen.findByRole("button", { name: "All" });
    expect(lookupCalls(fetchMock)).toBe(1);

    await user.click(trigger);
    await waitFor(() => expect(lookupCalls(fetchMock)).toBe(2));

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(lookupCalls(fetchMock)).toBe(3));
  });
});

describe("ReportParamDialog server-side search", () => {
  it("searches the server with what the user types, and shows the match", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes("search=")
        ? new Response(
            JSON.stringify({
              data: {
                product: [{ code: "55000209", name: "Dead Mouth Wrench" }],
              },
            }),
            { status: 200 },
          )
        : lookupResponse(),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderDialog();
    await user.click(await screen.findByRole("button", { name: "All" }));
    await user.keyboard("wrench");

    await waitFor(() => {
      const searchCall = fetchMock.mock.calls
        .map(([url]) => new URL(String(url), "http://x"))
        .find((u) => u.searchParams.get("search") === "wrench");
      expect(searchCall?.searchParams.get("types")).toBe("product");
      expect(searchCall?.searchParams.get("limit")).toBe("50");
    });
    expect(
      await screen.findByText("55000209 - Dead Mouth Wrench"),
    ).toBeInTheDocument();
  });
});

// ผู้ใช้เปิดรายงานเดิมซ้ำเพื่อเทียบผล — ค่าที่กดเรียกดูล่าสุด (ภายใน 30 นาที) ต้องถูกเติมไว้ให้
describe("ReportParamDialog remembers the last run", () => {
  const templated = { ...report, _templateId: "tpl-stock-card" } as Report;
  const memoryKey = reportParamKey("BU1", "tpl-stock-card");

  function renderWith(onRun = vi.fn()) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <IntlProvider locale="en" messages={en}>
          <ReportParamDialog
            open
            onOpenChange={() => {}}
            report={templated}
            buCode="BU1"
            onRun={onRun}
          />
        </IntlProvider>
      </QueryClientProvider>,
    );
    return onRun;
  }

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => lookupResponse()),
    );
  });

  it("fills in the last run, and runs with it", async () => {
    saveReportParams(memoryKey, {
      values: { Product: "P1" },
      labels: { Product: "P1 - Product 1" },
    });
    const onRun = renderWith();
    const user = userEvent.setup();

    expect(
      await screen.findByRole("button", { name: "P1 - Product 1" }),
    ).toBeInTheDocument();
    expect(screen.getByText(en.report.rememberedParams)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: en.report.runReport }));
    expect(onRun).toHaveBeenCalledWith(templated, { Product: "P1" });
  });

  // ตัวเลือกที่ได้จากการค้นฝั่ง server ไม่อยู่ในรายการตั้งต้น — ปุ่มต้องโชว์ป้ายที่จำไว้ ไม่ใช่ว่าง
  it("shows the remembered label for a value found by searching", async () => {
    saveReportParams(memoryKey, {
      values: { Product: "55000209" },
      labels: { Product: "55000209 - Dead Mouth Wrench" },
    });
    renderWith();

    expect(
      await screen.findByRole("button", {
        name: "55000209 - Dead Mouth Wrench",
      }),
    ).toBeInTheDocument();
  });

  it("starts from the report defaults once 30 minutes have passed", async () => {
    saveReportParams(
      memoryKey,
      { values: { Product: "P1" }, labels: { Product: "P1 - Product 1" } },
      Date.now() - 31 * 60_000,
    );
    renderWith();

    expect(
      await screen.findByRole("button", { name: "All" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(en.report.rememberedParams)).toBeNull();
  });

  it("the reset button goes back to the defaults and forgets the last run", async () => {
    saveReportParams(memoryKey, {
      values: { Product: "P1" },
      labels: { Product: "P1 - Product 1" },
    });
    renderWith();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "P1 - Product 1" });

    await user.click(
      screen.getByRole("button", { name: en.report.resetParams }),
    );

    expect(
      await screen.findByRole("button", { name: "All" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(memoryKey)).toBeNull();
  });

  it("remembers what was run, labels included", async () => {
    renderWith();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "All" });

    await user.click(screen.getByRole("button", { name: en.report.runReport }));

    const stored = JSON.parse(localStorage.getItem(memoryKey) ?? "{}");
    expect(stored.values).toEqual({ Product: "ALL" });
    expect(stored.labels).toEqual({ Product: "All" });
    expect(typeof stored.savedAt).toBe("number");
  });
});

// คู่ From–To ของช่องเดียวกัน: ตอนทั้งคู่เป็น All เลือกฝั่งไหนก่อน อีกฝั่งได้ค่าเดียวกัน หลังจากนั้นไม่แตะกันอีก
// จนกว่าทั้งสองฝั่งจะกลับเป็น All
describe("ReportParamDialog From–To pair", () => {
  const rangeReport = {
    Id: 2,
    ReportName: "Stock Card",
    _templateId: "tpl-range",
    Dialog:
      '<Dialog><Label Text="Product From"/><Lookup Name="ProductFrom" DataSource="@product_list"/>' +
      '<Label Text="Product To"/><Lookup Name="ProductTo" DataSource="@product_list"/></Dialog>',
  } as unknown as Report;

  const twoProducts = () =>
    new Response(
      JSON.stringify({
        data: {
          product: [
            { code: "P1", name: "Product 1" },
            { code: "P2", name: "Product 2" },
          ],
        },
      }),
      { status: 200 },
    );

  function renderRange(onRun = vi.fn()) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <IntlProvider locale="en" messages={en}>
          <ReportParamDialog
            open
            onOpenChange={() => {}}
            report={rangeReport}
            buCode="BU1"
            onRun={onRun}
          />
        </IntlProvider>
      </QueryClientProvider>,
    );
    return onRun;
  }

  const pick = async (
    user: ReturnType<typeof userEvent.setup>,
    trigger: HTMLElement,
    label: string,
  ) => {
    await user.click(trigger);
    // the open list is portaled after the triggers, so its entry is the last match
    // รายการที่เปิดอยู่ถูก portal ไว้หลังปุ่ม ตัวเลือกจึงเป็นตัวสุดท้ายที่เจอ
    const matches = await screen.findAllByText(label);
    await user.click(matches[matches.length - 1]);
  };

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => twoProducts()),
    );
  });

  it("copies the first pick to the other side, then leaves the sides alone", async () => {
    const onRun = renderRange();
    const user = userEvent.setup();
    const [fromTrigger] = await screen.findAllByRole("button", { name: "All" });

    await pick(user, fromTrigger, "P1 - Product 1");
    const [, toTrigger] = await screen.findAllByRole("button", {
      name: "P1 - Product 1",
    });

    await pick(user, toTrigger, "P2 - Product 2");
    expect(
      screen
        .getAllByRole("button", { name: /Product \d/ })
        .map((b) => b.textContent),
    ).toEqual(["P1 - Product 1", "P2 - Product 2"]);

    await user.click(screen.getByRole("button", { name: en.report.runReport }));
    expect(onRun).toHaveBeenCalledWith(rangeReport, {
      ProductFrom: "P1",
      ProductTo: "P2",
    });
  });

  it("copies again once both sides are back to All", async () => {
    renderRange();
    const user = userEvent.setup();
    const [fromTrigger] = await screen.findAllByRole("button", { name: "All" });
    await pick(user, fromTrigger, "P1 - Product 1");

    const [fromAgain, toAgain] = await screen.findAllByRole("button", {
      name: "P1 - Product 1",
    });
    await pick(user, fromAgain, "All");
    // To still P1 — one side at All is not "both"
    expect(
      screen.getAllByRole("button", { name: "P1 - Product 1" }),
    ).toHaveLength(1);
    await pick(user, toAgain, "All");

    const [, toAll] = await screen.findAllByRole("button", { name: "All" });
    await pick(user, toAll, "P2 - Product 2");
    expect(
      await screen.findAllByRole("button", { name: "P2 - Product 2" }),
    ).toHaveLength(2);
  });

  it("does not copy when the dialog opens with remembered values", async () => {
    saveReportParams(reportParamKey("BU1", "tpl-range"), {
      values: { ProductFrom: "P1", ProductTo: "P2" },
      labels: { ProductFrom: "P1 - Product 1", ProductTo: "P2 - Product 2" },
    });
    renderRange();
    const user = userEvent.setup();
    const fromTrigger = await screen.findByRole("button", {
      name: "P1 - Product 1",
    });

    await pick(user, fromTrigger, "P2 - Product 2");
    expect(
      await screen.findAllByRole("button", { name: "P2 - Product 2" }),
    ).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "P1 - Product 1" })).toBeNull();
  });
});

describe("ReportParamDialog <Note>", () => {
  it("shows the note with today's date under the fields", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => lookupResponse()),
    );
    const noteReport = {
      Id: 3,
      ReportName: "Slow Moving Report",
      Dialog:
        '<Dialog><Label Text="Day"/><Lookup Name="Day" Items="30~60" Values="30~60" Value="30"/>' +
        '<Note Text="Today = @today"/></Dialog>',
    } as unknown as Report;
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <IntlProvider locale="en" messages={en}>
          <ReportParamDialog open onOpenChange={() => {}} report={noteReport} />
        </IntlProvider>
      </QueryClientProvider>,
    );

    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    expect(screen.getByText(`Today = ${today}`)).toBeInTheDocument();
  });
});
