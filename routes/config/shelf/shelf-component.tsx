import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import { useShelf, useDeleteShelf } from "@/hooks/use-shelf";
import type { Shelf } from "@/types/shelf";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useShelfTable } from "./use-shelf-table";
import { SHELF_FILTER_FIELDS } from "./shelf-filter-fields";
import ShelfCard from "./shelf-card";

// แทน next/dynamic ด้วย React.lazy (code-split dialog chunk เหมือนเดิม)
const ShelfDialog = lazy(() =>
  import("./shelf-dialog").then((mod) => ({ default: mod.ShelfDialog })),
);

/**
 * Component หลักของหน้ารายการ Shelf ใช้ ConfigListTemplate พร้อม dialog
 * **backend ยังไม่มี /shelves** — หน้านี้สร้างรอ contract ไว้ list จะขึ้น
 * error state จนกว่า endpoint จะมา
 * @returns React element ของหน้ารายการ Shelf
 * @example
 * // route: /config/shelf
 * <ShelfComponent />
 */
export default function ShelfComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<Shelf>
      fixedColumnWidths
      translationNamespace="config.shelf"
      entityNameField="name"
      useList={useShelf}
      useDelete={useDeleteShelf}
      useTable={useShelfTable}
      pageKey={LIST_PAGE_KEYS.SHELF}
      filterFields={SHELF_FILTER_FIELDS}
      defaultSort="code:asc"
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 12 },
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 32,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <Suspense fallback={null}>
          <ShelfDialog
            open={open}
            onOpenChange={onOpenChange}
            shelf={entity}
            readOnly={readOnly}
          />
        </Suspense>
      )}
      renderCard={({ item, onEdit, onDelete, rowNo }) => (
        <ShelfCard rowNo={rowNo} item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
