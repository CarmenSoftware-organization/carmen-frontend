import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { DimensionDialog } from "./dimension-page";
import { httpClient } from "@/lib/http-client";

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));
vi.mock("@/lib/http-client", () => ({
  httpClient: { post: vi.fn(), put: vi.fn() },
}));

describe("Dimension with sub-values", () => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { value: () => false, configurable: true },
    setPointerCapture: { value: () => {}, configurable: true },
    releasePointerCapture: { value: () => {}, configurable: true },
    scrollIntoView: { value: () => {}, configurable: true },
  });
  it("retains saved IDs after a partial failure so retry does not create duplicates", async () => {
    const master = {
      id: "dimension",
      code: "project",
      name: "Project",
      sequence: 1,
      is_active: true,
      doc_version: 1,
    };
    const onSave = vi.fn().mockResolvedValue(master);
    const onOpenChange = vi.fn();
    vi.mocked(httpClient.post)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "first", doc_version: 1 } })),
      )
      .mockRejectedValueOnce(new Error("Second value failed"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { id: "second", doc_version: 1 } }),
        ),
      );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <IntlProvider locale="en" messages={en}>
          <DimensionDialog
            open
            item={null}
            onSave={onSave}
            onOpenChange={onOpenChange}
          />
        </IntlProvider>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(/Dimension Code/), {
      target: { value: "project" },
    });
    fireEvent.change(screen.getByLabelText(/Dimension Name \(EN\)/), {
      target: { value: "Project" },
    });
    await userEvent.click(screen.getByRole("combobox", { name: /Data Type/ }));
    await userEvent.click(
      screen.getByRole("option", {
        name: "List (Master List Code & Description)",
      }),
    );
    for (const code of ["A", "B"]) {
      fireEvent.click(screen.getByRole("button", { name: "Add Value" }));
      const codes = screen.getAllByLabelText(/^Code/);
      const names = screen.getAllByLabelText(/^Name \(EN\)/);
      fireEvent.change(codes[codes.length - 1], { target: { value: code } });
      fireEvent.change(names[names.length - 1], { target: { value: code } });
    }
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Second value failed",
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSave.mock.calls[1][1]).toEqual(master);
    expect(httpClient.post).toHaveBeenCalledTimes(3);
    expect(
      vi.mocked(httpClient.post).mock.calls.map((call) => call[1]),
    ).toEqual([
      expect.objectContaining({ code: "A", gl_dimension_id: "dimension" }),
      expect.objectContaining({ code: "B", gl_dimension_id: "dimension" }),
      expect.objectContaining({ code: "B", gl_dimension_id: "dimension" }),
    ]);
  });
  it("shows list items only for List, and date format only for Date", async () => {
    const onSave = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <IntlProvider locale="en" messages={en}>
          <DimensionDialog
            open
            item={null}
            onSave={onSave}
            onOpenChange={() => {}}
          />
        </IntlProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: "Add Value" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /Date Format/ })).toBeNull();
    await userEvent.click(screen.getByRole("combobox", { name: /Data Type/ }));
    await userEvent.click(screen.getByRole("option", { name: "Date" }));
    expect(screen.getByRole("combobox", { name: /Date Format/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Add Value" })).toBeNull();
    await userEvent.click(screen.getByRole("combobox", { name: /Data Type/ }));
    await userEvent.click(
      screen.getByRole("option", {
        name: "List (Master List Code & Description)",
      }),
    );
    expect(screen.queryByRole("combobox", { name: /Date Format/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Add Value" })).toBeDefined();
  });
});
