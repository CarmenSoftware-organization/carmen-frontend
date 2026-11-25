import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { Store } from "lucide-react";
import {
  type ColumnDef,
  type PaginationState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { indexColumn, selectColumn } from "@/components/ui/data-grid/columns";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import EmptyComponent from "@/components/empty-component";
import SearchInput from "@/components/search-input";
import { useVendor } from "@/hooks/use-vendor";
import type { Vendor } from "@/types/vendor";
import { VendorNameCell } from "./rfp-vendor-cells";

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly selectedVendorIds: Set<string>;
  readonly onAdd: (vendors: Vendor[]) => void;
}

/**
 * Dialog เลือกผู้ขายเข้าคำขอราคา — ติ๊กได้ทีละหลายราย
 *
 * ของเดิมเป็นแถวเลือกทีละรายใต้ตาราง ต้องกด "เพิ่มผู้ขาย" หนึ่งครั้งให้แถวโผล่
 * แล้วค่อยเลือกอีกครั้ง ได้ทีละรายเท่านั้น ขอราคาสิบเจ้าก็ยี่สิบคลิก · ที่แย่กว่า
 * คือถ้าเปิดแถวค้างไว้แล้วกดบันทึก ฟอร์มจะไม่ยอมบันทึกและเตือนให้เลือกผู้ขายก่อน
 * ทั้งที่ผู้ใช้แค่ไม่อยากเพิ่มแล้ว
 *
 * ตารางและพารามิเตอร์ชุดเดียวกับหน้ารายการผู้ขาย (`useVendor` + page/perpage/
 * search) ค้นแล้วกด Enter เหมือนทุกหน้า list · state เก็บไว้ใน dialog ไม่เขียนลง
 * URL เพราะ URL ตอนนั้นเป็นของฟอร์มคำขอราคาที่เปิดค้างอยู่
 */
export function RfpVendorAddDialog({
  open,
  onOpenChange,
  selectedVendorIds,
  onAdd,
}: Props) {
  const t = useTranslations("vendorManagement.requestPriceList");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");

  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  /**
   * เก็บทั้ง object ไม่ใช่แค่ id — ตอนกดเพิ่มต้องใช้ contact ของผู้ขายด้วย และ
   * แถวที่ติ๊กไว้อาจไม่อยู่บนหน้าปัจจุบันแล้ว (เลือกข้ามหน้าได้)
   */
  const [picked, setPicked] = useState<Map<string, Vendor>>(new Map());

  const page = pagination.pageIndex + 1;
  const perpage = pagination.pageSize;

  const { data, isLoading } = useVendor(
    {
      page,
      perpage,
      search: search || undefined,
    },
    { enabled: open },
  );

  // TanStack ต้องได้ reference ที่นิ่ง — `data?.data ?? []` สร้าง array ใหม่ทุก
  // render แล้ว useReactTable จะ sync state ไม่จบ (เจอจริงที่ vendor-certificate-section
  // หลังเซฟ vendor สำเร็จ วนไป 245,156 รอบ)
  const vendors = useMemo(() => data?.data ?? [], [data]);
  const totalRecords = data?.paginate?.total ?? 0;

  const closeAndReset = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch("");
      setPagination({ pageIndex: 0, pageSize: 10 });
      setPicked(new Map());
    }
    onOpenChange(nextOpen);
  };

  const handleAdd = () => {
    onAdd([...picked.values()]);
    closeAndReset(false);
  };

  const pickedCount = picked.size;

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      // ใช้ column กลางของ DataGrid ทั้งช่องติ๊กและเลขลำดับ — ตัวติ๊กต้องมี id
      // "select" เป๊ะ ๆ ไม่งั้น DataGridTable ซ่อนทิ้ง (ดู isColumnVisible)
      selectColumn<Vendor>(),
      indexColumn<Vendor>({ page, perpage }),
      {
        accessorKey: "name",
        header: () => tfl("vendor"),
        // รหัสซ้อนใต้ชื่อในเซลล์เดียว ไม่แยกคอลัมน์ — ทรงเดียวกับตารางผู้ขายใน
        // คำขอ (`VendorNameCell`) ที่อยู่หลัง dialog นี้ คนเลือกจาก dialog แล้ว
        // เห็นแถวหน้าตาเดิมโผล่ในตาราง ไม่ต้องแปลว่ามันคือรายการเดียวกัน
        cell: ({ row }) => (
          <VendorNameCell name={row.original.name} code={row.original.code} />
        ),
        // w-full ให้คอลัมน์ชื่อดูดที่ว่างที่เหลือไปหมด — table-auto เฉลี่ยที่ว่าง
        // ให้ทุกคอลัมน์เท่า ๆ กัน ช่องติ๊กเลยกว้าง 76px ทั้งที่ข้างในมีแค่กล่อง 16px
        meta: {
          headerTitle: tfl("vendor"),
          headerClassName: "w-full",
          cellClassName: "w-full",
        },
      },
    ],
    [page, perpage, tfl],
  );

  /**
   * ติ๊กค้างไว้ทั้งที่เพิ่งเลือกและที่อยู่ในคำขอแล้ว — ของเดิมติ๊กออกไม่ได้อยู่แล้ว
   * (`enableRowSelection` เป็น false) เครื่องหมายถูกจึงอ่านว่า "อยู่ในคำขอนี้แล้ว"
   * ตรงตัว ไม่ต้องมีป้ายกำกับซ้ำอีกอัน
   */
  const rowSelection = useMemo(
    () =>
      Object.fromEntries(
        [...selectedVendorIds, ...picked.keys()].map((id) => [id, true]),
      ),
    [picked, selectedVendorIds],
  );

  const table = useReactTable({
    data: vendors,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(totalRecords / pagination.pageSize)),
    // ที่อยู่ในคำขอแล้วติ๊กออกไม่ได้ — ลบต้องไปกดที่ตารางในฟอร์ม
    enableRowSelection: (row) => !selectedVendorIds.has(row.original.id),
    state: { pagination, rowSelection },
    onPaginationChange: setPagination,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater;
      setPicked((prev) => {
        const map = new Map(prev);
        // เทียบเฉพาะแถวบนหน้าปัจจุบัน — แถวหน้าอื่นที่ติ๊กไว้ไม่ได้อยู่ใน next
        for (const vendor of vendors) {
          // ที่อยู่ในคำขอแล้วติ๊กค้างไว้เฉย ๆ ห้ามหลุดเข้ารายการที่จะเพิ่มซ้ำ
          if (selectedVendorIds.has(vendor.id)) continue;
          if (next[vendor.id]) map.set(vendor.id, vendor);
          else map.delete(vendor.id);
        }
        return map;
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-1 text-sm">
            <Store aria-hidden="true" />
            {t("vendors.selectVendorsTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("vendors.selectVendorsDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3">
          <SearchInput
            defaultValue={search}
            onSearch={(value) => {
              setSearch(value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            containerClassName="w-full"
          />
        </div>

        <div className="min-h-0 flex-1 px-6 pb-3">
          <DataGrid
            table={table}
            recordCount={totalRecords}
            isLoading={isLoading}
            // width auto = table-auto ให้คอลัมน์กว้างตามเนื้อหา ไม่งั้นโหมด fixed
            // จะเกลี่ยความกว้างเป็น % ตามสัดส่วน size แล้วช่องติ๊กกับเลขลำดับ
            // (50px) โดนยืดเป็นเกือบ 90px ทั้งที่ข้างในมีแค่กล่องติ๊กกับเลขเดียว
            tableLayout={{ checkbox: true, headerSticky: true, width: "auto" }}
            emptyMessage={
              <EmptyComponent
                title={t("vendors.noVendorsFound")}
                description={t("vendors.noVendorsFoundDesc")}
              />
            }
          >
            {/* max-h ตายตัวบน container — ScrollArea ข้างในเป็น height:100% ถ้า
                ปล่อยให้ยืดตาม flex เปอร์เซ็นต์จะ resolve ไม่ได้ แถวจะทะลุออกนอก
                dialog ไปทับปุ่มด้านล่างจนกดผิดปุ่ม (เจอมาแล้วตอนใช้ flex-1) */}
            <DataGridContainer className="flex max-h-[50vh] flex-col">
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
              <DataGridPagination />
            </DataGridContainer>
          </DataGrid>
        </div>

        <DialogFooter className="bg-muted/20 items-center border-t px-6 py-3 sm:justify-between">
          <span className="text-muted-foreground text-xs">
            {t("vendors.nVendorsSelected", { count: pickedCount })}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => closeAndReset(false)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pickedCount === 0}
              onClick={handleAdd}
            >
              {t("vendors.addNVendors", { count: pickedCount })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
