import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    toolbar,
    children,
  }: {
    toolbar: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      {toolbar}
      {children}
    </div>
  ),
}));
vi.mock("@/components/share/document-list-actions", () => ({
  DocumentListActions: () => null,
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
