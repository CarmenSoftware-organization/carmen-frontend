import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ListFilterMenu } from "./list-filter-menu";

it("keeps a hovered submenu open when clicking its row, then applies the choice", async () => {
  const setValue = vi.fn();
  render(<IntlProvider locale="en" messages={messages} timeZone="UTC"><ListFilterMenu fields={[{
    key: "status", labelKey: "common.status", control: "status", options: [
      { value: "draft", labelKey: "status.draft" },
      { value: "posted", labelKey: "accounting.arRegister.statuses.posted" },
    ],
  }]} values={{}} setValue={setValue} activeCount={0} /></IntlProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Filter" }));
  const status = screen.getByRole("button", { name: "Status" });
  await user.hover(status);
  expect(screen.getByRole("button", { name: "Draft" })).toBeVisible();
  await user.click(status);
  expect(screen.getByRole("button", { name: "Draft" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Draft" }));
  expect(setValue).toHaveBeenCalledWith("status", "draft");
});
