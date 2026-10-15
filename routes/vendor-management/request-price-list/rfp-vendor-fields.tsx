// Opt out of React Compiler memoization — useFieldArray + dynamic setValue calls
// cause stale closure issues when auto-memoized (ทรงเดียวกับ pr-item-fields).
"use no memo";

import { useMemo, useState } from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { SettingSection } from "@/components/ui/setting-section";
import { countSubmitted } from "./rfp-window";
import { EmptyProducts } from "../price-list/pl-empty-states";
import type { Vendor } from "@/types/vendor";
import type {
  RequestPriceList,
  RequestPriceListVendor,
} from "@/types/request-price-list";
import { toVendorRow, type RfpFormValues } from "./rfp-form-schema";
import {
  ContactValue,
  EmailValue,
  PricelistCell,
  SubmissionStatusBadge,
  VendorActionsCell,
  VendorNameCell,
} from "./rfp-vendor-cells";
import { RfpVendorAddDialog } from "./rfp-vendor-add-dialog";

type VendorRow = RfpFormValues["vendors"][number];

const EMPTY = (
  <span className="text-muted-foreground text-micro italic">—</span>
);

interface RfpVendorFieldsProps {
  readonly form: UseFormReturn<RfpFormValues>;
  readonly requestPriceList?: RequestPriceList;
  readonly isDisabled: boolean;
  readonly isView: boolean;
}

export function RfpVendorFields({
  form,
  requestPriceList,
  isDisabled,
  isView,
}: RfpVendorFieldsProps) {
  const t = useTranslations("vendorManagement.requestPriceList");
  const tfl = useTranslations("field");
  const [isAdding, setIsAdding] = useState(false);

  const {
    fields: vendorRows,
    append,
    remove,
  } = useFieldArray({ control: form.control, name: "vendors" });

  const rfpName = requestPriceList?.name ?? "";
  // คำขอที่ยังไม่ถูกบันทึกไม่มี id — dialog ส่งอีเมลจะปิดปุ่มส่งพร้อมบอกเหตุผลเอง
  const rfpId = requestPriceList?.id;
  const startDate = requestPriceList?.start_date;
  const endDate = requestPriceList?.end_date;

  // ข้อมูลฝั่ง server ที่ไม่ได้อยู่บนฟอร์ม (url_token / has_submitted / pricelist)
  // — หาแบบ by vendor_id ไม่ใช่ index เพราะลำดับแถวขยับได้ระหว่างเพิ่ม-ลบ
  const savedVendors = useMemo(
    () =>
      new Map<string, RequestPriceListVendor>(
        (requestPriceList?.vendors ?? []).map((v) => [v.vendor?.id ?? "", v]),
      ),
    [requestPriceList],
  );

  const selectedVendorIds = new Set(vendorRows.map((v) => v.vendor_id));

  /**
   * รับผู้ขายทีเดียวหลายรายจาก dialog — กันซ้ำในนี้อีกชั้น (dialog ปิดตัวที่มี
   * อยู่แล้วไว้ แต่รายการอาจถูกเพิ่มจากหน้าต่างอื่นระหว่างที่ dialog เปิดค้าง)
   */
  const handleAddVendors = (vendors: Vendor[]) => {
    const current = new Set(form.getValues("vendors").map((v) => v.vendor_id));
    const fresh = vendors.filter((v) => !current.has(v.id));
    if (fresh.length === 0) {
      setIsAdding(false);
      return;
    }

    append(
      fresh.map((vendor) => {
        // คนที่เคยบันทึกไว้แล้วแต่เพิ่งกดลบไปในรอบแก้ไขนี้ = คืนแถวเดิม (id เดิม)
        // ไม่ใช่สร้างแถวใหม่ — ไม่งั้น backend ลบของเดิมทิ้งแล้วสร้างใหม่
        // url_token เปลี่ยน ลิงก์ที่ส่งให้ผู้ขายไปแล้วใช้ไม่ได้
        const saved = savedVendors.get(vendor.id);
        if (saved) return toVendorRow(saved);

        const contacts = vendor.contacts ?? vendor.tb_vendor_contact ?? [];
        const primaryContact = contacts.find((c) => c.is_primary);
        return {
          id: "",
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          vendor_code: vendor.code,
          contact_person: primaryContact?.name ?? "",
          contact_phone: primaryContact?.phone ?? "",
          contact_email: primaryContact?.email ?? "",
          dimension: "",
        };
      }),
    );
    setIsAdding(false);
  };

  const columns = useMemo<ColumnDef<VendorRow>[]>(() => {
    return [
      {
        id: "index",
        size: 44,
        header: () => "#",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.index + 1}
          </span>
        ),
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
      },
      {
        id: "vendor",
        size: 200,
        header: () => tfl("vendor"),
        cell: ({ row }) => (
          <VendorNameCell
            name={row.original.vendor_name}
            code={row.original.vendor_code}
          />
        ),
      },
      {
        id: "contact",
        size: 150,
        header: () => tfl("contactPerson"),
        cell: ({ row }) => <ContactValue value={row.original.contact_person} />,
      },
      {
        id: "phone",
        size: 160,
        header: () => tfl("phone"),
        cell: ({ row }) => <ContactValue value={row.original.contact_phone} />,
      },
      {
        id: "email",
        size: 220,
        header: () => tfl("email"),
        cell: ({ row }) => <EmailValue value={row.original.contact_email} />,
      },
      {
        id: "status",
        size: 120,
        header: () => tfl("status"),
        cell: ({ row }) => {
          const saved = savedVendors.get(row.original.vendor_id);
          return saved ? (
            <SubmissionStatusBadge hasSubmitted={saved.has_submitted} />
          ) : (
            EMPTY
          );
        },
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
      },
      {
        id: "pricelist",
        size: 120,
        header: () => tfl("priceList"),
        cell: ({ row }) => (
          <PricelistCell
            pricelist={
              savedVendors.get(row.original.vendor_id)?.pricelist ?? null
            }
          />
        ),
      },
      {
        id: "actions",
        // สี่ปุ่ม (คัดลอก เปิด ส่งอีเมล ลบ) — 108 พอดีสามปุ่ม ปุ่มที่สี่จะโดนเบียด
        size: 132,
        header: () => null,
        cell: ({ row }) => (
          <VendorActionsCell
            urlToken={savedVendors.get(row.original.vendor_id)?.url_token ?? ""}
            email={row.original.contact_email}
            rfpId={rfpId}
            vendorId={row.original.vendor_id}
            vendorName={row.original.vendor_name ?? ""}
            contactPerson={row.original.contact_person}
            rfpName={rfpName}
            startDate={startDate}
            endDate={endDate}
            isDisabled={isDisabled}
            onRemove={() => remove(row.index)}
          />
        ),
        meta: { headerClassName: "text-center", cellClassName: "text-right" },
      },
    ];
  }, [
    tfl,
    isDisabled,
    remove,
    rfpId,
    rfpName,
    startDate,
    endDate,
    savedVendors,
  ]);

  const table = useReactTable({
    data: vendorRows,
    columns,
    // key ด้วย id ที่ useFieldArray ออกให้ (ไม่ใช่ index) — ลบแถวกลางแล้วแถวที่
    // เลื่อนขึ้นมาต้องไม่หยิบ state ของแถวเดิมที่ index นั้นมาใช้ต่อ
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <SettingSection
      wide
      frameless
      title={t("vendors.title")}
      // โหมดดูไม่มีปุ่มเพิ่ม — คำชวน "Add vendors…" จึงเปลี่ยนเป็นยอดผู้ขายที่ส่งราคามาแล้ว
      description={
        isView
          ? t("vendors.submittedView", {
              submitted: countSubmitted(requestPriceList?.vendors),
              total: vendorRows.length,
            })
          : t("vendors.noVendorsDesc")
      }
      count={vendorRows.length}
      action={
        !isDisabled ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus />
            {t("vendors.addVendor")}
          </Button>
        ) : undefined
      }
    >
      {vendorRows.length === 0 ? (
        <EmptyProducts
          disabled={isDisabled}
          title={t("vendors.noVendors")}
          description={t("vendors.noVendorsDesc")}
        />
      ) : (
        <DataGrid
          table={table}
          recordCount={vendorRows.length}
          tableLayout={{
            headerSticky: true,
            // โหมดอ่านชิดบน — ชื่อผู้ขายมีรหัสเป็นบรรทัดรอง เซลล์อื่นไม่มี
            cellAlign: isDisabled ? "top" : "middle",
          }}
        >
          <DataGridContainer>
            <DataGridTable />
          </DataGridContainer>
        </DataGrid>
      )}

      <RfpVendorAddDialog
        open={isAdding}
        onOpenChange={setIsAdding}
        selectedVendorIds={selectedVendorIds}
        onAdd={handleAddVendors}
      />
    </SettingSection>
  );
}
