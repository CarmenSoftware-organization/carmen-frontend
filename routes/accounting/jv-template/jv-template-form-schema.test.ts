import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "@/lib/http-client";
import { jvTemplateRepository } from "./jv-template-repository";
import {
  createJvTemplateFormSchema,
  getJvTemplateDefaultValues,
  toJvTemplateInput,
} from "./jv-template-form-schema";

vi.mock("@/lib/http-client", () => ({
  httpClient: { get: vi.fn(), patch: vi.fn() },
}));

const currencyId = "00000000-0000-4000-8000-000000000005";
const apiDocument = {
  id: "00000000-0000-4000-8000-000000000001",
  doc_version: 1,
  template_type: "recurring",
  code: "MONTHLY",
  name: "Monthly template",
  is_active: true,
  prefix_id: "00000000-0000-4000-8000-000000000002",
  from_fiscal_year: 2026,
  from_period_no: 1,
  to_fiscal_year: 2026,
  to_period_no: 12,
  frequency_months: 1,
  tb_gl_jv_template_detail: [
    {
      sequence_no: 1,
      chart_of_accounts_id: "00000000-0000-4000-8000-000000000003",
      debit: "100",
      credit: "0",
      currency_id: currencyId,
      exchange_rate: "2.5",
    },
    {
      sequence_no: 2,
      chart_of_accounts_id: "00000000-0000-4000-8000-000000000004",
      debit: "0",
      credit: "100",
    },
  ],
};

const schema = createJvTemplateFormSchema(
  (key) => key,
  (key) => key,
);

beforeEach(() => {
  vi.mocked(httpClient.get).mockResolvedValue(
    new Response(JSON.stringify({ data: apiDocument })),
  );
  vi.mocked(httpClient.patch).mockResolvedValue(new Response("{}"));
});

describe("JV template line metadata round trip", () => {
  it("keeps API line currency and rate when editing only the template name", async () => {
    const template = await jvTemplateRepository.get("BU", apiDocument.id);
    const values = getJvTemplateDefaultValues(template, "recurring");
    values.name = "Renamed template";
    const input = toJvTemplateInput(schema.parse(values));
    await jvTemplateRepository.update(
      "BU",
      template.id,
      template.doc_version,
      input,
    );

    const payload = vi.mocked(httpClient.patch).mock.calls.at(-1)?.[1] as {
      details: { add: Record<string, unknown>[] };
    };
    expect(payload.details.add[0]).toMatchObject({
      currency_id: currencyId,
      exchange_rate: 2.5,
    });
    expect(payload.details.add[1]).not.toHaveProperty("currency_id");
    expect(payload.details.add[1]).not.toHaveProperty("exchange_rate");
  });

  it("preserves explicit null metadata without adding keys to other lines", async () => {
    const template = await jvTemplateRepository.get("BU", apiDocument.id);
    template.lines[0].currency_id = null;
    template.lines[0].exchange_rate = null;
    const values = getJvTemplateDefaultValues(template, "recurring");
    const input = toJvTemplateInput(schema.parse(values));

    expect(input.lines[0]).toMatchObject({
      currency_id: null,
      exchange_rate: null,
    });
    expect(input.lines[1]).not.toHaveProperty("currency_id");
    expect(input.lines[1]).not.toHaveProperty("exchange_rate");
  });
});
