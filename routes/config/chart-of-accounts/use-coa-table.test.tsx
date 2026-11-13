import { describe, it, expect, beforeEach } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { flexRender } from "@tanstack/react-table";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import type { ParamsDto } from "@/types/params";
import { setRuntimeConfigForTests } from "@/lib/runtime-config";
import {
  CHART_OF_ACCOUNT_TYPE,
  ACCOUNT_NATURE,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";
import { useCoaTable } from "./use-coa-table";
import userEvent from "@testing-library/user-event";

// useConfigTable → useCan() → useLicense() อ่าน runtime config — ไม่มีอันนี้
// จะโยน "Runtime config not loaded" ตั้งแต่ render แรก
beforeEach(() => {
  setRuntimeConfigForTests({ BACKEND_URL: "", X_APP_ID: "app-1" });
});

const params: ParamsDto = { page: 1, perpage: 10 };

const tableConfig = {
  manualPagination: true as const,
  manualSorting: true as const,
  pageCount: 0,
  state: {
    pagination: { pageIndex: 0, pageSize: 10 },
    sorting: [],
  },
  onPaginationChange: () => {},
  onSortingChange: () => {},
};

const rows: ChartOfAccount[] = [
  {
    id: "ac-1",
    doc_version: 1,
    code: "1140-001",
    description_1: "Inventory - Food",
    description_2: "ครัวร้อน",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <IntlProvider locale="en" messages={en}>
        <MemoryRouter>{children}</MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>
  );
}

function renderCoaTable(data: ChartOfAccount[] = rows) {
  return renderHook(
    () =>
      useCoaTable({
        data,
        totalRecords: data.length,
        params,
        tableConfig,
        onEdit: () => {},
        onDelete: () => {},
      }),
    { wrapper },
  );
}

describe("useCoaTable", () => {
  it("keeps Activity and Delete without an Edit shortcut in the row menu", async () => {
    const { result } = renderCoaTable();
    const cell = result.current
      .getRowModel()
      .rows[0].getAllCells()
      .find((item) => item.column.id === "action")!;
    render(flexRender(cell.column.columnDef.cell, cell.getContext()), {
      wrapper,
    });
    await userEvent.click(screen.getByRole("button", { name: "Row actions" }));
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
    expect(
      screen.getByRole("menuitem", { name: "Activity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();
  });
  it("มีคอลัมน์ครบตามฟิลด์ที่ backend ส่งมา", () => {
    const { result } = renderCoaTable();
    for (const id of [
      "code",
      "description_1",
      "description_2",
      "category",
      "nature",
      "type",
    ]) {
      expect(result.current.getColumn(id), `ต้องมีคอลัมน์ ${id}`).toBeDefined();
    }
  });

  it("ไม่เหลือคอลัมน์ name/description ของสัญญาเดิม", () => {
    const { result } = renderCoaTable();
    // id ของคอลัมน์คือฟิลด์ที่ส่งไป sort ฝั่ง backend (`${id}:${dir}`) —
    // เหลือชื่อเก่าไว้ = กดหัวคอลัมน์แล้วยิงฟิลด์ที่ไม่มีอยู่จริง
    expect(result.current.getColumn("name")).toBeUndefined();
    expect(result.current.getColumn("description")).toBeUndefined();
  });

  it("แปลงค่า enum เป็นคำที่คนอ่านออก ไม่ใช่ค่าดิบ", () => {
    const { result } = renderCoaTable();
    const cells = result.current.getRowModel().rows[0].getAllCells();
    const render = (id: string) => {
      const cell = cells.find((c) => c.column.id === id);
      const fn = cell?.column.columnDef.cell;
      return typeof fn === "function"
        ? (fn(cell!.getContext()) as string)
        : undefined;
    };
    expect(render("nature")).toBe("Debit");
    expect(render("type")).toBe("Balance sheet");
  });

  it("shows category, nature and type together without duplicate default columns", () => {
    const { result } = renderCoaTable();
    const cell = result.current
      .getRowModel()
      .rows[0].getAllCells()
      .find((c) => c.column.id === "category")!;
    render(flexRender(cell.column.columnDef.cell, cell.getContext()));
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByTitle("Debit")).toHaveTextContent("D");
    expect(screen.getByText("Balance sheet")).toBeInTheDocument();
    for (const id of ["description_2", "nature", "type"]) {
      expect(result.current.getColumn(id)?.getIsVisible()).toBe(false);
    }
  });

  it("ซ่อนคอลัมน์วันที่สร้าง/แก้ไขไว้ก่อน (เปิดเองได้จากเมนูคอลัมน์)", () => {
    const { result } = renderCoaTable();
    expect(result.current.getColumn("created_at")?.getIsVisible()).toBe(false);
    expect(result.current.getColumn("updated_at")?.getIsVisible()).toBe(false);
  });
});
