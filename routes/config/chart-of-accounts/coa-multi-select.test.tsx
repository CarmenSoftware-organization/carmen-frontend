import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import th from "@/messages/th.json";
import { CoaMultiSelect, type CoaSelectOption } from "./coa-multi-select";
import { updateAllowedValues } from "./coa-dimension-preview-state";

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

const options = Array.from({ length: 205 }, (_, index) => ({
  value: `id-${index + 1}`,
  code: `CC${index + 1}`,
  name: `Cost Center ${index + 1}`,
}));

function Picker({
  initial = [] as string[],
  single = false,
  readOnly = false,
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CoaMultiSelect
        label="Cost Centers"
        options={options}
        value={value}
        onChange={setValue}
        single={single}
        readOnly={readOnly}
      />
      <output>{value.join(",")}</output>
    </>
  );
}

function renderPicker(props: React.ComponentProps<typeof Picker> = {}) {
  return render(
    <IntlProvider locale="en" messages={en}>
      <Picker {...props} />
    </IntlProvider>,
  );
}

describe("COA searchable multiselect", () => {
  it("searches beyond 200 options and preserves selections outside the search", () => {
    renderPicker({ initial: ["id-1"] });
    fireEvent.click(screen.getByRole("combobox", { name: "Cost Centers" }));
    const search = screen.getByRole("textbox", { name: "Search Cost Centers" });
    fireEvent.change(search, { target: { value: "CC205" } });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "CC205 — Cost Center 205" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("id-1,id-205");
    fireEvent.change(search, { target: { value: "CC1" } });
    expect(
      screen.getByRole("checkbox", { name: "CC1 — Cost Center 1" }),
    ).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("id-1,id-205");
  });

  it("keeps all 205 explicit selections and shows a compact summary", () => {
    renderPicker({ initial: options.map((item) => item.value) });
    expect(
      screen.getByRole("combobox", { name: "Cost Centers" }),
    ).toHaveTextContent("205 items selected");
    expect(screen.getByRole("button", { name: "+202" })).toBeInTheDocument();
    expect(screen.getByRole("status").textContent?.split(",")).toHaveLength(
      205,
    );
    fireEvent.click(screen.getByRole("button", { name: "+202" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(205);
  });

  it("keeps a selected item visible when it is missing from the current master", () => {
    renderPicker({ initial: ["old"] });
    fireEvent.click(screen.getByRole("combobox", { name: "Cost Centers" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "old — Unavailable item" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("allows one default only and replaces the previous selection", () => {
    renderPicker({ initial: ["id-1"], single: true });
    fireEvent.click(screen.getByRole("combobox", { name: "Cost Centers" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search Cost Centers" }),
      { target: { value: "CC205" } },
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "CC205 — Cost Center 205" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/^id-205$/);
  });

  it("allows inspection of saved selections in read-only mode", () => {
    renderPicker({ initial: ["id-1"], readOnly: true });
    fireEvent.click(screen.getByRole("combobox", { name: "Cost Centers" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("uses Thai selection labels", () => {
    render(
      <IntlProvider locale="th" messages={th}>
        <Picker initial={["id-1"]} />
      </IntlProvider>,
    );
    expect(
      screen.getByRole("combobox", { name: "Cost Centers" }),
    ).toHaveTextContent("เลือกแล้ว 1 รายการ");
  });
});

it("clears a default when its allowed List Master item is removed", () => {
  expect(
    updateAllowedValues({ allowedValueIds: ["a", "b"], defaultValueId: "b" }, [
      "a",
    ]),
  ).toEqual({ allowedValueIds: ["a"], defaultValueId: null });
  expect(
    updateAllowedValues({ allowedValueIds: ["a", "b"], defaultValueId: "b" }, [
      "b",
    ]),
  ).toEqual({ allowedValueIds: ["b"], defaultValueId: "b" });
});
