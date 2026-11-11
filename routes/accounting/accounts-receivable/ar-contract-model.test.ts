import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteContractSample,
  nextContractNo,
  readContractSamples,
  saveContractSample,
} from "./ar-contract-model";

beforeEach(() => sessionStorage.clear());

describe("Contract sample persistence", () => {
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
