import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import CoamComponent from "./coam-component";

const listSpy = vi.fn();

vi.mock("./use-account-mapping", () => ({
  EMPTY_COUNTS: { incomplete: 0, overridden: 0, default: 0, unreviewed: 0 },
  useAccountMappingList: (q: unknown) => {
    listSpy(q);
    return {
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  },
  useReviewAccountMapping: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("./use-coam-table", () => ({
  useCoamTable: () => ({
    resetRowSelection: vi.fn(),
    setRowSelection: vi.fn(),
    getSelectedRowModel: () => ({ rows: [] }),
  }),
}));
vi.mock("@/hooks/use-list-filters", () => ({
  useListFilters: () => ({
    values: {},
    activeFilters: [],
    setValue: vi.fn(),
    view: {
      canManageBu: false,
      existingNames: [],
      saveOrUpdate: vi.fn(),
    },
  }),
}));
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
vi.mock("@/components/list-filter/list-toolbar", () => ({
  ListToolbar: () => null,
}));
vi.mock("@/components/list-filter/save-view-dialog", () => ({
  SaveViewDialog: () => null,
}));
vi.mock("@/components/ui/data-grid/data-grid", () => ({
  DataGrid: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DataGridContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DataGridScrollArea: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/ui/data-grid/data-grid-table", () => ({
  DataGridTable: () => null,
}));
vi.mock("@/components/ui/data-grid/data-grid-pagination", () => ({
  DataGridPagination: () => null,
}));
vi.mock("./coam-edit-sheet", () => ({ CoamEditSheet: () => null }));
vi.mock("./coam-generate-dialog", () => ({ CoamGenerateDialog: () => null }));
vi.mock("./coam-batch-edit-sheet", () => ({ CoamBatchEditSheet: () => null }));

const lastQuery = () =>
  listSpy.mock.calls[listSpy.mock.calls.length - 1][0] as {
    sort?: string;
    mapping_type: string;
  };

function renderAt(search: string) {
  window.history.replaceState({}, "", `/${search}`);
  return render(
    <IntlProvider locale="en" messages={en}>
      <MemoryRouter>
        <CoamComponent />
      </MemoryRouter>
    </IntlProvider>,
  );
}

beforeEach(() => {
  listSpy.mockClear();
  window.history.replaceState({}, "", "/");
});

describe("CoamComponent — sort guard", () => {
  it.each([
    "location",
    "location_type",
    "category",
    "sub_category",
    "item_group",
    "movement",
    "adjustment_type",
    "cost_center",
    "account",
  ])("ส่ง sort ของคอลัมน์ %s ไป backend", (col) => {
    renderAt(`?sort=${col}:desc`);
    expect(lastQuery().sort).toBe(`${col}:desc`);
  });

  it("ไม่ส่ง sort ของคอลัมน์ status (backend ไม่รับ)", () => {
    renderAt("?sort=status:asc");
    expect(lastQuery().sort).toBeUndefined();
  });

  it("ไม่ส่ง sort ของคอลัมน์ที่ไม่รู้จัก", () => {
    renderAt("?sort=bogus:asc");
    expect(lastQuery().sort).toBeUndefined();
  });

  it("ไม่มี sort -> ไม่ส่ง", () => {
    renderAt("");
    expect(lastQuery().sort).toBeUndefined();
  });

  it("สลับแท็บแล้วล้าง sort ออกจาก URL และ query", () => {
    renderAt("?sort=account:desc");
    expect(lastQuery()).toMatchObject({
      mapping_type: "AP",
      sort: "account:desc",
    });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Post to GL/ }), {
      button: 0,
    });
    expect(new URLSearchParams(window.location.search).has("sort")).toBe(false);
    expect(window.location.search).toContain("tab=GL");
    expect(lastQuery()).toMatchObject({ mapping_type: "GL" });
    expect(lastQuery().sort).toBeUndefined();
  });
});
