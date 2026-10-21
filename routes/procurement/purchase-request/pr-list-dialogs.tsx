import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import type { PurchaseRequest } from "@/types/purchase-request";
import { PrActionDialog } from "./workflow/pr-action-dialog";
import {
  useDeletePurchaseRequest,
  useBatchApprovePurchaseRequest,
  useBatchRejectPurchaseRequest,
  useBatchDeletePurchaseRequest,
} from "./use-purchase-request";
import type { usePrTable } from "./use-pr-table";
import { getSwipeFailures, STAGE_ACTION_DISABLED_CODE } from "./swipe-results";

interface PrListDialogsProps {
  deleteTarget: PurchaseRequest | null;
  setDeleteTarget: (item: PurchaseRequest | null) => void;
  approveTarget: PurchaseRequest | null;
  setApproveTarget: (item: PurchaseRequest | null) => void;
  rejectTarget: PurchaseRequest | null;
  setRejectTarget: (item: PurchaseRequest | null) => void;
  batchApproveOpen: boolean;
  setBatchApproveOpen: (open: boolean) => void;
  batchRejectOpen: boolean;
  setBatchRejectOpen: (open: boolean) => void;
  batchDeleteOpen: boolean;
  setBatchDeleteOpen: (open: boolean) => void;
  selectedItems: PurchaseRequest[];
  pageItemCount: number;
  clearSelection: () => void;
  table: ReturnType<typeof usePrTable>;
}

/**
 * dialog ทั้งหมดของหน้ารายการ PR — อนุมัติ/ไม่อนุมัติ/ลบ ทั้งแบบใบเดียวและแบบเลือกหลายใบ
 * mutation ทั้งสี่ตัวอยู่ในนี้เพราะไม่มีใครนอก dialog เรียกใช้
 */
export function PrListDialogs({
  deleteTarget,
  setDeleteTarget,
  approveTarget,
  setApproveTarget,
  rejectTarget,
  setRejectTarget,
  batchApproveOpen,
  setBatchApproveOpen,
  batchRejectOpen,
  setBatchRejectOpen,
  batchDeleteOpen,
  setBatchDeleteOpen,
  selectedItems,
  pageItemCount,
  clearSelection,
  table,
}: PrListDialogsProps) {
  const t = useTranslations("procurement.purchaseRequest");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");
  const te = useTranslations("errors");
  const deletePurchaseRequest = useDeletePurchaseRequest();
  const batchApprovePurchaseRequest = useBatchApprovePurchaseRequest();
  const batchRejectPurchaseRequest = useBatchRejectPurchaseRequest();
  const batchDeletePurchaseRequest = useBatchDeletePurchaseRequest();

  /**
   * อ่านผลรายใบของ swipe แล้วขึ้น toast — success เฉพาะเมื่อทุกใบผ่าน
   * ใบที่ backend บล็อกมาใน 200 (เช่น stage ปิด action) ไม่ใช่ HTTP error จึงต้องเช็คเอง
   * @returns true เมื่อทุกใบสำเร็จ
   */
  const reportSwipeResult = (
    response: unknown,
    items: PurchaseRequest[],
    successKey: "approveSuccess" | "rejectSuccess",
  ) => {
    const failures = getSwipeFailures(response);
    if (failures.length === 0) {
      toast.success(tt(successKey, { entity: t("entity") }));
      return true;
    }
    const prNos = failures
      .map((f) => items.find((item) => item.id === f.id)?.pr_no ?? f.id)
      .join(", ");
    const allStageDisabled = failures.every(
      (f) => f.app_code === STAGE_ACTION_DISABLED_CODE,
    );
    toast.error(
      allStageDisabled
        ? te(`byCode.${STAGE_ACTION_DISABLED_CODE}`)
        : t("swipePartialFailed"),
      { description: t("swipeFailedDocs", { prNos }) },
    );
    return false;
  };

  return (
    <>
      <PrActionDialog
        open={!!approveTarget}
        onOpenChange={(open) =>
          !open &&
          !batchApprovePurchaseRequest.isPending &&
          setApproveTarget(null)
        }
        title={t("approveTitle")}
        description={t("approveConfirm", { prNo: approveTarget?.pr_no ?? "" })}
        confirmVariant="success"
        confirmLabel={tc("approve")}
        showMessage={false}
        isPending={batchApprovePurchaseRequest.isPending}
        onConfirm={() => {
          if (!approveTarget) return;
          batchApprovePurchaseRequest.mutate(
            { pr_ids: [approveTarget.id] },
            {
              onSuccess: (res) => {
                reportSwipeResult(res, [approveTarget], "approveSuccess");
                setApproveTarget(null);
              },
            },
          );
        }}
      />
      <PrActionDialog
        open={!!rejectTarget}
        onOpenChange={(open) =>
          !open &&
          !batchRejectPurchaseRequest.isPending &&
          setRejectTarget(null)
        }
        title={t("rejectTitle")}
        description={t("rejectConfirm", { prNo: rejectTarget?.pr_no ?? "" })}
        confirmVariant="destructive"
        confirmLabel={tc("reject")}
        isPending={batchRejectPurchaseRequest.isPending}
        onConfirm={(messages) => {
          if (!rejectTarget) return;
          batchRejectPurchaseRequest.mutate(
            { pr_ids: [rejectTarget.id], reject_message: messages[0] ?? "" },
            {
              onSuccess: (res) => {
                reportSwipeResult(res, [rejectTarget], "rejectSuccess");
                setRejectTarget(null);
              },
            },
          );
        }}
      />
      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deletePurchaseRequest.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { prNo: deleteTarget?.pr_no ?? "" })}
        isPending={deletePurchaseRequest.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePurchaseRequest.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(tt("deleteSuccess", { entity: t("entity") }));
              setDeleteTarget(null);
            },
          });
        }}
      />

      <PrActionDialog
        open={batchApproveOpen}
        onOpenChange={(open) =>
          !open &&
          !batchApprovePurchaseRequest.isPending &&
          setBatchApproveOpen(false)
        }
        title={t("batchApproveTitle")}
        description={
          <div className="space-y-2">
            <p>{t("batchApproveConfirm", { count: selectedItems.length })}</p>
            <ul className="space-y-1 text-xs">
              {selectedItems.map((item) => (
                <li key={item.id}>{item.pr_no}</li>
              ))}
            </ul>
          </div>
        }
        confirmVariant="success"
        confirmLabel={tc("approve")}
        showMessage={false}
        isPending={batchApprovePurchaseRequest.isPending}
        onConfirm={() => {
          const selectedIds = selectedItems.map((item) => item.id);
          batchApprovePurchaseRequest.mutate(
            { pr_ids: selectedIds },
            {
              onSuccess: (res) => {
                reportSwipeResult(res, selectedItems, "approveSuccess");
                setBatchApproveOpen(false);
                clearSelection();
              },
            },
          );
        }}
      />

      <PrActionDialog
        open={batchRejectOpen}
        onOpenChange={(open) =>
          !open &&
          !batchRejectPurchaseRequest.isPending &&
          setBatchRejectOpen(false)
        }
        title={t("batchRejectTitle")}
        description={
          <div className="space-y-2">
            <p>{t("batchRejectConfirm", { count: selectedItems.length })}</p>
            <ul className="space-y-1 text-xs">
              {selectedItems.map((item) => (
                <li key={item.id}>{item.pr_no}</li>
              ))}
            </ul>
          </div>
        }
        confirmVariant="destructive"
        confirmLabel={tc("reject")}
        isPending={batchRejectPurchaseRequest.isPending}
        onConfirm={(messages) => {
          const selectedIds = selectedItems.map((item) => item.id);
          batchRejectPurchaseRequest.mutate(
            { pr_ids: selectedIds, reject_message: messages[0] ?? "" },
            {
              onSuccess: (res) => {
                reportSwipeResult(res, selectedItems, "rejectSuccess");
                setBatchRejectOpen(false);
                clearSelection();
              },
            },
          );
        }}
      />

      <DeleteDialog
        open={batchDeleteOpen}
        onOpenChange={(open) =>
          !open &&
          !batchDeletePurchaseRequest.isPending &&
          setBatchDeleteOpen(false)
        }
        title={t("batchDeleteTitle")}
        description={t("batchDeleteConfirm", { count: selectedItems.length })}
        isPending={batchDeletePurchaseRequest.isPending}
        onConfirm={() => {
          // ลบทั้งหน้า = หน้านี้จะว่างหลัง refetch ต้องถอยไปหน้าก่อนหน้าเอง
          // ไม่งั้นคนใช้เจอหน้าเปล่าแล้วนึกว่าข้อมูลหายหมด
          const clearsPage = selectedItems.length === pageItemCount;
          batchDeletePurchaseRequest.mutate(
            { ids: selectedItems.map((item) => item.id) },
            {
              onSuccess: () => {
                toast.success(tt("deleteSuccess", { entity: t("entity") }));
                clearSelection();
                setBatchDeleteOpen(false);
                if (clearsPage && table.getState().pagination.pageIndex > 0) {
                  table.previousPage();
                }
              },
            },
          );
        }}
      />
    </>
  );
}
