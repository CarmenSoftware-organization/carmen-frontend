import { useNavigate } from "react-router";
import { PackageCheck, SearchX, X } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { useWastageReport } from "./use-wastage-report";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListPageShell } from "@/components/share/list-page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import { WASTAGE_WINDOW_DAYS } from "@/constant/wastage-reporting";
import { useWastageReportTable } from "./use-wr-table";
import { WrSummaryBar } from "./wr-summary-bar";
import SearchInput from "@/components/search-input";
import { setURLParams, useURL } from "@/hooks/use-url";
import type { WastageStatus } from "@/types/wastage-reporting";

const isWastageStatus = (v: string): v is WastageStatus =>
  v === "expired" || v === "expiring";

export default function WrComponent() {
  const navigate = useNavigate();
  const t = useTranslations("storeOperation.wastageReporting");
  const tc = useTranslations("common");
  const { params, search, setSearch, tableConfig } = useDataGridState();
  const isMobile = useIsMobile() === true;

  // ไม่มี ListToolbar / saved view: ตัวกรองเดียวคือสถานะ ซึ่งอยู่บนหน้าแล้ว
  // (WrSummaryBar) เมนู Filter ว่างเปล่า และ view ที่บันทึกได้มีแค่คำค้น+สถานะ
  // จึงเก็บสถานะใน URL ตรง ๆ — ส่งเป็น `?status=` เพราะ endpoint ไม่อ่าน `filter`
  // (เดิมส่ง `filter=status|string:expired` ไป backend ทิ้งเงียบ ๆ ได้ทุกแถว)
  const [statusRaw] = useURL("status");
  const status = isWastageStatus(statusRaw) ? statusRaw : "";

  const { data, isLoading, error, refetch } = useWastageReport({
    page: params.page,
    perpage: params.perpage,
    search: params.search,
    days: WASTAGE_WINDOW_DAYS,
    ...(status ? { status } : {}),
  });

  // summary ของ backend คิดหลังกรองสถานะ — กรอง "หมดอายุแล้ว" อยู่ ปุ่ม "ใกล้หมด"
  // จะนับได้ 0 ทั้งที่มีของ จึงยิงอีกครั้งแบบไม่กรอง (แถวเดียว) เฉพาะตอนที่กรองอยู่
  const { data: unfiltered } = useWastageReport(
    {
      page: 1,
      perpage: 1,
      search: params.search,
      days: WASTAGE_WINDOW_DAYS,
    },
    { enabled: !!status },
  );

  const items = data?.data ?? [];
  const totalRecords = data?.paginate?.total ?? 0;
  const counts = status ? unfiltered?.summary : data?.summary;

  const table = useWastageReportTable({
    items,
    totalRecords,
    params,
    tableConfig,
    onOpenGrn: (item) =>
      navigate(`/procurement/goods-receive-note/${item.grn_id}`),
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const emptyMessage = search ? (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{t("noResultsTitle", { search })}</EmptyTitle>
        <EmptyDescription>{t("noResultsDesc")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline" onClick={() => setSearch("")}>
          <X />
          {tc("clearSearch")}
        </Button>
      </EmptyContent>
    </Empty>
  ) : (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackageCheck />
        </EmptyMedia>
        <EmptyTitle>
          {t(status === "expired" ? "noExpiredTitle" : "allFreshTitle")}
        </EmptyTitle>
        <EmptyDescription>
          {t("allFreshDesc", { days: WASTAGE_WINDOW_DAYS })}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <ListPageShell
      title={t("title")}
      count={totalRecords}
      description={t("desc", { days: WASTAGE_WINDOW_DAYS })}
      toolbar={
        <div className="w-full sm:w-auto sm:flex-initial">
          <SearchInput defaultValue={search} onSearch={setSearch} />
        </div>
      }
    >
      <div className="space-y-3">
        <WrSummaryBar
          counts={counts}
          valueAtRisk={data?.summary?.total_value_at_risk}
          status={status}
          onStatusChange={(next) => setURLParams({ status: next, page: "" })}
        />

        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          // มือถือเป็นเซลล์เดียวสามบรรทัด — clamp สองบรรทัดจะตัด GRN ทิ้ง
          tableLayout={{ rowClamp: !isMobile }}
        >
          <DataGridContainer>
            <DataGridTable />
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      </div>
    </ListPageShell>
  );
}
