import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import CategoryComponent from "./category-component";

const empty = { data: [], isLoading: false };
const mutation = { mutate: vi.fn(), isPending: false };

vi.mock("@/hooks/use-category", () => ({
  useCategoryAll: () => empty,
  useCreateCategory: () => mutation,
  useUpdateCategory: () => mutation,
  useDeleteCategory: () => mutation,
}));
vi.mock("@/hooks/use-sub-category", () => ({
  useSubCategoryAll: () => empty,
  useCreateSubCategory: () => mutation,
  useUpdateSubCategory: () => mutation,
  useDeleteSubCategory: () => mutation,
}));
vi.mock("@/hooks/use-item-group", () => ({
  useItemGroupAll: () => empty,
  useCreateItemGroup: () => mutation,
  useUpdateItemGroup: () => mutation,
  useDeleteItemGroup: () => mutation,
}));
vi.mock("./use-category-dialog", () => ({
  useCategoryDialog: () => ({
    dialogOpen: false,
    closeDialog: vi.fn(),
    handleAdd: vi.fn(),
    handleEdit: vi.fn(),
  }),
}));
vi.mock("./use-node-account-codes", () => ({
  useNodeAccountCodes: () => ({ data: undefined }),
}));
vi.mock("./category-dialog", () => ({ CategoryDialog: () => null }));
vi.mock("./tree-content", () => ({ default: () => null }));
vi.mock("@/components/share/list-page-shell", () => ({
  ListPageShell: ({
    actions,
    toolbar,
    children,
  }: {
    actions: React.ReactNode;
    toolbar: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      {actions}
      {toolbar}
      {children}
    </div>
  ),
}));
vi.mock("@/components/share/document-list-actions", () => ({
  DocumentListActions: ({
    extraActions,
  }: {
    extraActions?: React.ReactNode;
  }) => <div>{extraActions}</div>,
}));
const report = vi.hoisted(() => ({
  printReport: vi.fn(),
  exportReport: vi.fn(),
  isBusy: false,
}));
vi.mock("./use-category-report", () => ({
  useCategoryReport: () => report,
}));
// จับ props ที่ส่งให้ dialog ของรายงาน — ตัว dialog จริงมีเทสของมันเอง
const reportDialog = vi.hoisted(() => ({
  props: undefined as undefined | Record<string, unknown>,
}));
vi.mock("./category-report-dialog", () => ({
  CategoryReportDialog: (props: Record<string, unknown>) => {
    reportDialog.props = props;
    return null;
  },
}));

function renderAt(url: string) {
  return render(
    <IntlProvider locale="en" messages={en}>
      <MemoryRouter initialEntries={[url]}>
        <CategoryComponent />
      </MemoryRouter>
    </IntlProvider>,
  );
}

describe("CategoryComponent — ?search=", () => {
  it("ใช้ค่า ?search= เป็นค่าเริ่มต้นของช่องค้นหา", () => {
    renderAt("/product-management/category?search=A%26B%201");
    expect(screen.getByRole("textbox")).toHaveValue("A&B 1");
  });

  it("ไม่มี ?search= -> ช่องค้นหาว่าง", () => {
    renderAt("/product-management/category");
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});

describe("CategoryComponent — Product Category Report", () => {
  it("ปุ่ม Print เปิด dialog โหมดพิมพ์ ส่งต่อไปที่ printReport", () => {
    renderAt("/product-management/category");
    expect(reportDialog.props?.open).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: en.common.print }));

    expect(reportDialog.props).toMatchObject({
      open: true,
      mode: "print",
      onSubmit: report.printReport,
    });
  });

  it("ปุ่ม Export เปิด dialog โหมด export ส่งต่อไปที่ exportReport แล้วปิดได้", () => {
    renderAt("/product-management/category");

    fireEvent.click(screen.getByRole("button", { name: en.common.export }));
    expect(reportDialog.props).toMatchObject({
      open: true,
      mode: "export",
      onSubmit: report.exportReport,
    });

    act(() =>
      (reportDialog.props?.onOpenChange as (o: boolean) => void)(false),
    );
    expect(reportDialog.props?.open).toBe(false);
  });
});
