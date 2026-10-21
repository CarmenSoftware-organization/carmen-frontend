import { useEffect, useRef, useState } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { useLocationPairProducts } from "@/hooks/use-location-pair-products";
import { useTranslations } from "use-intl";
import { BoxIcon, Check, Eye, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { WarningDialog } from "@/components/ui/warning-dialog";
import EmptyComponent from "@/components/empty-component";
import { STAGE_ROLE } from "@/types/stage-role";
import type { SrFormValues } from "./sr-form-schema";
import { SR_ITEM, SR_ITEM_STAGE } from "./sr-form-schema";
import { SrItemCostSync } from "./sr-item-cost-sync";
import { SrItemPostedCostSync } from "./sr-item-posted-cost-sync";
import { srStockVisible } from "./sr-form-helpers";
import { useSrStockMovements } from "./use-sr";
import { useSrItemTable } from "./use-sr-item-table";
import { SrSelectDialog } from "./sr-select-dialog";
import { SrActionDialog } from "./sr-action-dialog";
import { getDeleteDescription } from "@/lib/form-utils";
import {
  wouldRejectAll,
  type StageActionFlags,
} from "@/lib/workflow-stage-actions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SrItemFieldsProps {
  readonly form: UseFormReturn<SrFormValues>;
  readonly disabled: boolean;
  readonly disableAdd?: boolean;
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly workflowId: string;
  readonly role?: string;
  /** id ของใบ — ใบที่จ่ายแล้วใช้ดึงต้นทุนที่ลงบัญชีจริง */
  readonly srId?: string;
  readonly docStatus?: string;
  /** ตัวเลือกที่ stage ปัจจุบันเปิดให้ตัดสิน (ผ่าน getStageActionFlags แล้ว) — มีแต่ตัดออก ไม่เพิ่มสิทธิ์ */
  readonly stageActions: StageActionFlags;
}

export function SrItemFields({
  form,
  disabled,
  disableAdd,
  fromLocationId,
  toLocationId,
  workflowId,
  role,
  srId,
  docStatus,
  stageActions,
}: SrItemFieldsProps) {
  "use no memo";
  // ใบที่จ่ายแล้วโชว์ต้นทุนที่ลงบัญชีจริงจาก stock movement ของใบ ไม่ใช่ราคาประมาณที่คิดจาก
  // ล็อตที่เหลือ ณ วันนี้ — เกณฑ์เดียวกับแท็บ Stock Movement (srStockVisible) และใช้ query ตัวเดียวกัน
  const isPosted = srStockVisible(docStatus);
  const { data: movement } = useSrStockMovements(srId, { enabled: isPosted });
  const t = useTranslations("storeOperation.storeRequisition");
  const tc = useTranslations("common");
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  // เหตุที่เพิ่มรายการไม่ได้ — null = เพิ่มได้ปกติ
  const [addBlocked, setAddBlocked] = useState<"criteria" | "noProduct" | null>(
    null,
  );
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(
    null,
  );

  const {
    fields: itemFields,
    prepend: prependItem,
    remove: removeItem,
  } = useFieldArray({ control: form.control, name: "items" });

  // โหลดสินค้าของคลังคู่นี้ไว้ล่วงหน้าตั้งแต่เลือกคลังครบ ไม่ต้องรอให้มีแถวก่อน —
  // ตัวที่ยิงจริงคือ lookup ในแต่ละแถว ซึ่งกว่าจะ mount ก็ตอนกดเพิ่มรายการแล้ว
  // observer ตัวนี้อยู่ตลอดอายุแท็บรายการ ของที่โหลดมาเลยไม่ถูกทิ้งทั้งที่ gcTime
  // เป็น 0 · params ต้องตรงกับที่ useLookupPagination ยิงหน้าแรกเป๊ะ ไม่งั้นคนละ key
  const { data: scopeProducts, isSuccess: scopeLoaded } =
    useLocationPairProducts(
      fromLocationId || undefined,
      toLocationId || undefined,
      workflowId || undefined,
      {
        search: undefined,
        perpage: 30,
        page: 1,
      },
    );

  // โหลดมาแล้วได้ [] = คู่คลังนี้ไม่มีของที่เวิร์กโฟลว์นี้ให้เบิกเลย เพิ่มแถวไปก็
  // เลือกอะไรไม่ได้ (ยังไม่โหลดเสร็จ ไม่ถือว่าว่าง ไม่งั้นเตือนดักหน้าตอนกำลังโหลด)
  const hasNoProduct = scopeLoaded && (scopeProducts?.data?.length ?? 0) === 0;

  // เปลี่ยนคลังหรือ workflow แล้วสินค้าที่เลือกไว้อาจไม่อยู่ในเกณฑ์ใหม่ (สินค้าที่
  // เลือกได้ = มีทั้งสองคลัง + อยู่ในชุดที่ workflow เลือกไว้) — ล้างของที่เลือกทุกแถว
  // เช็คว่า "เกณฑ์เดิมครบทั้งสามค่า" ก่อนล้าง ไม่งั้นตอนเปิดใบเก่าที่ค่าทยอยมาจาก
  // ว่าง → มีจริง จะไปล้างสินค้าที่เพิ่งโหลดมาทิ้ง
  const prevPair = useRef<string | null>(null);
  useEffect(() => {
    const pair = `${fromLocationId}|${toLocationId}|${workflowId}`;
    const prev = prevPair.current;
    prevPair.current = pair;
    if (prev === null || prev === pair) return;
    const [prevFrom, prevTo, prevWorkflow] = prev.split("|");
    if (!prevFrom || !prevTo || !prevWorkflow) return;
    itemFields.forEach((_, index) => {
      form.setValue(`items.${index}.product_id`, "");
      form.setValue(`items.${index}.product_name`, "");
      form.setValue(`items.${index}.product_local_name`, "");
      form.setValue(`items.${index}.unit_name`, "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ล้างเมื่อเกณฑ์กรองเปลี่ยนเท่านั้น
  }, [fromLocationId, toLocationId, workflowId]);

  // ต้องมีคลังครบทั้งคู่ + workflow ก่อน เพราะช่องเลือกสินค้าดึงเฉพาะของที่มีอยู่
  // ทั้งสองคลังและอยู่ในชุดที่ workflow เลือกไว้ — เพิ่มแถวเปล่าไปก่อนได้แต่จะกด
  // เลือกอะไรไม่ได้เลย บอกไปตรง ๆ ดีกว่าปล่อยให้งง
  const handleAddItem = () => {
    if (!workflowId || !fromLocationId || !toLocationId) {
      setAddBlocked("criteria");
      return;
    }
    if (hasNoProduct) {
      setAddBlocked("noProduct");
      return;
    }
    prependItem({ ...SR_ITEM });
  };

  // กด Save แล้วติดที่ "ต้องมีอย่างน้อย 1 รายการ" — เติมแถวเปล่าให้เห็นว่าต้อง
  // กรอกอะไร (กติกาเดียวกับ PR/PO) · ต้องเลือกคลังต้นทาง/ปลายทางก่อนถึงจะเพิ่มได้
  const submitCount = form.formState.submitCount;
  useEffect(() => {
    if (!submitCount) return;
    if (itemFields.length === 0 && !disabled && !disableAdd) handleAddItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ยิงครั้งเดียวต่อการกด submit
  }, [submitCount]);

  const {
    table,
    selectDialogOpen,
    setSelectDialogOpen,
    allCount,
    pendingCount,
    handleSelectAll,
    handleSelectPending,
  } = useSrItemTable({
    form,
    itemFields,
    disabled,
    onDelete: setDeleteIndex,
    fromLocationId,
    toLocationId,
    workflowId,
    role,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const watchedItems = useWatch({ control: form.control, name: "items" });
  const canBulkAction =
    !disabled && (role === STAGE_ROLE.APPROVE || role === STAGE_ROLE.ISSUE);

  // stage ที่ปิด reject แต่เปิด approve ยังปัดตกบางแถวได้ (partial reject) — ห้ามแค่ให้
  // ทุกแถวกลายเป็น reject เพราะนั่นคือการปัดตกทั้งใบ · นิยาม reject และฟิลด์ที่อ่านเดียวกับ
  // computeSrAction ที่คุมปุ่มใน footer (stage_status ค่าสดในฟอร์ม) · แถวที่ยังไม่ตัดสิน
  // (สถานะว่าง) computeSrAction ทิ้งด้วย filter(Boolean) จึงนับเป็น "ไม่ขวาง" ที่นี่เช่นกัน —
  // ไม่ filter ทิ้งจริงเพราะ index ต้องตรงกับแถวที่ติ๊ก
  const rejectWouldRejectAll =
    !stageActions.reject &&
    wouldRejectAll(
      (watchedItems ?? []).map((item) => item?.stage_status ?? ""),
      selectedRows.map((row) => row.index),
      (s) => s === "" || s === SR_ITEM_STAGE.REJECT,
    );

  const getSelectedIndices = () =>
    table.getSelectedRowModel().rows.map((row) => row.index);

  const applyBulkStatus = (status: string) => {
    const indices = getSelectedIndices();
    for (const index of indices) {
      form.setValue(`items.${index}.stage_status`, status, {
        shouldDirty: true,
      });
    }
    table.resetRowSelection();
  };

  const handleBulkApprove = () => {
    applyBulkStatus(SR_ITEM_STAGE.APPROVE);
  };

  const handleBulkReject = () => {
    applyBulkStatus(SR_ITEM_STAGE.REJECT);
    setBulkAction(null);
  };

  const handleBulkReview = () => {
    applyBulkStatus(SR_ITEM_STAGE.REVIEW);
  };

  return (
    <div className="space-y-2">
      {/* แถวเดียว: ปุ่มตัดสินชิดซ้าย (เป็นการกระทำกับแถวที่เพิ่งติ๊ก มือไปหาปุ่ม
          ตรงนั้น ไม่ต้องกวาดตาไปสุดขวา) · ปุ่มเพิ่มรายการเป็นของทั้งตาราง ดันไป
          ขวาด้วย ms-auto — ไม่ใช้ justify-between เพราะตอนไม่มีปุ่มตัดสินมันจะ
          เหลือลูกตัวเดียวแล้วไปกองซ้าย · ลำดับตาม PR: อนุมัติ → ปฏิเสธ → ส่งกลับ */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedRows.length > 0 && canBulkAction && (
          <>
            {stageActions.approve && (
              <Button
                type="button"
                variant="success"
                size="xs"
                onClick={handleBulkApprove}
              >
                <Check />
                {tc("approve")}
              </Button>
            )}
            {(stageActions.reject || stageActions.approve) &&
              (rejectWouldRejectAll ? (
                <Tooltip>
                  {/* ปุ่ม disabled ไม่ยิง pointer event — ต้องห่อด้วย span ให้ tooltip จับ hover ได้ */}
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        disabled
                      >
                        <X />
                        {tc("reject")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{tc("rejectAllNotAllowed")}</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  size="xs"
                  onClick={() => setBulkAction("reject")}
                >
                  <X />
                  {tc("reject")}
                </Button>
              ))}
            {stageActions.sendback && (
              <Button
                type="button"
                variant="warning"
                size="xs"
                onClick={handleBulkReview}
              >
                <Eye />
                {tc("sendBack")}
              </Button>
            )}
          </>
        )}
        {!disabled && (
          <Button
            type="button"
            onClick={handleAddItem}
            size="sm"
            className="ms-auto"
            variant="secondary"
          >
            <Plus /> {t("addItem")}
          </Button>
        )}
      </div>

      {/* ดึงต้นทุนรายแถวจาก backend แล้วเขียนกลับเข้าฟอร์ม — ติดตั้งที่นี่ไม่ใช่ในเซลล์
          เพื่อให้คอลัมน์ยอดเงินกับยอดรวมท้ายใบอ่านค่าเดียวกัน · ใบที่จ่ายแล้วใช้ต้นทุนที่ลงบัญชี
          ใบที่ยังไม่จ่ายใช้ราคาประมาณ (หนึ่งตัวต่อแถว) */}
      {isPosted ? (
        <SrItemPostedCostSync form={form} movement={movement} />
      ) : (
        itemFields.map((item, i) => (
          <SrItemCostSync
            key={item.id}
            form={form}
            index={i}
            fromLocationId={fromLocationId}
          />
        ))
      )}

      <DataGrid
        table={table}
        recordCount={itemFields.length}
        tableLayout={{
          rowClamp: false,
          checkbox: !disabled,
          // โหมดอ่านชิดบน — เซลล์ที่มีบรรทัดรอง (ชื่อท้องถิ่นใต้ชื่อสินค้า) กับเซลล์
          // บรรทัดเดียวจะได้เริ่มที่เส้นเดียวกัน · โหมดแก้ไขกึ่งกลางทั้งแถว เพราะ
          // เซลล์ส่วนใหญ่เป็นช่องกรอกสูงเท่ากัน ชิดบนแล้วช่องที่เป็นตัวหนังสือจะ
          // ลอยอยู่เหนือช่องกรอกที่อยู่ข้าง ๆ
          cellAlign: disabled ? "top" : "middle",
        }}
        emptyMessage={
          <EmptyComponent
            icon={BoxIcon}
            title={t("noItems")}
            description={t("noItemsDesc")}
          />
        }
      >
        <DataGridContainer>
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>

      <DeleteDialog
        open={deleteIndex !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteIndex(null);
        }}
        title={t("removeItem")}
        description={getDeleteDescription(deleteIndex, form)}
        onConfirm={() => {
          if (deleteIndex === null) return;
          removeItem(deleteIndex);
          setDeleteIndex(null);
        }}
      />

      <WarningDialog
        open={addBlocked !== null}
        title={
          addBlocked === "noProduct"
            ? t("noProductTitle")
            : t("addItemBlockedTitle")
        }
        description={
          addBlocked === "noProduct"
            ? t("noProductDesc")
            : t("addItemBlockedDesc")
        }
        confirmLabel={tc("close")}
        onConfirm={() => setAddBlocked(null)}
      />

      <SrSelectDialog
        open={selectDialogOpen}
        onOpenChange={setSelectDialogOpen}
        allCount={allCount}
        pendingCount={pendingCount}
        onSelectAll={handleSelectAll}
        onSelectPending={handleSelectPending}
      />

      <SrActionDialog
        open={bulkAction === "reject"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        title={t("rejectTitle")}
        description={t("rejectConfirm")}
        confirmLabel={tc("reject")}
        confirmVariant="destructive"
        items={selectedRows.map((row) => ({
          index: row.index,
          productName: row.original.product_name ?? "",
          locationName: row.original.unit_name ?? "",
        }))}
        onConfirm={(messages) => {
          for (const row of selectedRows) {
            const msg = messages[row.index];
            if (msg !== undefined) {
              form.setValue(`items.${row.index}.stage_message`, msg, {
                shouldDirty: true,
              });
            }
          }
          handleBulkReject();
        }}
      />
    </div>
  );
}
