import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printDocument, VENDOR_DETAIL_TEMPLATE_ID } from "../print-document";

vi.mock("@/lib/http-client", () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { httpClient } from "@/lib/http-client";

const BU = "BLAVG";
const DOC_ID = "bf5aefa7-bb4d-45c8-bf11-3ed12782f91f";
const VIEWER_URL = "https://report.example.com/viewer/abc";

function okViewer() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: { viewer_url: VIEWER_URL } }),
  } as unknown as Response;
}

describe("printDocument", () => {
  beforeEach(() => {
    // target: null keeps the call from touching window.open
    vi.mocked(httpClient.get).mockResolvedValue(okViewer());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // SI/SO are stock documents: they live in tb_stock_in/tb_stock_out and print
  // from their own endpoints, NOT from the inventory-adjustment one (that path
  // requires an adjustment_type_id, which a plain stock document has not got).
  it.each([
    ["SI", "stock-ins"],
    ["SO", "stock-outs"],
  ] as const)(
    "routes %s to the %s dedicated endpoint",
    async (type, segment) => {
      const result = await printDocument(BU, type, {
        documentId: DOC_ID,
        target: null,
      });

      expect(httpClient.get).toHaveBeenCalledWith(
        `/api/proxy/api/${BU}/${segment}/${DOC_ID}/print-viewer`,
      );
      expect(result.url).toBe(VIEWER_URL);
    },
  );

  it("appends the BU-configured template as template_id", async () => {
    const templateId = "3b6f9c14-2a7d-4f58-9c31-6d0e5a8b7c21";

    await printDocument(BU, "SI", {
      documentId: DOC_ID,
      templateId,
      target: null,
    });

    expect(httpClient.get).toHaveBeenCalledWith(
      `/api/proxy/api/${BU}/stock-ins/${DOC_ID}/print-viewer?template_id=${templateId}`,
    );
  });

  it("does not send SI to the inventory-adjustment endpoint", async () => {
    await printDocument(BU, "SI", { documentId: DOC_ID, target: null });

    expect(httpClient.get).not.toHaveBeenCalledWith(
      expect.stringContaining("inventory-adjustments"),
    );
  });

  it("surfaces the endpoint status and body when the print fails", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Stock in not found",
    } as unknown as Response);

    await expect(
      printDocument(BU, "SO", { documentId: DOC_ID, target: null }),
    ).rejects.toThrow(/SO \(404\).*Stock in not found/);
  });

  // EOP is the one type left with no dedicated endpoint, so it still needs a
  // template and falls through to the generic viewer.
  it("throws for EOP when no print form is configured", async () => {
    await expect(
      printDocument(BU, "EOP", { documentId: DOC_ID, target: null }),
    ).rejects.toThrow("No print form configured for EOP");
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  // Vendor Detail Report: master data, no dedicated endpoint — the vendor page passes the
  // form template and the vendor's own code as the range
  it("prints a vendor through the generic viewer with its code as the range", async () => {
    vi.mocked(httpClient.post).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { url: VIEWER_URL } }),
    } as unknown as Response);

    const result = await printDocument(BU, "VENDOR", {
      templateId: VENDOR_DETAIL_TEMPLATE_ID,
      filters: { VendorFrom: "A023", VendorTo: "A023", Status: "ALL" },
      target: null,
    });

    expect(httpClient.get).not.toHaveBeenCalled();
    expect(httpClient.post).toHaveBeenCalledWith(`/api/proxy/api/${BU}/reports/viewer`, {
      template_id: VENDOR_DETAIL_TEMPLATE_ID,
      filters: { VendorFrom: "A023", VendorTo: "A023", Status: "ALL" },
    });
    expect(result.url).toBe(VIEWER_URL);
  });
});
