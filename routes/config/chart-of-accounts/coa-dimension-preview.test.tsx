import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { CoaDimensionPreview } from "./coa-dimension-preview";
import type { CoaSelectOption } from "./coa-multi-select";
import type { DimensionPreview } from "./coa-dimension-preview-state";

vi.mock("@/components/ui/virtual-command-list", () => ({
  VirtualCommandList: ({
    items,
    children,
  }: {
    items: CoaSelectOption[];
    children: (item: CoaSelectOption) => React.ReactNode;
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.value}>{children(item)}</div>
      ))}
    </div>
  ),
}));

const query = vi.hoisted(() => ({
  data: [
    ...Array.from({ length: 205 }, (_, index) => ({
      id: `value-${index + 1}`,
      dimension_id: "project",
      code: `P${index + 1}`,
      name: `Project ${index + 1}`,
      is_active: true,
    })),
    {
      id: "wrong",
      dimension_id: "other",
      code: "OTHER",
      name: "Other Dimension",
      is_active: true,
    },
  ],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));
vi.mock("@/hooks/use-gl-dimensions", () => ({
  useGlDimensionValues: () => query,
}));

beforeEach(() => {
  query.isError = false;
});

function renderPreview(
  value: DimensionPreview = { allowedValueIds: [], defaultValueId: null },
) {
  const onChange = vi.fn();
  render(
    <IntlProvider locale="en" messages={en}>
      <CoaDimensionPreview
        dimension={{
          id: "project",
          code: "project",
          name: "Project",
          sequence: 1,
          is_active: true,
          doc_version: 1,
          data_type: "lookup",
        }}
        value={value}
        onChange={onChange}
        readOnly={false}
      />
    </IntlProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "List Master / Default" }),
  );
  return onChange;
}

it("previews an allowed item beyond 200 and one default without submitting data", () => {
  const onChange = renderPreview();
  expect(
    screen.getByText(
      "List Master and Default are a UI preview and are not saved yet.",
    ),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("combobox", { name: "Allowed List Master items" }),
  );
  expect(
    screen.queryByRole("checkbox", { name: "OTHER — Other Dimension" }),
  ).toBeNull();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search Allowed List Master items" }),
    { target: { value: "P205" } },
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "P205 — Project 205" }));
  fireEvent.keyDown(
    screen.getByRole("textbox", { name: "Search Allowed List Master items" }),
    { key: "Escape" },
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Default" }));
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  fireEvent.click(screen.getByRole("checkbox", { name: "P205 — Project 205" }));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply preview" }));
  expect(onChange).toHaveBeenCalledWith({
    allowedValueIds: ["value-205"],
    defaultValueId: "value-205",
  });
});

it("clears the default after removing it from the allowed list", () => {
  const onChange = renderPreview({
    allowedValueIds: ["value-1", "value-205"],
    defaultValueId: "value-205",
  });
  fireEvent.click(
    screen.getByRole("combobox", { name: "Allowed List Master items" }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "P205 — Project 205" }));
  fireEvent.keyDown(
    screen.getByRole("textbox", { name: "Search Allowed List Master items" }),
    { key: "Escape" },
  );
  expect(screen.getByRole("combobox", { name: "Default" })).toHaveTextContent(
    "No default",
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply preview" }));
  expect(onChange).toHaveBeenCalledWith({
    allowedValueIds: ["value-1"],
    defaultValueId: null,
  });
});

it("keeps changes local when the dialog is closed without applying", () => {
  const onChange = renderPreview();
  fireEvent.click(screen.getByRole("combobox", { name: "Default" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "P1 — Project 1" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
  expect(onChange).not.toHaveBeenCalled();
});

it("offers retry and prevents applying when the master fails to load", () => {
  query.isError = true;
  const onChange = renderPreview();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Unable to load List Master items.",
  );
  expect(screen.getByRole("button", { name: "Apply preview" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(query.refetch).toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});
