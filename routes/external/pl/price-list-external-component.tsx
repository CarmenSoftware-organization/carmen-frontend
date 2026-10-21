import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  usePriceListExternal,
  useExternalTaxProfiles,
  useUpdatePriceListExternal,
  useSubmitPriceListExternal,
  HttpError,
} from "./use-price-list-external";
import { toast } from "sonner";
import type { PricelistExternalDto } from "@/types/price-list-external";
import { ErrorState } from "@/components/ui/error-state";
import PriceListExternalHeader from "./price-list-external-header";
import PriceListExternalProductTable from "./price-list-external-product-table";
import PriceListExternalSkeleton from "./price-list-external-skeleton";
import PriceListExternalExpired from "./price-list-external-expired";
import PriceListExternalImportDialog from "./price-list-external-import-dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Eye, Pencil, Upload } from "lucide-react";
import { readXlsxFirstSheet } from "@/lib/xlsx-utils";
import {
  applyExcelRows,
  downloadExternalPricelistXlsx,
} from "./price-list-external-excel";

interface PriceListExternalComponentProps {
  urlToken: string;
}

export default function PriceListExternalComponent({
  urlToken,
}: PriceListExternalComponentProps) {
  const t = useTranslations("priceListPortal");
  const { data, isLoading, isError, error, refetch } =
    usePriceListExternal(urlToken);
  const { data: taxProfiles } = useExternalTaxProfiles(urlToken);

  const updateMutation = useUpdatePriceListExternal(urlToken);
  const submitMutation = useSubmitPriceListExternal(urlToken);

  const [isViewMode, setIsViewMode] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  // Initialize form
  const form = useForm<PricelistExternalDto>({
    defaultValues: {
      id: "",
      pricelist_no: "",
      name: "",
      status: "draft",
      vendor: { id: null, name: null },
      hotel: null,
      currency_id: "",
      currency_code: "",
      effective_from_date: "",
      effective_to_date: "",
      description: null,
      note: null,
      tb_pricelist_detail: [],
    },
  });

  // Reset form when data is loaded — MOQ ขั้นต่ำ default เป็น 1 (0 ไม่สมเหตุผล)
  useEffect(() => {
    if (data) {
      form.reset({
        ...data,
        tb_pricelist_detail: data.tb_pricelist_detail.map((d) => ({
          ...d,
          moq_qty: d.moq_qty || 1,
        })),
      });
    }
  }, [data, form]);

  const handleSave = async () => {
    // vendor save draft ได้ตลอด (ไม่บังคับว่าต้องมีการเปลี่ยนแปลง) — โพสต์ค่าปัจจุบัน
    const formData = form.getValues();

    try {
      await updateMutation.mutateAsync(formData);
      toast.success(t("toastDraftSaved"));
      form.reset(formData);
      setIsViewMode(true);
    } catch (err) {
      // surface ข้อความจริงจาก backend (เช่น validation / ลิงก์หมดอายุ) ให้ vendor
      // ภายนอกเห็น แทนข้อความ generic — invalidate/refetch จัดการ reset เอง
      toast.error(
        err instanceof HttpError ? err.message : t("toastSaveFailed"),
      );
    }
  };

  const handleSubmit = async () => {
    try {
      // ถ้ายังมีการแก้ที่ยังไม่เซฟ → save draft ก่อน แล้วค่อย submit
      // (submit เอง finalize อย่างเดียว ไม่มี payload) · ไม่ dirty ก็ submit เลย
      if (form.formState.isDirty) {
        const formData = form.getValues();
        await updateMutation.mutateAsync(formData);
        form.reset(formData);
      }
      await submitMutation.mutateAsync();
      toast.success(t("toastSubmitted"));
      setIsViewMode(true);
    } catch (err) {
      toast.error(
        err instanceof HttpError ? err.message : t("toastSubmitFailed"),
      );
    }
  };

  // ยืนยันก่อน submit — submit แล้ว vendor แก้ต่อไม่ได้ (finalize)
  const handleConfirmSubmit = async () => {
    await handleSubmit();
    setConfirmSubmitOpen(false);
  };

  // export ค่าปัจจุบันใน form (รวมที่แก้ยังไม่เซฟ) เป็น xlsx
  const handleDownloadExcel = () => {
    downloadExternalPricelistXlsx(form.getValues(), taxProfiles ?? []).catch(
      () => toast.error(t("toastExcelFailed")),
    );
  };

  // vendor เลือกไฟล์ที่กรอกมา → parse → เอาค่ากลับเข้า form → เซฟ draft ให้เลย
  // (setValue array อย่างเดียว useFieldArray ใน table อาจไม่ resync — reset หลัง
  //  save คือตัวที่ sync UI จริง · เซฟเลยกัน submit หลุดค่าเพราะ form ไม่ dirty)
  const handleImportExcel = async (file: File) => {
    let rows: Record<string, unknown>[];
    try {
      rows = await readXlsxFirstSheet(file);
    } catch {
      toast.error(t("toastReadFailed"));
      return;
    }
    const result = applyExcelRows(
      rows,
      form.getValues("tb_pricelist_detail"),
      taxProfiles ?? [],
    );
    if (!result.ok) {
      toast.error(
        result.reason === "structure"
          ? t("toastWrongStructure")
          : t("toastNoMatch"),
      );
      return;
    }
    const { updated, applied, skipped } = result;
    try {
      const formData = { ...form.getValues(), tb_pricelist_detail: updated };
      await updateMutation.mutateAsync(formData);
      form.reset(formData);
      setIsViewMode(true);
      toast.success(
        skipped
          ? t("toastImportedSkipped", { applied, skipped })
          : t("toastImported", { applied }),
      );
    } catch (err) {
      toast.error(
        err instanceof HttpError ? err.message : t("toastImportSaveFailed"),
      );
    }
  };

  // คนกรอกคือแอดมินของผู้ขายที่เพิ่งได้ลิงก์ทางอีเมล ปิดแท็บทีเดียวราคาทั้งใบหาย
  // และกู้เองไม่ได้ — ดักทั้งปิด/รีเฟรชแท็บ และกด back
  // (hook ต้องอยู่เหนือ early return ทุกตัว ไม่งั้นลำดับ hook เพี้ยน)
  const isDirty = form.formState.isDirty;
  const navGuard = useNavigationGuard(isDirty);
  useUnsavedChanges(isDirty);

  if (isLoading) {
    return <PriceListExternalSkeleton />;
  }

  if (isError) {
    // 401 = ลิงก์หมดอายุ/ใช้ไม่ได้ — โชว์หน้าเป็นมิตร (ไม่พูดถึง token) แทน
    // error ดิบ · error อื่นค่อยใช้ ErrorState ที่ retry ได้
    if (error instanceof HttpError && error.status === 401) {
      return <PriceListExternalExpired />;
    }
    return <ErrorState message={error?.message} onRetry={() => refetch()} />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="space-y-8 p-6 md:p-8">
          <PriceListExternalHeader data={data} />

          <div className="border-border space-y-6 border-t pt-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                {isViewMode ? t("introView") : t("introEdit")}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {/* ดาวน์โหลดค่าปัจจุบันไปกรอก/ดูใน excel — ใช้ได้ทุกสถานะ */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadExcel}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  {t("excel")}
                </Button>
                {/* submit แล้ว vendor แก้ไม่ได้อีก → ซ่อน upload + สลับ edit mode */}
                {data.status !== "submitted" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImportOpen(true)}
                      disabled={updateMutation.isPending}
                      className="gap-1.5"
                    >
                      <Upload className="h-4 w-4" />
                      {t("import")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsViewMode(!isViewMode)}
                      className="gap-1.5"
                    >
                      {/* ป้ายบอก "กดแล้วจะได้ทำอะไร" ไม่ใช่ชื่อโหมด — คนอ่านคือ
                          แอดมินฝ่ายขายของ vendor ที่เพิ่งได้ลิงก์มา ไม่เคยเห็นระบบนี้
                          "Edit/View Mode" เป็นภาษาซอฟต์แวร์ ส่วนสิ่งที่เขามาทำจริง
                          คือใส่ราคา */}
                      {isViewMode ? (
                        <>
                          <Pencil className="h-4 w-4" />
                          {t("enterPrices")}
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          {t("preview")}
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <PriceListExternalProductTable
              form={form}
              isViewMode={isViewMode}
              onSave={handleSave}
              onSubmit={() => setConfirmSubmitOpen(true)}
              isSaving={updateMutation.isPending}
              isSubmitting={submitMutation.isPending}
              taxProfiles={taxProfiles ?? []}
            />
          </div>
        </div>
      </div>

      <PriceListExternalImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onFile={handleImportExcel}
        isImporting={updateMutation.isPending}
      />

      <AlertDialog
        open={confirmSubmitOpen}
        onOpenChange={
          submitMutation.isPending || updateMutation.isPending
            ? undefined
            : setConfirmSubmitOpen
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("submitConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("submitConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={submitMutation.isPending || updateMutation.isPending}
            >
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmSubmit();
              }}
              disabled={submitMutation.isPending || updateMutation.isPending}
            >
              {submitMutation.isPending || updateMutation.isPending
                ? t("submitting")
                : t("submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(open) => {
          if (!open) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />
    </div>
  );
}
