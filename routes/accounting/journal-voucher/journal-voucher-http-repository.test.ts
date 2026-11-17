import { describe, expect, it, vi, beforeEach } from "vitest";
import { httpJournalVoucherRepository } from "./journal-voucher-http-repository";
import { httpClient } from "@/lib/http-client";

vi.mock("@/lib/http-client", () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

function mockResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    json: async () => data,
  } as unknown as Response;
}

describe("httpJournalVoucherRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads saved line dimensions from the detail API", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (url: string) =>
      mockResponse(
        url.includes("cost-centers")
          ? { data: [] }
          : {
              data: {
                id: "44444444-4444-4444-4444-444444444444",
                tb_gl_jv_detail: [
                  {
                    id: "line-1",
                    tb_gl_jv_detail_dimension: [
                      {
                        gl_dimension_id: "66666666-6666-6666-6666-666666666666",
                        gl_dimension_value_id:
                          "77777777-7777-7777-7777-777777777777",
                      },
                    ],
                  },
                ],
              },
            },
      ),
    );

    const voucher = await httpJournalVoucherRepository.get(
      "CARMEN-AVG",
      "44444444-4444-4444-4444-444444444444",
    );

    expect(voucher?.lines[0].dimension).toEqual([
      {
        dimension_id: "66666666-6666-6666-6666-666666666666",
        dimension_value_id: "77777777-7777-7777-7777-777777777777",
      },
    ]);
  });

  describe("create", () => {
    it("constructs payload matching Swagger GlJvCreateRequestDto specification", async () => {
      vi.mocked(httpClient.get).mockImplementation(async (url: string) => {
        if (url.includes("gl-jv-prefixes")) {
          return mockResponse([
            { id: "11111111-1111-1111-1111-111111111111", code: "AJ" },
          ]);
        }
        if (url.includes("chart-of-accounts")) {
          return mockResponse({
            data: [
              {
                id: "22222222-2222-2222-2222-222222222222",
                code: "51001",
                is_active: true,
              },
              {
                id: "33333333-3333-3333-3333-333333333333",
                code: "21100",
                is_active: true,
              },
            ],
          });
        }
        return mockResponse(null, false);
      });

      vi.mocked(httpClient.post).mockResolvedValueOnce(
        mockResponse({
          success: true,
          data: {
            id: "44444444-4444-4444-4444-444444444444",
            jv_no: "JV-2026-09-00001",
            doc_version: 1,
            draft_reference: "DRAFT-01",
          },
        }),
      );

      const result = await httpJournalVoucherRepository.create("CARMEN-AVG", {
        journal_type: "general",
        prefix: "AJ",
        journal_date: "2026-09-29T10:00:00.000Z",
        description: "Office electricity accrual",
        note: "Reviewed by accounting",
        functional_currency_id: "THB",
        source_type: "manual",
        source_id: null,
        source_no: null,
        schedule_post: false,
        scheduled_post_at: null,
        auto_reverse: false,
        reverse_date: null,
        lines: [
          {
            account_id: "51001",
            department_id: "100",
            comment: "Electricity line",
            currency_id: "THB",
            exchange_rate: "1",
            rate_date: null,
            rate_type: null,
            rate_source: null,
            debit: "1500.00",
            credit: "0.00",
            dimension: [
              {
                dimension_id: "66666666-6666-6666-6666-666666666666",
                dimension_value_id: "77777777-7777-7777-7777-777777777777",
              },
            ],
          },
          {
            account_id: "33333333-3333-3333-3333-333333333333",
            department_id: "55555555-5555-5555-5555-555555555555",
            comment: "Payable line",
            currency_id: "THB",
            exchange_rate: "1",
            rate_date: null,
            rate_type: null,
            rate_source: null,
            debit: "0.00",
            credit: "1500.00",
            dimension: [],
          },
        ],
      });

      expect(httpClient.post).toHaveBeenCalledTimes(1);
      const [url, payload] = vi.mocked(httpClient.post).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];

      expect(url).toBe("/api/proxy/api/CARMEN-AVG/gl-jv");
      expect(payload).toEqual({
        prefix_id: "11111111-1111-1111-1111-111111111111",
        jv_date: "2026-09-29T10:00:00.000Z",
        is_adjustment: false,
        description: "Office electricity accrual",
        note: "Reviewed by accounting",
        details: {
          add: [
            {
              sequence_no: 1,
              chart_of_accounts_id: "22222222-2222-2222-2222-222222222222",
              debit: 1500,
              credit: 0,
              exchange_rate: 1,
              description: "Electricity line",
              dimensions: [
                {
                  gl_dimension_id: "66666666-6666-6666-6666-666666666666",
                  gl_dimension_value_id: "77777777-7777-7777-7777-777777777777",
                },
              ],
            },
            {
              sequence_no: 2,
              chart_of_accounts_id: "33333333-3333-3333-3333-333333333333",
              cost_center_id: "55555555-5555-5555-5555-555555555555",
              debit: 0,
              credit: 1500,
              exchange_rate: 1,
              description: "Payable line",
            },
          ],
        },
      });

      expect(result.id).toBe("44444444-4444-4444-4444-444444444444");
      expect(result.jv_no).toBe("JV-2026-09-00001");
    });
  });

  describe("update", () => {
    it("calls PATCH /api/{bu_code}/gl-jv/{id} with doc_version and updatable fields", async () => {
      vi.mocked(httpClient.patch).mockResolvedValueOnce(
        mockResponse({
          success: true,
          data: {
            id: "44444444-4444-4444-4444-444444444444",
            jv_no: "JV-2026-09-00001",
            doc_version: 2,
          },
        }),
      );

      await httpJournalVoucherRepository.update(
        "CARMEN-AVG",
        "44444444-4444-4444-4444-444444444444",
        1,
        {
          journal_type: "general",
          prefix: "AJ",
          journal_date: "2026-09-30T00:00:00.000Z",
          description: "Updated description",
          note: "Updated note",
          functional_currency_id: "THB",
          source_type: "manual",
          source_id: null,
          source_no: null,
          schedule_post: false,
          scheduled_post_at: null,
          auto_reverse: false,
          reverse_date: null,
          lines: [],
        },
      );

      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      const [url, patchPayload] = vi.mocked(httpClient.patch).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(url).toBe(
        "/api/proxy/api/CARMEN-AVG/gl-jv/44444444-4444-4444-4444-444444444444",
      );
      expect(patchPayload).toEqual({
        doc_version: 1,
        jv_date: "2026-09-30T00:00:00.000Z",
        description: "Updated description",
        note: "Updated note",
      });
    });

    it("sends the full line set as details.replace", async () => {
      vi.mocked(httpClient.patch).mockResolvedValueOnce(
        mockResponse({
          success: true,
          data: {
            id: "44444444-4444-4444-4444-444444444444",
            jv_no: "JV-2026-09-00001",
            doc_version: 2,
          },
        }),
      );

      await httpJournalVoucherRepository.update(
        "CARMEN-AVG",
        "44444444-4444-4444-4444-444444444444",
        1,
        {
          journal_type: "general",
          prefix: "AJ",
          journal_date: "2026-09-30T00:00:00.000Z",
          description: "Updated description",
          note: "Updated note",
          functional_currency_id: "THB",
          source_type: "manual",
          source_id: null,
          source_no: null,
          schedule_post: false,
          scheduled_post_at: null,
          auto_reverse: false,
          reverse_date: null,
          lines: [
            {
              account_id: "22222222-2222-2222-2222-222222222222",
              department_id: "99999999-9999-9999-9999-999999999999",
              comment: "Line 1 comment",
              currency_id: "THB",
              exchange_rate: "1",
              rate_date: null,
              rate_type: null,
              rate_source: null,
              debit: "2000.00",
              credit: "0.00",
              dimension: [],
            },
            {
              account_id: "33333333-3333-3333-3333-333333333333",
              department_id: "88888888-8888-8888-8888-888888888888",
              comment: "Line 2 comment",
              currency_id: "THB",
              exchange_rate: "1",
              rate_date: null,
              rate_type: null,
              rate_source: null,
              debit: "0.00",
              credit: "2000.00",
              dimension: [],
            },
          ],
        },
      );

      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      const [, patchPayload] = vi.mocked(httpClient.patch).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];

      expect(patchPayload).toEqual({
        doc_version: 1,
        jv_date: "2026-09-30T00:00:00.000Z",
        description: "Updated description",
        note: "Updated note",
        details: {
          replace: [
            {
              sequence_no: 1,
              chart_of_accounts_id: "22222222-2222-2222-2222-222222222222",
              cost_center_id: "99999999-9999-9999-9999-999999999999",
              debit: 2000,
              credit: 0,
              exchange_rate: 1,
              description: "Line 1 comment",
            },
            {
              sequence_no: 2,
              chart_of_accounts_id: "33333333-3333-3333-3333-333333333333",
              cost_center_id: "88888888-8888-8888-8888-888888888888",
              debit: 0,
              credit: 2000,
              exchange_rate: 1,
              description: "Line 2 comment",
            },
          ],
        },
      });
    });
  });
});
