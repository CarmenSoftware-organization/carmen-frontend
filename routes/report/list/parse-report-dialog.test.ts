import { describe, expect, it } from "vitest";
import { flattenFields, parseReportDialog, resolveNoteText } from "./parse-report-dialog";

// Stock Card / Inventory Balance: ป้ายของทั้งสองฝั่ง ("Location From" / "Location To") — เคยขึ้นเป็นสี่แถวแยกกัน
const CURRENT_DIALOG = `<Dialog>
  <Label Text="Date From"/><Date Name="DateFrom"/>
  <Label Text="Date To"/><Date Name="DateTo"/>
  <Label Text="Location From"/><Lookup Name="LocationFrom" DataSource="@location_list"/>
  <Label Text="Location To"/><Lookup Name="LocationTo" DataSource="@location_list"/>
  <Label Text="Group By"/><Lookup Name="GroupBy" Items="Product~Location" Values="Product~Location"/>
</Dialog>`;

describe("parseReportDialog", () => {
  it("pairs <X>From with <X>To into one range, whatever the second label says", () => {
    const { cells: fields } = parseReportDialog(CURRENT_DIALOG);

    expect(fields.map((f) => f.kind)).toEqual(["range", "range", "single"]);
    expect(fields[0]).toMatchObject({
      label: "Date From",
      from: { name: "DateFrom" },
      to: { name: "DateTo" },
    });
    expect(fields[1]).toMatchObject({
      label: "Location From",
      from: { name: "LocationFrom", dataSource: "location" },
      to: { name: "LocationTo", dataSource: "location" },
    });
  });

  it("does not pair controls of different fields", () => {
    const { cells: fields } = parseReportDialog(`<Dialog>
      <Label Text="Product From"/><Lookup Name="ProductFrom" DataSource="@product_list"/>
      <Label Text="Location To"/><Lookup Name="LocationTo" DataSource="@location_list"/>
    </Dialog>`);

    expect(fields.map((f) => f.kind)).toEqual(["single", "single"]);
  });

  it("still pairs the legacy layout with a hidden second label", () => {
    const { cells: fields } = parseReportDialog(`<Dialog>
      <Label Text="Vendor"/><Lookup Name="VendorFrom" DataSource="@vendor_list"/>
      <Label Text="to" Visible="false"/><Lookup Name="VendorTo" DataSource="@vendor_list"/>
    </Dialog>`);

    expect(fields).toEqual([
      expect.objectContaining({ kind: "range", label: "Vendor" }),
    ]);
  });

  it("orphan label before a group neither swallows nor shifts the group", () => {
    const { cells } = parseReportDialog(`<Dialog Cols="2">
      <Label Text="Dangling"/>
      <Group ColSpan="2">
        <Label Text="Date From"/><Date Name="DateFrom"/>
        <Label Text="Date To"/><Date Name="DateTo"/>
      </Group>
    </Dialog>`);

    expect(cells).toEqual([
      expect.objectContaining({
        kind: "group",
        colSpan: 2,
        fields: [
          expect.objectContaining({ label: "Date From", control: expect.objectContaining({ name: "DateFrom" }) }),
          expect.objectContaining({ label: "Date To", control: expect.objectContaining({ name: "DateTo" }) }),
        ],
      }),
    ]);
  });

  it("flattenFields includes grouped fields in document order", () => {
    const { cells } = parseReportDialog(`<Dialog>
      <Label Text="A"/><Lookup Name="A" Items="x" Values="x"/>
      <Group><Label Text="B"/><Lookup Name="B" Items="x" Values="x"/></Group>
      <Label Text="C"/><Lookup Name="C" Items="x" Values="x"/>
    </Dialog>`);

    expect(
      flattenFields(cells).map((f) => (f.kind === "single" ? f.control.name : f.from.name)),
    ).toEqual(["A", "B", "C"]);
  });
});

// Slow Moving: วันที่ไม่ใช่ filter (นับจากวันนี้เสมอ) แต่ dialog ต้องบอกว่าวันนี้วันอะไร — <Note> แสดงเฉย ๆ ไม่ส่งไป
describe("<Note> in a report dialog", () => {
  const SLOW_MOVING = `<Dialog>
  <Label Text="Location From"/><Lookup Name="LocationFrom" DataSource="@location_list"/>
  <Label Text="Location To"/><Lookup Name="LocationTo" DataSource="@location_list"/>
  <Label Text="Day"/><Lookup Name="Day" Items="30~60~90~180" Values="30~60~90~180" Value="30"/>
  <Label Text="Group By"/><Lookup Name="GroupBy" Items="Location~Category" Values="Location~Category"/>
  <Note Text="Today = @today"/>
</Dialog>`;

  it("collects the note text and keeps it out of the fields", () => {
    const { cells, notes } = parseReportDialog(SLOW_MOVING);

    expect(notes).toEqual(["Today = @today"]);
    expect(flattenFields(cells).map((f) => f.kind)).toEqual(["range", "single", "single"]);
    expect(cells[1]).toMatchObject({
      label: "Day",
      control: { name: "Day", values: ["30", "60", "90", "180"], value: "30" },
    });
  });

  it("returns no notes when the dialog has none", () => {
    expect(parseReportDialog(CURRENT_DIALOG).notes).toEqual([]);
    expect(parseReportDialog("<NotADialog/>").notes).toEqual([]);
  });

  it("replaces @today with today's date as dd/MM/yyyy", () => {
    expect(resolveNoteText("Today = @today", new Date(2026, 9, 20))).toBe("Today = 20/10/2026");
    expect(resolveNoteText("Today = @today", new Date(2026, 0, 5))).toBe("Today = 05/01/2026");
    expect(resolveNoteText("no token")).toBe("no token");
  });
});

// Slow Moving: Day พิมพ์เองได้ (dashboard ยังเป็น 30/60/90/180) — <TextBox Type="Number">
describe("<TextBox> in a report dialog", () => {
  it("parses a number box as a single field with its default and minimum", () => {
    const { cells } = parseReportDialog(`<Dialog>
  <Label Text="Day"/><TextBox Name="Day" Value="30" Type="Number" Min="1"/>
</Dialog>`);

    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      kind: "single",
      label: "Day",
      control: { type: "text", name: "Day", value: "30", numeric: true, min: 1 },
    });
  });

  it("defaults to a plain text box with minimum 1", () => {
    const { cells } = parseReportDialog(`<Dialog><Label Text="Note"/><TextBox Name="Remark"/></Dialog>`);
    expect(cells[0]).toMatchObject({ control: { type: "text", numeric: false, min: 1, value: "" } });
  });
});
