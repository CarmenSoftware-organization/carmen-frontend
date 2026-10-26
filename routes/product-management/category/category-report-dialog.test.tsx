import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";

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

const { CategoryReportDialog } = await import("./category-report-dialog");

const ALL6 = {
  CategoryFrom: "ALL",
  CategoryTo: "ALL",
  SubCategoryFrom: "ALL",
  SubCategoryTo: "ALL",
  ItemGroupFrom: "ALL",
  ItemGroupTo: "ALL",
};

function renderDialog(mode: "print" | "export" = "print", ok = true) {
  const onSubmit = vi.fn(async () => ok);
  const onOpenChange = vi.fn();
  render(
    <IntlProvider locale="en" messages={en}>
      <CategoryReportDialog
        open
        onOpenChange={onOpenChange}
        mode={mode}
        // รหัสเรียงแบบ byte เหมือนรายงาน: "10" มาก่อน "2" · รหัสซ้ำ (ข้อมูลเก่า) แสดงครั้งเดียว
        categories={[
          { code: "2", name: "Beverage" },
          { code: "10", name: "Spa" },
          { code: "1", name: "Food" },
          { code: "1", name: "Food (dup)" },
        ]}
        subCategories={[
          { code: "11", name: "Seafood" },
          { code: "10", name: "Meat" },
        ]}
        itemGroups={[{ code: "1000", name: "Beef" }]}
        onSubmit={onSubmit}
      />
    </IntlProvider>,
  );
  return { onSubmit, onOpenChange };
}

const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  label: string,
) => {
  await user.click(trigger);
  // the open list is portaled after the triggers, so its entry is the last match
  const matches = await screen.findAllByText(label);
  await user.click(matches[matches.length - 1]);
};

describe("CategoryReportDialog", () => {
  it("ไม่เลือกอะไร = ALL ทั้ง 6 ช่อง แล้วปิดเมื่อพิมพ์สำเร็จ", async () => {
    const { onSubmit, onOpenChange } = renderDialog();
    const user = userEvent.setup();
    expect(screen.getAllByRole("button", { name: "All" })).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: en.common.print }));

    expect(onSubmit).toHaveBeenCalledWith(ALL6);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("export ไม่สำเร็จ (ไม่มีข้อมูล) dialog ค้างไว้ให้แก้ช่วง", async () => {
    const { onSubmit, onOpenChange } = renderDialog("export", false);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: en.common.export }));

    expect(onSubmit).toHaveBeenCalledWith(ALL6);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: en.common.print })).toBeNull();
  });

  it("ตัวเลือกเรียงรหัสแบบรายงาน (byte) และไม่ซ้ำ", async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "All" })[0]);

    const labels = (await screen.findAllByText(/^\d+ : /)).map(
      (e) => e.textContent,
    );
    expect(labels).toEqual(["1 : Food", "10 : Spa", "2 : Beverage"]);
  });

  it("เลือกฝั่งแรกคัดลอกไปอีกฝั่ง จากนั้นแต่ละฝั่งเป็นอิสระ ส่งรหัสไป", async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();
    const [catFrom] = screen.getAllByRole("button", { name: "All" });

    await pick(user, catFrom, "1 : Food");
    const [, catTo] = screen.getAllByRole("button", { name: "1 : Food" });
    await pick(user, catTo, "2 : Beverage");
    // Sub Category To ก่อน: ฝั่ง From ว่างอยู่จึงได้ค่าเดียวกัน
    const subTo = screen.getAllByRole("button", { name: "All" })[1];
    await pick(user, subTo, "11 : Seafood");

    await user.click(screen.getByRole("button", { name: en.common.print }));
    expect(onSubmit).toHaveBeenCalledWith({
      ...ALL6,
      CategoryFrom: "1",
      CategoryTo: "2",
      SubCategoryFrom: "11",
      SubCategoryTo: "11",
    });
  });

  it("ล้างค่า = กลับเป็น ALL ทั้งหมด", async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();
    await pick(
      user,
      screen.getAllByRole("button", { name: "All" })[4],
      "1000 : Beef",
    );

    await user.click(
      screen.getByRole("button", {
        name: en.productManagement.category.reportReset,
      }),
    );
    await user.click(screen.getByRole("button", { name: en.common.print }));

    expect(onSubmit).toHaveBeenCalledWith(ALL6);
  });
});
