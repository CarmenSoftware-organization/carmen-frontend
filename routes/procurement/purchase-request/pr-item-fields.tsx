// Opt out of React Compiler memoization — useFieldArray + dynamic setValue calls
// cause stale closure issues when auto-memoized.
"use no memo";

import { useEffect, useState } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { PrStageRoleProvider } from "./pr-item-cells";
import { useTranslations } from "use-intl";
import {
  AlertTriangle,
  BoxIcon,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  FilterX,
  Loader2,
  Plus,
  RefreshCcw,
  Scissors,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { ListFilter } from "@/components/list-filter/list-filter";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { STAGE_ROLE } from "@/types/stage-role";
import type { BusinessUnit } from "@/types/profile";
import type { PrFormValues } from "./pr-form-schema";
import { usePrItemTable } from "./use-pr-item-table";
import { usePrItemFilter } from "./use-pr-item-filter";
import {
  PrActionDialog,
  type StageOption,
  type ActionDialogItem,
} from "./workflow/pr-action-dialog";
import { lazy, Suspense } from "react";

// แทน next/dynamic ด้วย React.lazy (code-split เหมือนเดิม)
const PrSelectDialog = lazy(() =>
  import("./pr-select-dialog").then((mod) => ({ default: mod.PrSelectDialog })),
);
import EmptyComponent from "@/components/empty-component";
import { PR_ITEM } from "./pr-form-schema";
import { getDeleteDescription } from "@/lib/form-utils";
import { PR_ITEM_STAGE_STATUS } from "@/types/purchase-request";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { PrAskAiMenu } from "./ai/pr-ask-ai-menu";
import { runPrAutoAllocate } from "./pr-auto-allocate";
import {
  wouldRejectAll,
  type StageActionFlags,
} from "@/lib/workflow-stage-actions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PrItemFieldsProps {
  readonly form: UseFormReturn<PrFormValues>;
  readonly isDisabled: boolean;
  readonly role?: string;
  readonly prId?: string;
  readonly prStatus?: string;
  readonly buCode?: string;
  readonly defaultBu?: BusinessUnit;
  readonly dateFormat: string;
  readonly onSplit?: (detailIds: string[]) => void;
  readonly previousStages?: StageOption[];
  readonly stagesLoading?: boolean;
  /** ตัวเลือกที่ stage ปัจจุบันเปิดให้ตัดสิน (ผ่าน getStageActionFlags แล้ว) — มีแต่ตัดออก ไม่เพิ่มสิทธิ์ */
  readonly stageActions: StageActionFlags;
  readonly onBulkReview?: (
    detailIds: string[],
    messages: Record<number, string>,
    desStage: string,
  ) => void;
}

export function PrItemFields({
  form,
  isDisabled,
  role,
  prId,
  prStatus,
  buCode,
  defaultBu,
  dateFormat,
  onSplit,
  previousStages,
  stagesLoading,
  stageActions,
  onBulkReview,
}: PrItemFieldsProps) {
  const t = useTranslations("procurement.purchaseRequest");
  const tc = useTranslations("common");
  const tl = useTranslations("lookup");
  const [isAllocating, setIsAllocating] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [bulkAction, setBulkAction] = useState<
    PR_ITEM_STAGE_STATUS.REVIEW | PR_ITEM_STAGE_STATUS.REJECTED | null
  >(null);
  const [showOverQtyWarning, setShowOverQtyWarning] = useState(false);

  const filter = usePrItemFilter(form);

  const {
    fields: itemFields,
    prepend: prependItem,
    remove: removeItem,
  } = useFieldArray({ control: form.control, name: "items" });

  const watchedItems = useWatch({ control: form.control, name: "items" });
  const workflowId = useWatch({ control: form.control, name: "workflow_id" });
  const canAddItem = !!workflowId;

  const handleAddItem = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // แถวใหม่ขึ้นบนสุด "รายการก่อนหน้า" จึงคือแถวแรกปัจจุบัน — คนเบิกของมัก
    // เบิกจากคลังเดิมติดกันหลายรายการ เติมคลัง + จุดส่งของให้ล่วงหน้าแล้วแก้เอง
    // ได้ · อ่านผ่าน getValues ไม่ใช่ itemFields[0] เพราะ field array เก็บค่า
    // ตอน mount ไม่ใช่ค่าล่าสุดที่ผู้ใช้เพิ่งเลือก
    const prev = form.getValues("items.0");
    const carriedLocation = prev?.location_id
      ? {
          location_id: prev.location_id,
          location_code: prev.location_code,
          location_name: prev.location_name,
          location_type: prev.location_type,
          delivery_point_id: prev.delivery_point_id,
          delivery_point_name: prev.delivery_point_name,
        }
      : {};

    // วันที่ต้องการของก็ตามมาจากแถวก่อนหน้าเหมือนคลัง — ของที่เบิกพร้อมกันมัก
    // ต้องการวันเดียวกัน · แถวแรกของใบยังไม่มีอะไรให้ตาม ใช้พรุ่งนี้เหมือนเดิม
    const carriedDeliveryDate = prev?.delivery_date || tomorrow.toISOString();

    prependItem(
      {
        ...PR_ITEM,
        currency_id: defaultBu?.config?.default_currency_id ?? null,
        delivery_date: carriedDeliveryDate,
        ...carriedLocation,
      },
      { shouldFocus: false },
    );

    // Focus the Location lookup trigger in the new (first) row after React commits
    setTimeout(() => {
      const firstRow = document.querySelector("tbody tr");
      const trigger = firstRow?.querySelector<HTMLButtonElement>(
        "button[aria-expanded]",
      );
      if (trigger) {
        trigger.focus();
        trigger.classList.add("ring-2", "ring-ring/50");
        trigger.addEventListener(
          "blur",
          () => trigger.classList.remove("ring-2", "ring-ring/50"),
          { once: true },
        );
      }
    }, 0);
  };

  const submitCount = form.formState.submitCount;
  useEffect(() => {
    if (!submitCount) return;
    if (itemFields.length === 0 && canAddItem) handleAddItem();
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
  } = usePrItemTable({
    form,
    itemFields,
    filter,
    isDisabled,
    prStatus,
    role,
    dateFormat,
    buCode,
    baseCurrencyCode: defaultBu?.config?.default_currency?.code,
    onDelete: setDeleteIndex,
  });

  const selectedRows = table.getSelectedRowModel().rows;

  // HOD กด Edit = ตั้งใจจะตัดสินทั้งใบ ติ๊กทุกแถวให้เลย แล้วค่อยเอาออกเฉพาะแถวที่
  // ไม่เห็นด้วย — เร็วกว่าไล่ติ๊กสิบแถวเพื่อกดอนุมัติรวดเดียว · toggleAllRowsSelected
  // เคารพ enableRowSelection อยู่แล้ว แถวที่ stage ก่อนหน้าล็อกไว้จึงไม่ถูกติ๊ก
  // ยิงเฉพาะตอนสลับเข้าโหมดแก้ไข ไม่ใช่ทุก render — ไม่งั้นแถวที่ผู้ใช้เพิ่งเอา
  // ติ๊กออกจะเด้งกลับมาเอง
  useEffect(() => {
    if (isDisabled || role !== STAGE_ROLE.APPROVE) return;
    table.toggleAllRowsSelected(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งค่าครั้งเดียวต่อการเข้าโหมดแก้ไข
  }, [isDisabled, role]);

  const canBulkAction =
    !isDisabled &&
    (role === STAGE_ROLE.APPROVE || role === STAGE_ROLE.PURCHASE);

  const handleAutoAllocate = async () => {
    setIsAllocating(true);
    await runPrAutoAllocate(form, buCode, {
      allocating: (count) => t("allocating", { count }),
      allocated: (allocated, total) => t("allocated", { allocated, total }),
      allocateFailed: (count) => t("allocateFailed", { count }),
      noPriceListFound: t("noPriceListFound"),
    });
    setIsAllocating(false);
  };

  const getSelectedIndices = (): number[] => {
    return selectedRows.map((row) => row.index);
  };

  // stage ที่ปิด reject แต่เปิด approve ยังปัดตกบางแถวได้ (partial reject) — ห้ามแค่
  // ให้ทุกแถวกลายเป็น reject เพราะนั่นคือการปัดตกทั้งใบ · แถวที่ reject อยู่แล้วนับด้วย
  // นิยาม reject เดียวกับ computePurchaseAction ที่คุมปุ่มใน footer
  const rejectWouldRejectAll =
    !stageActions.reject &&
    wouldRejectAll(
      (watchedItems ?? []).map((item) => item?.current_stage_status ?? ""),
      selectedRows.map((row) => row.index),
      (s) =>
        s === PR_ITEM_STAGE_STATUS.REJECT ||
        s === PR_ITEM_STAGE_STATUS.REJECTED,
    );

  const guardSelectedItemErrors = async (): Promise<boolean> => {
    await form.trigger("items");
    const errored = getSelectedIndices().filter((index) => {
      const itemErr = form.formState.errors.items?.[index];
      return !!itemErr && Object.keys(itemErr).length > 0;
    });
    if (errored.length === 0) return false;
    table.setExpanded((prev) => ({
      ...(typeof prev === "object" ? prev : {}),
      ...Object.fromEntries(errored.map((i) => [String(i), true])),
    }));
    scrollToFirstInvalidField();
    toast.warning(t("purchaseIncomplete"));
    return true;
  };

  const handleBulkReview = async () => {
    // send back ไม่ต้องกรอก vendor/price/tax ให้ครบ — ข้าม guard
    const indices = getSelectedIndices();
    for (const index of indices) {
      form.setValue(`items.${index}.stage_status`, PR_ITEM_STAGE_STATUS.REVIEW);
      form.setValue(
        `items.${index}.current_stage_status`,
        PR_ITEM_STAGE_STATUS.REVIEW,
      );
    }
    table.resetRowSelection();
  };

  const handleBulkReject = async () => {
    // reject ไม่ต้องกรอก vendor/price/tax ให้ครบ — ข้าม guard
    setBulkAction(PR_ITEM_STAGE_STATUS.REJECTED);
  };

  const handleBulkApprove = async () => {
    if (await guardSelectedItemErrors()) return;
    const indices = getSelectedIndices();

    const hasOverQty = indices.some((index) => {
      const approvedQty = form.getValues(`items.${index}.approved_qty`);
      const requestedQty = form.getValues(`items.${index}.requested_qty`);
      return approvedQty > requestedQty;
    });

    if (hasOverQty) {
      setShowOverQtyWarning(true);
      return;
    }

    for (const index of indices) {
      form.setValue(
        `items.${index}.stage_status`,
        PR_ITEM_STAGE_STATUS.APPROVE,
      );
      form.setValue(
        `items.${index}.current_stage_status`,
        PR_ITEM_STAGE_STATUS.APPROVE,
      );
    }
    table.resetRowSelection();
  };

  const handleOverQtyConfirm = () => {
    const indices = getSelectedIndices();
    for (const index of indices) {
      form.setValue(
        `items.${index}.stage_status`,
        PR_ITEM_STAGE_STATUS.APPROVE,
      );
      form.setValue(
        `items.${index}.current_stage_status`,
        PR_ITEM_STAGE_STATUS.APPROVE,
      );
    }
    table.resetRowSelection();
    setShowOverQtyWarning(false);
  };

  const handleOverQtyCancel = () => {
    const indices = getSelectedIndices();
    for (const index of indices) {
      const approvedQty = form.getValues(`items.${index}.approved_qty`);
      const requestedQty = form.getValues(`items.${index}.requested_qty`);
      if (approvedQty > requestedQty) {
        form.setValue(`items.${index}.approved_qty`, requestedQty);
      }
    }
    setShowOverQtyWarning(false);
  };

  const handleBulkActionConfirm = (
    messages: Record<number, string>,
    desStage?: string,
  ) => {
    if (!bulkAction) return;
    const indices = getSelectedIndices();

    if (bulkAction === PR_ITEM_STAGE_STATUS.REVIEW && desStage) {
      const detailIds = indices
        .map((i) => form.getValues(`items.${i}.id`))
        .filter((id): id is string => !!id);
      onBulkReview?.(detailIds, messages, desStage);
      table.resetRowSelection();
      setBulkAction(null);
      return;
    }

    for (const index of indices) {
      form.setValue(`items.${index}.stage_status`, bulkAction);
      form.setValue(`items.${index}.current_stage_status`, bulkAction);
      form.setValue(`items.${index}.stage_message`, messages[index] ?? "");
    }
    table.resetRowSelection();
    setBulkAction(null);
  };

  const handleBulkSplit = () => {
    const detailIds = selectedRows
      .map((row) => {
        const item = form.getValues(`items.${row.index}`);
        return item.id;
      })
      .filter((id): id is string => !!id);

    if (detailIds.length === 0) {
      // ยังไม่ได้บันทึกแถวที่เลือก = ทำไม่ได้ตอนนี้ ไม่ใช่ระบบพัง → warning
      toast.warning(t("noSavedItemsForSplit"));
      return;
    }

    onSplit?.(detailIds);
    table.resetRowSelection();
  };

  const hasSelection = selectedRows.length > 0;

  const bulkActionDialogConfig: Record<
    string,
    {
      title: string;
      description: string;
      confirmLabel: string;
      confirmVariant: "warning" | "destructive";
    }
  > = {
    [PR_ITEM_STAGE_STATUS.REVIEW]: {
      title: t("reviewItemsTitle"),
      description: t("reviewItemsDesc"),
      confirmLabel: t("reviewTitle"),
      confirmVariant: "warning" as const,
    },
    [PR_ITEM_STAGE_STATUS.REJECTED]: {
      title: t("rejectItemsTitle"),
      description: t("rejectItemsDesc"),
      confirmLabel: tc("reject"),
      confirmVariant: "destructive" as const,
    },
  };

  return (
    <PrStageRoleProvider role={role}>
      <div className="space-y-4">
        {/* แถวเดียว: ปุ่มตัดสิน (อนุมัติ/ส่งกลับ/ปฏิเสธ/แยกใบ) ชิดซ้าย — เป็นการ
            กระทำกับแถวที่เพิ่งติ๊ก มือไปหาปุ่มตรงนั้น ไม่ต้องกวาดตาไปสุดขวา
            ส่วนของทั้งตาราง (ถาม AI, กาง/ยุบ, เพิ่มรายการ, จัดราคาอัตโนมัติ)
            ดันไปขวาด้วย ms-auto — ไม่ใช้ justify-between เพราะตอนไม่มีปุ่มตัดสิน
            มันจะเหลือลูกตัวเดียวแล้วไปกองซ้าย */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* ยังไม่ติ๊กแถว = ปุ่มอยู่แต่กดไม่ได้ ไม่ใช่หายไป — ซ่อนแล้วโผล่ทำให้แถบ
              ทั้งแถวขยับทุกครั้งที่ติ๊ก และคนที่ยังไม่เคยติ๊กจะไม่รู้เลยว่าตัดสิน
              รายแถวได้ ปุ่มที่กดไม่ได้อย่างน้อยยังบอกว่ามีทางนี้อยู่ */}
          {canBulkAction && (
            <>
              {stageActions.approve && (
                <Button
                  type="button"
                  variant="success"
                  size="sm"
                  disabled={!hasSelection}
                  onClick={handleBulkApprove}
                >
                  <Check />
                  {tc("approve")}
                </Button>
              )}
              {stageActions.sendback && (
                <Button
                  type="button"
                  variant="warning"
                  size="sm"
                  disabled={!hasSelection}
                  onClick={handleBulkReview}
                >
                  <Eye />
                  {t("reviewTitle")}
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
                          size="sm"
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
                    size="sm"
                    disabled={!hasSelection}
                    onClick={handleBulkReject}
                  >
                    <X />
                    {tc("reject")}
                  </Button>
                ))}
              {prId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasSelection}
                  onClick={handleBulkSplit}
                >
                  <Scissors />
                  {t("split")}
                </Button>
              )}
            </>
          )}

          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            {/* กรองแถวฝั่ง client — ไม่มี onSaveClick เพราะ saved view ผูกกับหน้า
                list ไม่ใช่ตารางในฟอร์ม (ดู use-pr-item-filter.tsx) */}
            <ListFilter
              fields={filter.fields}
              values={filter.values}
              setValue={filter.setValue}
              onClearAll={filter.clearAll}
              activeCount={filter.activeCount}
            />
            {selectedRows.length > 0 && (
              <PrAskAiMenu
                items={selectedRows.map((row) => {
                  const item = form.getValues(`items.${row.index}`);
                  return {
                    productName: item.product_name,
                    productLocalName: item.product_local_name,
                    qty: item.requested_qty,
                    unitName: item.requested_unit_name,
                    price: item.pricelist_price,
                    currencyCode: item.currency_code ?? undefined,
                  };
                })}
              />
            )}
            {(role === STAGE_ROLE.APPROVE || role === STAGE_ROLE.PURCHASE) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  table.toggleAllRowsExpanded(!table.getIsAllRowsExpanded())
                }
              >
                {table.getIsAllRowsExpanded() ? (
                  <>
                    <ChevronsDownUp /> {tc("collapseAll")}
                  </>
                ) : (
                  <>
                    <ChevronsUpDown /> {tc("expandAll")}
                  </>
                )}
              </Button>
            )}
            {!isDisabled && role === STAGE_ROLE.CREATE && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => handleAddItem()}
              >
                <Plus /> {t("addItem")}
              </Button>
            )}
            {!isDisabled && role === STAGE_ROLE.PURCHASE && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isAllocating || itemFields.length === 0}
                onClick={handleAutoAllocate}
              >
                {isAllocating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCcw />
                )}
                {t("autoAllocate")}
              </Button>
            )}
          </div>
        </div>

        <DataGrid
          table={table}
          recordCount={itemFields.length}
          tableLayout={{
            rowClamp: false,
            checkbox: !!prStatus && prStatus !== "draft",
            columnsResizable: true,
            // โหมดอ่านชิดบน — บางเซลล์มีบรรทัดรอง บางเซลล์ไม่มี กึ่งกลางแล้ว
            // เซลล์บรรทัดเดียวจะลอยอยู่ระหว่างสองบรรทัดของเพื่อนบ้าน
            cellAlign: isDisabled ? "top" : "middle",
          }}
          emptyMessage={
            // กรองจนไม่เหลือแถว ≠ ใบนี้ไม่มีของ — ข้อความ "ยังไม่มีรายการ" ตรงนั้น
            // จะหลอกให้คนไปกด Add Item ทั้งที่ของอยู่ครบ แค่ถูกซ่อน
            filter.activeCount > 0 ? (
              <EmptyComponent
                icon={FilterX}
                title={tc("noSearchResult")}
                description={tl("noFoundDesc")}
              />
            ) : (
              <EmptyComponent
                icon={BoxIcon}
                title={t("noItems")}
                description={t("noItemsDesc")}
              />
            )
          }
        >
          <DataGridContainer scroll>
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

        {bulkAction && (
          <PrActionDialog
            open={!!bulkAction}
            onOpenChange={(open) => {
              if (!open) setBulkAction(null);
            }}
            onConfirm={handleBulkActionConfirm}
            items={selectedRows.map((row): ActionDialogItem => ({
              index: row.index,
              productName: form.getValues(`items.${row.index}.product_name`),
              locationName: form.getValues(`items.${row.index}.location_name`),
            }))}
            {...bulkActionDialogConfig[bulkAction]}
            {...(bulkAction === PR_ITEM_STAGE_STATUS.REVIEW
              ? { stages: previousStages, stagesLoading }
              : {})}
          />
        )}

        <AlertDialog
          open={showOverQtyWarning}
          onOpenChange={setShowOverQtyWarning}
        >
          <AlertDialogContent className="gap-0 p-0 sm:max-w-md">
            {" "}
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="bg-muted text-warning-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <AlertTriangle className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <AlertDialogTitle className="text-warning-ink text-base">
                    {t("overQtyWarningTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="mt-1">
                    {t("overQtyWarningDesc")}
                  </AlertDialogDescription>
                </div>
              </div>
            </div>
            <AlertDialogFooter className="border-t px-5 py-3">
              <AlertDialogCancel onClick={handleOverQtyCancel}>
                {tc("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="warning"
                size="default"
                onClick={handleOverQtyConfirm}
              >
                <Check />
                {tc("confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Suspense fallback={null}>
          <PrSelectDialog
            open={selectDialogOpen}
            onOpenChange={setSelectDialogOpen}
            allCount={allCount}
            pendingCount={pendingCount}
            onSelectAll={handleSelectAll}
            onSelectPending={handleSelectPending}
          />
        </Suspense>
      </div>
    </PrStageRoleProvider>
  );
}
