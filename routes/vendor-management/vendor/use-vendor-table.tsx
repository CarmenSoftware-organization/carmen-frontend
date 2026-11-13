import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { Badge } from "@/components/ui/badge";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import type { Vendor } from "@/types/vendor";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { VendorRatingStars } from "./vendor-rating";

// list API ส่ง `contacts` — `tb_vendor_contact` เป็นชื่อเก่า เก็บ fallback ไว้
function primaryContactOf(vendor: Vendor) {
  const contacts = vendor.contacts ?? vendor.tb_vendor_contact ?? [];
  return contacts.find((c) => c.is_primary) ?? contacts[0];
}

interface UseVendorTableOptions {
  vendors: Vendor[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด โชว์ครบทุกคอลัมน์ */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * คอลัมน์สั้นกว้างคงที่ ชื่อผู้ขายรับที่เหลือ (`meta.grow`) ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`
 * ซึ่งนับคอลัมน์ select (55) ที่หน้านี้ไม่ได้เรนเดอร์ด้วย:
 *   ครบ            55+60+90+180+160+190+130+100+60 = 1025
 *   ไม่มีประเภทธุรกิจ                                  =  865
 *   ไม่มีคะแนน                                        =  735
 *   ไม่มีเลขลำดับ + ผู้ติดต่อเหลือ 170   55+90+180+170+100+60 = 655  (กล่องที่จอ 768 = 662)
 * จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวม 25–35px โดยตั้งใจ — คอลัมน์รองกลับมาเมื่อชื่อได้ที่ ~205px แล้ว
 * เท่านั้น ไม่งั้นพอข้ามขั้นชื่อจะหดเหลือขั้นต่ำ 180px
 * ผู้ติดต่ออยู่ถึงขั้นสุดท้าย (จัดซื้อเปิดหน้านี้เพื่อหาว่าจะโทรหาใคร) · ของที่ซ่อนยังดูได้จาก
 * มุมมองการ์ดและหน้ารายละเอียด · คอลัมน์ที่ผู้ใช้เปิดเพิ่มเอง (credit term, created, updated)
 * ไม่ได้นับในงบนี้ — เปิดแล้วเกินกล่อง ตารางเลื่อนแนวนอนในกรอบของมันเอง
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showBusinessType: w >= 1060,
    showRating: w >= 890,
    showIndex: w >= 770,
  };
}

export function useVendorTable({
  vendors,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseVendorTableOptions) {
  "use no memo";

  const tfl = useTranslations("field");
  const t = useTranslations("vendorManagement.vendor");
  const { dateTimeFormat } = useProfile();
  const { showBusinessType, showRating, showIndex } =
    columnTier(containerWidth);

  const columns: ColumnDef<Vendor>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction
          onClick={() => onEdit(row.original)}
          className="whitespace-nowrap"
        >
          {row.original.code}
        </CellAction>
      ),
      size: 90,
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.name || "..."}
        </CellAction>
      ),
      // คอลัมน์ข้อความยาวตัวเดียวของตาราง รับความกว้างที่เหลือ — `size` คือขั้นต่ำ
      meta: {
        headerTitle: tfl("name"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
      size: 180,
    },

    {
      id: "business_type_names",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("businessType")} />
      ),
      accessorFn: (row) =>
        row.business_type?.map((bt) => bt.name).join(", ") ?? "",
      cell: ({ row }) => {
        const types = row.original.business_type ?? [];
        if (types.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        // แถวเดียวเสมอ: ป้ายแรก + "+N" — รายชื่อเต็มอยู่ใน title
        const [first, ...rest] = types;
        return (
          // data-slot: ไม่งั้น wrapper ของ DataGridTable ใส่ line-clamp-2 ทับ flex → ป้ายไม่หด
          // ชื่อยาวถูกตัดกลางตัวอักษรและ "+N" ตกไปบรรทัดสอง
          <div
            data-slot="cell-business-type"
            className="flex min-w-0 items-center gap-1"
            title={types.map((bt) => bt.name).join(", ")}
          >
            {/* Badge เป็น inline-flex + shrink-0: ต้องปลด shrink และตัดคำที่ span ข้างใน */}
            <Badge variant="outline" className="min-w-0 shrink">
              <span className="truncate">{first.name}</span>
            </Badge>
            {rest.length > 0 && (
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                +{rest.length}
              </span>
            )}
          </div>
        );
      },
      size: 160,
      enableSorting: false,
      meta: {
        headerTitle: tfl("businessType"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      // ผู้ติดต่อหลัก + เบอร์ ซ้อนในเซลล์เดียว — จัดซื้อเปิดหน้านี้เพื่อหาว่าจะโทรหาใคร
      id: "primary_contact",
      accessorFn: (row) => primaryContactOf(row)?.name ?? "",
      header: tfl("contact"),
      cell: ({ row }) => {
        const contact = primaryContactOf(row.original);
        if (!contact?.name && !contact?.phone) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="min-w-0">
            <span className="block truncate" title={contact.name || undefined}>
              {contact.name || "—"}
            </span>
            {contact.phone && (
              <span className="text-muted-foreground block truncate text-xs tabular-nums">
                {contact.phone}
              </span>
            )}
          </div>
        );
      },
      size: showIndex ? 190 : 170,
      enableSorting: false,
      meta: { headerTitle: tfl("contact"), skeleton: columnSkeletons.text },
    },
    {
      // ซ่อนเป็นค่าเริ่มต้น เปิดได้จากเมนูคอลัมน์ — ไม่เรียงเพราะเป็นชื่อจาก relation
      id: "credit_term",
      accessorFn: (row) => row.credit_term_name ?? "",
      header: tfl("creditTerm"),
      cell: ({ row }) => {
        const { credit_term_name: name, credit_term_days: days } = row.original;
        if (!name && days == null) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <span className="block truncate whitespace-nowrap tabular-nums">
            {name || days}
          </span>
        );
      },
      size: 130,
      enableSorting: false,
      meta: { headerTitle: tfl("creditTerm"), skeleton: columnSkeletons.text },
    },
    {
      // เรียงฝั่ง server ได้ (tb_vendor.rating เป็น scalar) — null = ยังไม่ประเมิน
      accessorKey: "rating",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("rating")} />
      ),
      cell: ({ row }) =>
        row.original.rating == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <VendorRatingStars value={row.original.rating} className="text-xs" />
        ),
      // ดาว 5 ดวง + "5/5" กว้าง 102px + padding เซลล์ 24
      size: 130,
      meta: { headerTitle: t("rating"), skeleton: columnSkeletons.textShort },
    },
    // status column แทรกเองก่อน created/updated (useConfigTable ส่ง hideStatus)
    statusColumn<Vendor>(tfl),
    ...auditColumns<Vendor>(tfl, dateTimeFormat),
  ];

  // ซ่อนผ่าน state ของตาราง ไม่ใช่ CSS — ความกว้างขั้นต่ำของตารางที่มีคอลัมน์ยืดคิดจากทุกคอลัมน์
  // ที่ TanStack ถือว่ามองเห็น · ตัดออกจากรายการคอลัมน์เลย เมนู Toggle Columns ของผู้ใช้จึงไม่ถูกทับ
  const hidden = new Set<string>([
    ...(showBusinessType ? [] : ["business_type_names"]),
    ...(showRating ? [] : ["rating"]),
  ]);
  const visibleColumns = columns.filter((c) => {
    const key =
      c.id ?? ("accessorKey" in c ? String(c.accessorKey) : undefined);
    return !key || !hidden.has(key);
  });

  return useConfigTable<Vendor>({
    data: vendors,
    columns: visibleColumns,
    hideIndex: !showIndex,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    // คอลัมน์ audit ซ่อนเป็น default (เปิดได้จากเมนู Toggle Columns)
    initialState: {
      columnVisibility: {
        credit_term: false,
        created_at: false,
        updated_at: false,
      },
    },
    activity: { id: (r) => r.id, label: (r) => r.code },
  });
}
