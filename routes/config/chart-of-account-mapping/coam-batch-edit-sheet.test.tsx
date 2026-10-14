import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import type { AccountMappingRow } from "@/types/chart-of-account-mapping";
import { CoamBatchEditSheet } from "./coam-batch-edit-sheet";

const mutate = vi.fn();
const errorToast = vi.fn();
let isPending = false;

vi.mock("./use-account-mapping", () => ({
  useBatchUpdateAccountMapping: () => ({ mutate, isPending }),
}));
vi.mock("@/hooks/use-error-toast", () => ({
  useErrorToast: () => errorToast,
}));
// stand-in: ปุ่มเดียวที่เลือกค่าคงที่
vi.mock("@/components/lookup/lookup-cost-center", () => ({
  LookupCostCenter: ({
    onValueChange,
  }: {
    onValueChange: (id: string | null) => void;
  }) => (
    <button type="button" onClick={() => onValueChange("cc-1")}>
      pick-cc
    </button>
  ),
}));
vi.mock("@/components/lookup/lookup-chart-of-account", () => ({
  LookupChartOfAccount: ({
    onValueChange,
  }: {
    onValueChange: (code: string) => void;
  }) => (
    <button type="button" onClick={() => onValueChange("111000")}>
      pick-account
    </button>
  ),
}));

const makeRow = (
  id: string,
  locCode: string,
  movement: AccountMappingRow["movement"] = "grn",
): AccountMappingRow =>
  ({
    id,
    doc_version: Number(id.replace(/\D/g, "")) || 1,
    movement,
    location: { id: `l-${locCode}`, code: locCode, name: locCode },
  }) as unknown as AccountMappingRow;

const rows = [makeRow("r1", "LOC1"), makeRow("r2", "LOC2")];

function setup(
  r: AccountMappingRow[] = rows,
  onDone = vi.fn(),
  onClose = vi.fn(),
) {
  const user = userEvent.setup();
  render(
    <IntlProvider locale="en" messages={en}>
      <CoamBatchEditSheet rows={r} open onClose={onClose} onDone={onDone} />
    </IntlProvider>,
  );
  const group = (name: string) => screen.getByRole("radiogroup", { name });
  const choose = (name: string, label: string) =>
    user.click(within(group(name)).getByRole("radio", { name: label }));
  const saveBtn = () => screen.getByRole("button", { name: "Save" });
  return { user, onDone, onClose, choose, saveBtn };
}

beforeEach(() => {
  mutate.mockReset();
  errorToast.mockReset();
  isPending = false;
});

describe("CoamBatchEditSheet", () => {
  it("แสดงจำนวนแถวในหัว sheet", () => {
    setup();
    expect(screen.getByText("Edit 2 rows")).toBeInTheDocument();
  });

  it("ปิดปุ่มบันทึกเมื่อทุกช่อง 'ไม่เปลี่ยน'", () => {
    const { saveBtn } = setup();
    expect(saveBtn()).toBeDisabled();
  });

  it("ปิดปุ่มบันทึกเมื่อเลือก 'Set to' แต่ยังไม่ได้เลือกค่า", async () => {
    const { choose, saveBtn } = setup();
    await choose("Cost center", "Set to");
    expect(saveBtn()).toBeDisabled();
    await choose("Account", "Set to");
    expect(saveBtn()).toBeDisabled();
  });

  it("เปิดปุ่มบันทึกเมื่อเลือก reset", async () => {
    const { choose, saveBtn } = setup();
    await choose("Account", "Use default");
    expect(saveBtn()).toBeEnabled();
  });

  it("ปิดปุ่มบันทึกขณะ pending", async () => {
    isPending = true;
    const { choose, saveBtn } = setup();
    await choose("Account", "Use default");
    expect(saveBtn()).toBeDisabled();
  });

  it("ปิดปุ่มบันทึกเมื่อไม่มีแถว", async () => {
    const { choose, saveBtn } = setup([]);
    await choose("Account", "Use default");
    expect(saveBtn()).toBeDisabled();
  });

  const items = [
    { id: "r1", doc_version: 1 },
    { id: "r2", doc_version: 2 },
  ];

  it("set cost center + keep account -> ส่งเฉพาะ cost_center_id", async () => {
    const { user, choose, saveBtn } = setup();
    await choose("Cost center", "Set to");
    await user.click(screen.getByText("pick-cc"));
    await user.click(saveBtn());
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toStrictEqual({
      items,
      cost_center_id: "cc-1",
    });
  });

  it("keep cost center + set account -> ส่งเฉพาะ account_code", async () => {
    const { user, choose, saveBtn } = setup();
    await choose("Account", "Set to");
    await user.click(screen.getByText("pick-account"));
    await user.click(saveBtn());
    expect(mutate.mock.calls[0][0]).toStrictEqual({
      items,
      account_code: "111000",
    });
  });

  it("reset cost center -> cost_center_id เป็น null และไม่มี account_code", async () => {
    const { user, choose, saveBtn } = setup();
    await choose("Cost center", "Use default");
    await user.click(saveBtn());
    const body = mutate.mock.calls[0][0];
    expect(body).toStrictEqual({ items, cost_center_id: null });
    expect("account_code" in body).toBe(false);
  });

  it("reset account -> account_code เป็น null และไม่มี cost_center_id", async () => {
    const { user, choose, saveBtn } = setup();
    await choose("Account", "Use default");
    await user.click(saveBtn());
    const body = mutate.mock.calls[0][0];
    expect(body).toStrictEqual({ items, account_code: null });
    expect("cost_center_id" in body).toBe(false);
  });

  it("set ทั้งสองช่อง", async () => {
    const { user, choose, saveBtn } = setup();
    await choose("Cost center", "Set to");
    await user.click(screen.getByText("pick-cc"));
    await choose("Account", "Set to");
    await user.click(screen.getByText("pick-account"));
    await user.click(saveBtn());
    expect(mutate.mock.calls[0][0]).toStrictEqual({
      items,
      cost_center_id: "cc-1",
      account_code: "111000",
    });
  });

  it("set cost center + reset account", async () => {
    const { user, choose, saveBtn } = setup();
    await choose("Cost center", "Set to");
    await user.click(screen.getByText("pick-cc"));
    await choose("Account", "Use default");
    await user.click(saveBtn());
    expect(mutate.mock.calls[0][0]).toStrictEqual({
      items,
      cost_center_id: "cc-1",
      account_code: null,
    });
  });

  it("reset ทั้งสองช่อง", async () => {
    const { user, choose, saveBtn } = setup();
    await choose("Cost center", "Use default");
    await choose("Account", "Use default");
    await user.click(saveBtn());
    expect(mutate.mock.calls[0][0]).toStrictEqual({
      items,
      cost_center_id: null,
      account_code: null,
    });
  });

  it("onSuccess -> เรียก onDone พร้อมผลลัพธ์", async () => {
    const { user, choose, saveBtn, onDone } = setup();
    await choose("Account", "Use default");
    await user.click(saveBtn());
    const result = { updated: [], conflicts: ["r1"], not_found: [] };
    mutate.mock.calls[0][1].onSuccess(result);
    expect(onDone).toHaveBeenCalledWith(result);
    expect(errorToast).not.toHaveBeenCalled();
  });

  it("onError -> errorToast และไม่เรียก onDone", async () => {
    const { user, choose, saveBtn, onDone } = setup();
    await choose("Account", "Use default");
    await user.click(saveBtn());
    const err = new Error("422");
    mutate.mock.calls[0][1].onError(err);
    expect(errorToast).toHaveBeenCalledWith(err);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("สรุป location ไม่เกิน 3 แล้วต่อด้วย +N", () => {
    const many = ["A", "B", "C", "D", "E"].map((c, i) => makeRow(`r${i}`, c));
    setup(many);
    expect(screen.getByText(/Locations: A, B, C \+2 ·/)).toBeInTheDocument();
  });

  it("สรุป location ซ้ำนับเป็นค่าเดียว และ movement แสดงเป็นป้าย", () => {
    setup([makeRow("r1", "A"), makeRow("r2", "A"), makeRow("r3", "B", "cn")]);
    expect(screen.getByText(/Locations: A, B ·/)).toBeInTheDocument();
    expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
  });
});
