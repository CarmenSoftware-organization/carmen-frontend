import { beforeEach, describe, expect, it } from "vitest";
import {
  contractAmount,
  contractLineError,
  deleteContractSample,
  nextContractNo,
  readContractSamples,
  saveContractSample,
} from "./ar-contract-model";
import type { ArDraftLine } from "./ar-invoice-draft-model";

beforeEach(() => sessionStorage.clear());

describe("Contract sample persistence", () => {
  const completeLine: ArDraftLine = {
    id: "line-1",
    sequence_no: 4,
    quantity: 2,
    unit_price: 500,
    discount_pct: 10,
    cr_chart_of_accounts_id: "revenue",
    cr_cost_center_id: "rooms",
    dr_chart_of_accounts_id: "receivable",
    dr_cost_center_id: "general",
    vat_rate: 7,
    vat_chart_of_accounts_id: "vat",
    vat_cost_center_id: "general",
    reference_info: "Booking A\nGuest B",
    date_from: "2026-01-01",
    date_to: "2026-01-31",
    dimensions: [
      { gl_dimension_id: "department", gl_dimension_value_id: "rooms" },
    ],
  };

  it("saves complete contract lines and derives the header amount instead of trusting an entered total", () => {
    const original = readContractSamples("A").records[0];
    const saved = saveContractSample("A", {
      ...original,
      amount: 999999,
      lines: [completeLine],
      documents: [
        {
          name: "Agreement.pdf",
          mime: "application/pdf",
          data: "data:application/pdf;base64,QQ==",
        },
      ],
    });
    expect(saved.records[0].amount).toBe(963);
    const restored = readContractSamples("A").records[0];
    expect(restored.lines).toEqual([{ ...completeLine, sequence_no: 1 }]);
    expect(restored.documents?.[0].name).toBe("Agreement.pdf");
    expect(contractAmount(restored)).toBe(963);
    expect(contractAmount({ amount: 963, lines: [] })).toBe(0);
  });

  it("requires both posting sides, tax mappings and valid contract line amounts", () => {
    expect(contractLineError([])).toBe("lineRequired");
    expect(contractLineError([completeLine])).toBeUndefined();
    expect(
      contractLineError([{ ...completeLine, dr_cost_center_id: null }]),
    ).toBe("lineAccountsRequired");
    expect(
      contractLineError([{ ...completeLine, vat_chart_of_accounts_id: null }]),
    ).toBe("lineTaxAccountsRequired");
    expect(contractLineError([{ ...completeLine, discount_pct: 101 }])).toBe(
      "lineAmountsInvalid",
    );
    expect(contractLineError([{ ...completeLine, unit_price: "" }])).toBe(
      "lineAmountsInvalid",
    );
    expect(
      contractLineError([{ ...completeLine, date_to: "2025-01-01" }]),
    ).toBe("dateOrder");
    expect(
      contractLineError([
        { ...completeLine, vat_rate: 0, vat_chart_of_accounts_id: null },
      ]),
    ).toBeUndefined();
  });
  it("numbers by start year and keeps the sequence after edits and deletions", () => {
    const original = readContractSamples("A").records[0];
    const saved = saveContractSample("A", {
      ...original,
      id: "new",
      contractNo: "",
      startDate: "2027-01-01",
    });
    const created = saved.records[1];
    expect(created.contractNo).toBe("202700001");
    const edited = saveContractSample("A", {
      ...created,
      description: "Updated",
      startDate: "2028-01-01",
    });
    expect(edited.records[1].contractNo).toBe("202700001");
    const deleted = deleteContractSample("A", created.id);
    expect(nextContractNo(deleted, "2027-01-01")).toBe("202700002");
    expect(readContractSamples("A").records).toHaveLength(1);
  });

  it("keeps an explicitly emptied list and isolates samples between business units", () => {
    const original = readContractSamples("A").records[0];
    deleteContractSample("A", original.id);
    expect(readContractSamples("A").records).toEqual([]);
    expect(nextContractNo(readContractSamples("A"), "2026-01-01")).toBe(
      "202600002",
    );
    expect(readContractSamples("B").records).toEqual([original]);
  });

  it("migrates user contracts from the retired preview only into the first BU", () => {
    sessionStorage.setItem(
      "carmen.ar-preview.customer-master.v1",
      JSON.stringify({
        profiles: [{ id: "customer", code: "C1", name: "Existing Customer" }],
        contracts: [
          {
            id: "existing",
            code: "CUSTOM-CONTRACT",
            name: "Existing",
            profileId: "customer",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
            amount: 1000,
          },
        ],
      }),
    );
    expect(readContractSamples("A").records[0]).toMatchObject({
      id: "existing",
      contractNo: "CUSTOM-CONTRACT",
      customerCode: "C1",
      customerName: "Existing Customer",
      amount: 1000,
    });
    expect(readContractSamples("B").records[0].id).toBe("sample-contract-1");
    expect(readContractSamples("A").records[0].contractNo).toBe(
      "CUSTOM-CONTRACT",
    );
  });
});
