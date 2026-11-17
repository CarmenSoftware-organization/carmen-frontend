import { beforeEach, expect, it, vi } from "vitest";
import { httpClient } from "@/lib/http-client";
import { readCoaRules } from "./coa-dimension-rules";

vi.mock("@/lib/http-client", () => ({ httpClient: { get: vi.fn() } }));
const response = (data: unknown) => new Response(JSON.stringify(data));
beforeEach(() => vi.resetAllMocks());

it("accepts the empty rule response without pagination", async () => {
  vi.mocked(httpClient.get).mockResolvedValue(
    response({ data: [], success: true }),
  );
  expect(await readCoaRules("BU", "account")).toEqual([]);
});

it("loads all pages and excludes another account if the server ignores its filter", async () => {
  vi.mocked(httpClient.get)
    .mockResolvedValueOnce(
      response({
        data: [{ id: "a", chart_of_accounts_id: "account" }],
        paginate: { pages: 2 },
      }),
    )
    .mockResolvedValueOnce(
      response({
        data: [
          { id: "b", chart_of_accounts_id: "account" },
          { id: "other", chart_of_accounts_id: "other" },
        ],
        paginate: { pages: 2 },
      }),
    );
  expect((await readCoaRules("BU", "account")).map((item) => item.id)).toEqual([
    "a",
    "b",
  ]);
  expect(vi.mocked(httpClient.get).mock.calls[0][0]).toContain(
    "chart_of_accounts_id%7Cstring%3Aaccount",
  );
});

it("does not treat missing rule data as an empty selection", async () => {
  vi.mocked(httpClient.get).mockResolvedValue(response({ success: false }));
  await expect(readCoaRules("BU", "account")).rejects.toThrow(
    "Invalid account dimension rules response",
  );
});
