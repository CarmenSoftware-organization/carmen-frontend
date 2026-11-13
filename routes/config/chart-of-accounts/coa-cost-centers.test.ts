import { beforeEach, expect, it, vi } from "vitest";
import { httpClient } from "@/lib/http-client";
import {
  readCoaCostCenters,
  saveCoaCostCenters,
  type CoaCostCenter,
} from "./coa-cost-centers";

vi.mock("@/lib/http-client", () => ({
  httpClient: { get: vi.fn(), put: vi.fn() },
}));
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
let rows: CoaCostCenter[];
let required: boolean;

beforeEach(() => {
  vi.resetAllMocks();
  required = true;
  rows = [
    {
      id: "cc-1",
      code: "CC1",
      name: "First",
      accounts: [{ chart_of_accounts_id: "other" }],
    },
    {
      id: "cc-2",
      code: "CC2",
      name: "Second",
      accounts: [
        { chart_of_accounts_id: "other" },
        { chart_of_accounts_id: "account" },
      ],
    },
  ];
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    if (url.includes("chart-of-accounts/account"))
      return response({ data: { is_require_cost_center: required } });
    const row = rows.find((item) => url.endsWith(`/${item.id}`));
    return row
      ? response({ data: row })
      : response({ data: rows, paginate: { pages: 1 } });
  });
  vi.mocked(httpClient.put).mockImplementation(async (url, body) => {
    const row = rows.find((item) => url.endsWith(`/${item.id}/accounts`))!;
    row.accounts = (
      body as { chart_of_accounts_ids: string[] }
    ).chart_of_accounts_ids.map((chart_of_accounts_id) => ({
      chart_of_accounts_id,
    }));
    return response({ data: { id: row.id, accounts: row.accounts.length } });
  });
});

it("adds/removes only the edited account, preserves other accounts and verifies readback", async () => {
  await saveCoaCostCenters("BU", "account", ["CC1"], true);
  expect(httpClient.put).toHaveBeenCalledWith(
    expect.stringContaining("cc-1/accounts"),
    { chart_of_accounts_ids: ["other", "account"] },
  );
  expect(httpClient.put).toHaveBeenCalledWith(
    expect.stringContaining("cc-2/accounts"),
    { chart_of_accounts_ids: ["other"] },
  );
  expect(
    rows.every((item) =>
      item.accounts.some((account) => account.chart_of_accounts_id === "other"),
    ),
  ).toBe(true);
  vi.mocked(httpClient.put).mockClear();
  await saveCoaCostCenters("BU", "account", ["CC1"], true);
  expect(httpClient.put).not.toHaveBeenCalled();
});

it("saves selections while the requirement is off without deleting Cost Centers", async () => {
  required = false;
  await saveCoaCostCenters("BU", "account", ["CC1", "CC2"], false);
  expect(rows).toHaveLength(2);
  expect(
    rows.every((row) =>
      row.accounts.some((item) => item.chart_of_accounts_id === "account"),
    ),
  ).toBe(true);
});

it("rejects missing mapping payloads and never treats them as empty mappings", async () => {
  vi.mocked(httpClient.get)
    .mockResolvedValueOnce(response({ data: rows, paginate: { pages: 1 } }))
    .mockResolvedValueOnce(response({ data: { id: "cc-1" } }));
  await expect(readCoaCostCenters("BU")).rejects.toThrow(
    "Invalid Cost Center mappings response",
  );
  expect(httpClient.put).not.toHaveBeenCalled();
});

it("rejects a missing selected Cost Center before changing mappings", async () => {
  await expect(
    saveCoaCostCenters("BU", "account", ["MISSING"], true),
  ).rejects.toThrow("no longer exists");
  expect(httpClient.put).not.toHaveBeenCalled();
});

it("rejects a failed write and a successful HTTP response that did not persist selections", async () => {
  vi.mocked(httpClient.put).mockResolvedValue(
    response({ message: "Rejected" }, 500),
  );
  await expect(
    saveCoaCostCenters("BU", "account", ["CC1"], true),
  ).rejects.toThrow();
  vi.mocked(httpClient.put).mockImplementation(async () => response({ success: true }));
  await expect(
    saveCoaCostCenters("BU", "account", ["CC1"], true),
  ).rejects.toThrow("selections were not fully saved");
});

it("rejects a flag that was silently dropped by the account endpoint", async () => {
  required = false;
  await expect(
    saveCoaCostCenters("BU", "account", ["CC2"], true),
  ).rejects.toThrow("Require Cost Center was not saved");
});
