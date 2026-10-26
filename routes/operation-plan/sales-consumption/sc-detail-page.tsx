import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { FormPageShell } from "@/components/share/form-page-shell";
import { VoidDialog } from "@/components/share/void-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setURLParams, useURL } from "@/hooks/use-url";
import { getUserErrorMessage } from "@/lib/error-message";
import type { ScVerifyResult } from "@/types/sales-consumption";
import { useCan } from "@/hooks/use-can";
import { PERMISSIONS } from "@/constant/permissions";
import { usePosWritable } from "../shared/use-pos-writable";
import { ScDetailHeader } from "./sc-detail-header";
import { ScHistory } from "./sc-history";
import { ScIngredients } from "./sc-ingredients";
import { ScSalesLines } from "./sc-sales-lines";
import {
  usePostSalesConsumption,
  useSalesConsumption,
  useVerifyScOnhand,
  useVoidSalesConsumption,
} from "./use-sales-consumption";

type DetailTab = "sales" | "ingredients" | "history";
const TABS: readonly DetailTab[] = ["sales", "ingredients", "history"];

interface ScDetailPageProps {
  readonly id: string;
}

/**
 * หน้ารายละเอียด Sales Consumption หนึ่งวันขาย — แก้ Location/สูตรของแต่ละบรรทัด
 * ตรวจ on-hand แล้ว Post (ใบจ่ายออกหนึ่งใบต่อ location) หรือ Void
 *
 * ผลตรวจ on-hand รายสินค้าเก็บเป็น state ของหน้า (detail endpoint คืนแค่เวลา/ok/stale)
 * จึงหายเมื่อรีเฟรชหน้า — ปุ่ม Post ตัดสินจาก `verification` ที่ backend บันทึกไว้
 *
 * @param id - id ของ Sales Consumption จาก URL
 * @returns React element ของหน้า
 */
export function ScDetailPage({ id }: ScDetailPageProps) {
  const t = useTranslations("operationPlan.salesConsumption.detail");
  const tErr = useTranslations("errors");
  const navigate = useNavigate();
  const { canWrite } = usePosWritable();
  const { canWrite: contractWritable, can } = useCan();
  // Void ไม่ผูกกับการเปิด POS — ปิด POS แล้วยังต้องคืนสต็อกได้
  const canVoid =
    contractWritable && can(PERMISSIONS.inventory_management.stock_out.delete);
  const { data: sc, isLoading, error, refetch } = useSalesConsumption(id);
  const [tabRaw] = useURL("tab");
  const [verifyResult, setVerifyResult] = useState<ScVerifyResult | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);

  const verifyMutation = useVerifyScOnhand(id);
  const postMutation = usePostSalesConsumption(id);
  const voidMutation = useVoidSalesConsumption(id);

  const tab: DetailTab = TABS.includes(tabRaw as DetailTab)
    ? (tabRaw as DetailTab)
    : "sales";
  const backToList = () => navigate("/operation-plan/sales-consumption");

  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }
  if (isLoading || !sc) {
    return (
      <FormPageShell width="wide" header={<Skeleton className="h-8 w-64" />}>
        <Skeleton className="h-64 w-full" />
      </FormPageShell>
    );
  }

  const unresolvedLines = sc.lines.filter(
    (l) => l.state === "needs_location" || l.state === "needs_recipe",
  ).length;
  const unresolvedCount = unresolvedLines + sc.ingredient_problems.length;
  const verification = sc.verification;
  const canPost =
    unresolvedCount === 0 && verification?.ok === true && !verification.stale;
  // ผลรายสินค้าใช้ได้เฉพาะตอนที่ backend ยังถือว่าผลตรวจตรงกับบรรทัดปัจจุบัน
  const liveVerify = verification && !verification.stale ? verifyResult : null;

  const onVerify = () =>
    verifyMutation.mutate(undefined, {
      onSuccess: (res) => {
        setVerifyResult(res.data);
        setURLParams({ tab: "ingredients" });
        if (res.data.ok) toast.success(t("actions.verifyDone"));
        else toast.warning(t("actions.verifyShort"));
      },
      onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
    });

  const onPost = () =>
    postMutation.mutate(
      { doc_version: sc.doc_version },
      {
        onSuccess: () => {
          setVerifyResult(null);
          toast.success(t("actions.posted"));
        },
        onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
      },
    );

  const onVoid = (reason: string) =>
    voidMutation.mutate(
      { void_reason: reason, doc_version: sc.doc_version },
      {
        onSuccess: (res) => {
          setVoidOpen(false);
          setVerifyResult(null);
          toast.success(t("actions.voided"));
          // ใบนี้ว่างแล้ว (บรรทัดย้ายไป SC ใบใหม่ของวัน) — พาไปใบใหม่เมื่อมี
          const newId = res.data.new_sc_id;
          if (newId) navigate(`/operation-plan/sales-consumption/${newId}`);
        },
        onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
      },
    );

  return (
    <FormPageShell
      width="wide"
      header={
        <ScDetailHeader
          sc={sc}
          canWrite={canWrite}
          canVoid={canVoid}
          unresolvedLines={unresolvedLines}
          unresolvedCount={unresolvedCount}
          canPost={canPost}
          onBack={backToList}
          onVerify={onVerify}
          onPost={onPost}
          onVoid={() => setVoidOpen(true)}
          isVerifying={verifyMutation.isPending}
          isPosting={postMutation.isPending}
        />
      }
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setURLParams({ tab: v === "sales" ? "" : v })}
      >
        <TabsList>
          {TABS.map((v) => (
            <TabsTrigger key={v} value={v}>
              {t(`tabs.${v}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="sales" className="mt-4">
          <ScSalesLines sc={sc} canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="ingredients" className="mt-4">
          <ScIngredients sc={sc} verify={liveVerify} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <ScHistory sc={sc} />
        </TabsContent>
      </Tabs>

      <VoidDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title={t("actions.voidTitle")}
        description={t("actions.voidDescription")}
        isPending={voidMutation.isPending}
        onConfirm={onVoid}
      />
    </FormPageShell>
  );
}
