import { beforeEach, describe, expect, it } from "vitest";
import {
  canChangeFolio,
  filterFolios,
  FOLIO_SAMPLES,
  folioSummary,
  readFolioSamples,
  saveFolioSamples,
} from "./ar-folio-model";

beforeEach(() => sessionStorage.clear());

describe("Folio staging rules", () => {
  it("allows changes only before any invoice has been created", () => {
    expect(FOLIO_SAMPLES.map(canChangeFolio)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(
      canChangeFolio({
        ...FOLIO_SAMPLES[0],
        invoices: FOLIO_SAMPLES[1].invoices,
      }),
    ).toBe(false);
  });

  it("counts billed invoice amounts without treating voided totals as billed", () => {
    expect(folioSummary(FOLIO_SAMPLES)).toEqual({
      count: 4,
      total: 19260,
      unbilled: 7490,
      billed: 10700,
    });
    expect(
      folioSummary([{ ...FOLIO_SAMPLES[0], status: "void", unbilled: 0 }]),
    ).toEqual({ count: 1, total: 2140, unbilled: 0, billed: 0 });
  });

  it("defaults to Pending and combines search, type and date filters", () => {
    expect(filterFolios(FOLIO_SAMPLES, "", {})).toHaveLength(2);
    expect(
      filterFolios(FOLIO_SAMPLES, "G:1040", {
        status: "all",
        type: "credit_card",
        date: "folio_date|date_range:2026-08-27,2026-08-27",
      }),
    ).toEqual([FOLIO_SAMPLES[2]]);
    expect(
      filterFolios(FOLIO_SAMPLES, "G:1040", { status: "pending" }),
    ).toEqual([]);
    expect(
      filterFolios(FOLIO_SAMPLES, "posting error", { status: "void" }),
    ).toEqual([FOLIO_SAMPLES[3]]);
  });

  it("retains session edits after reloading without sharing them across BUs", () => {
    saveFolioSamples("BU-A", [
      { ...FOLIO_SAMPLES[0], status: "void", unbilled: 0 },
    ]);
    expect(readFolioSamples("BU-A")[0].status).toBe("void");
    expect(readFolioSamples("BU-B")).toEqual(FOLIO_SAMPLES);
  });
});
