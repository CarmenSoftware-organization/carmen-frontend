import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import { AddWidgetDialog } from "../add-widget-dialog";

// id สมมติที่ไม่มีคำแปลใน dashboard.datasets — ชื่อที่โชว์จึงเป็น `name` ตรง ๆ
const CATALOGUE: DashboardDataset[] = [
  {
    id: "vendor.fixture-active",
    name: "Fixture vendors",
    description: "Vendors in use",
    shape: "scalar",
    category: "spend",
    unit: "items",
  },
  {
    id: "document.fixture-po",
    name: "Fixture PO trend",
    description: "POs issued per day",
    shape: "time_series",
    category: "workflow",
    unit: "items",
    params: [
      {
        name: "days",
        label: "Days",
        type: "int",
        required: false,
        default: 30,
      },
    ],
  },
  {
    id: "lab.fixture-sql",
    name: "Fixture SQL",
    description: "",
    // table วาดได้แบบเดียว — ใช้เช็คว่าตัวเลือกชนิดกราฟไม่โผล่
    shape: "table",
    category: "workflow",
    unit: "items",
  },
];

const PRESET: DashboardDataset = {
  id: "group@document.fixture-count",
  name: "Fixture pipeline",
  description: "Count by status",
  shape: "scalar",
  category: "workflow",
  unit: "items",
};

const previewSpy = vi.fn();
vi.mock("@/hooks/use-dashboard-dataset", () => ({
  useDashboardDatasets: () => ({
    data: { items: CATALOGUE, count: CATALOGUE.length },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useDashboardDatasetPreview: (...args: unknown[]) => {
    previewSpy(...args);
    return {
      data: { meta: {}, data: 1 },
      isLoading: false,
      isError: false,
      error: null,
    };
  },
}));

// การ์ดจริงลาก recharts มาทั้งชุด — ที่นี่สนใจแค่ว่า preview ได้ dataset/ชื่อ/ชนิดไหน
vi.mock("@/components/dashboard-widget/dashboard-widget-grid", () => ({
  WidgetRouter: ({
    widget,
  }: {
    widget: { dataset_id: string; title: string; widget_type: string };
  }) => (
    <div data-testid="preview">
      {widget.dataset_id}|{widget.title}|{widget.widget_type}
    </div>
  ),
  WidgetSkeleton: () => <div data-testid="preview-skeleton" />,
}));

const sw = en.dashboard.savedWidget;

function renderDialog(
  props: Partial<React.ComponentProps<typeof AddWidgetDialog>> = {},
) {
  const onAdd = vi.fn();
  const ui = (p: Partial<React.ComponentProps<typeof AddWidgetDialog>>) => (
    <IntlProvider locale="en" messages={en} timeZone="Asia/Bangkok">
      <AddWidgetDialog open onOpenChange={vi.fn()} onAdd={onAdd} {...p} />
    </IntlProvider>
  );
  const { rerender } = render(ui(props));
  return {
    onAdd,
    rerender: (p: Partial<React.ComponentProps<typeof AddWidgetDialog>>) =>
      rerender(ui(p)),
  };
}

const sectionNames = () =>
  screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));

describe("AddWidgetDialog", () => {
  beforeEach(() => previewSpy.mockClear());

  it("lists widgets grouped by module in the fixed order, presets with their module", () => {
    renderDialog({ extraItems: [PRESET] });

    expect(sectionNames()).toEqual([
      sw.module.document,
      sw.module.vendor,
      sw.module.lab,
    ]);
    const documents = screen.getByRole("region", { name: sw.module.document });
    expect(
      within(documents)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      expect.stringContaining("Fixture pipeline"),
      expect.stringContaining("Fixture PO trend"),
    ]);
  });

  it("hides excluded datasets and modules left empty by the search", async () => {
    const user = userEvent.setup();
    renderDialog({ excludeIds: new Set(["lab.fixture-sql"]) });

    expect(sectionNames()).toEqual([sw.module.document, sw.module.vendor]);
    await user.type(
      screen.getByRole("textbox", { name: sw.searchWidgets }),
      "issued",
    );
    expect(sectionNames()).toEqual([sw.module.document]);
  });

  it("shows nothing to add until a widget is picked, and does not fire a preview", () => {
    renderDialog();

    expect(screen.getByText(sw.pickHint)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: sw.addSubmit })).toBeDisabled();
    expect(previewSpy).not.toHaveBeenCalled();
  });

  it("opens the config form with a live preview and adds with the chosen values", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Fixture PO trend/ }));
    expect(previewSpy).toHaveBeenLastCalledWith(
      "document.fixture-po",
      { days: 30 },
      true,
    );
    expect(screen.getByTestId("preview")).toHaveTextContent(
      "document.fixture-po|Fixture PO trend",
    );

    await user.type(screen.getByLabelText(sw.titleEn), "My POs");
    expect(screen.getByTestId("preview")).toHaveTextContent("|My POs");
    await user.click(screen.getByRole("button", { name: sw.addSubmit }));

    expect(onAdd).toHaveBeenCalledWith(
      CATALOGUE[1],
      { days: 30 },
      {},
      { en: "My POs" },
      "line",
    );
  });

  // เดิม dataset ที่ไม่มี param ถูกเพิ่มทันทีโดยไม่เห็นหน้าตา — ตอนนี้ต้องผ่านฟอร์มเหมือนกัน
  it("previews a dataset without params before adding it", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Fixture vendors/ }));
    expect(screen.getByTestId("preview")).toHaveTextContent(
      "vendor.fixture-active",
    );
    await user.click(screen.getByRole("button", { name: sw.addSubmit }));
    expect(onAdd).toHaveBeenCalledWith(CATALOGUE[0], {}, {}, null, "kpi");
  });

  it("starts from the new dataset's defaults when switching selection", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /Fixture PO trend/ }));
    await user.type(screen.getByLabelText(sw.titleEn), "Typed");
    await user.click(screen.getByRole("button", { name: /Fixture vendors/ }));

    expect(screen.getByLabelText(sw.titleEn)).toHaveValue("");
  });

  it("uses renderPreview instead of the form for page-side presets", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderDialog({
      extraItems: [PRESET],
      renderPreview: (d) =>
        d.id === PRESET.id ? (
          <div data-testid="custom">pipeline</div>
        ) : undefined,
    });

    await user.click(screen.getByRole("button", { name: /Fixture pipeline/ }));
    expect(screen.getByTestId("custom")).toBeInTheDocument();
    expect(screen.queryByLabelText(sw.titleEn)).not.toBeInTheDocument();
    expect(previewSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: sw.addSubmit }));
    expect(onAdd).toHaveBeenCalledWith(PRESET, {}, {}, null, "kpi");
  });

  it("lets the user pick the chart type; the preview and the new widget follow it", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Fixture PO trend/ }));
    const types = screen.getByRole("group", { name: sw.chartType.label });
    // time_series วาดได้ แท่ง · เส้น · พื้นที่ — เริ่มที่เส้นตามค่าตั้งต้นของ shape
    expect(
      within(types)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([sw.chartType.bar, sw.chartType.line, sw.chartType.area]);
    expect(
      within(types).getByRole("button", { name: sw.chartType.line }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      within(types).getByRole("button", { name: sw.chartType.bar }),
    );
    expect(screen.getByTestId("preview")).toHaveTextContent(
      "document.fixture-po|Fixture PO trend|bar",
    );
    // กดตัวที่เลือกอยู่ซ้ำ ไม่ยกเลิกการเลือก
    await user.click(
      within(types).getByRole("button", { name: sw.chartType.bar }),
    );
    expect(screen.getByTestId("preview")).toHaveTextContent("|bar");

    await user.click(screen.getByRole("button", { name: sw.addSubmit }));
    expect(onAdd).toHaveBeenCalledWith(
      CATALOGUE[1],
      { days: 30 },
      {},
      null,
      "bar",
    );
  });

  it("hides the chart type choice when the dataset has only one", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /Fixture SQL/ }));
    expect(screen.getByTestId("preview")).toHaveTextContent("|table");
    expect(
      screen.queryByRole("group", { name: sw.chartType.label }),
    ).not.toBeInTheDocument();
  });

  // Seen on the live site 2026-11-04: one double click on Add created two identical widgets —
  // the second click landed before the mutation's isPending reached the button.
  it("submits once on a double click, before the parent reports pending", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Fixture vendors/ }));
    await user.dblClick(screen.getByRole("button", { name: sw.addSubmit }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("lets the user try again once a failed save is no longer pending", async () => {
    const user = userEvent.setup();
    const { onAdd, rerender } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Fixture vendors/ }));
    await user.click(screen.getByRole("button", { name: sw.addSubmit }));
    rerender({ isPending: true });
    rerender({ isPending: false });
    await user.click(screen.getByRole("button", { name: sw.addSubmit }));

    expect(onAdd).toHaveBeenCalledTimes(2);
  });
});
