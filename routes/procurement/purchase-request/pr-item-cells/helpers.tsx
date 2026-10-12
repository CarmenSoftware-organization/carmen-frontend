import { useController, useWatch, type Control } from "react-hook-form";
import { createContext, memo, useContext, type ReactNode } from "react";
import { LookupProductUnit } from "@/components/lookup/lookup-product-unit";
import { InputSuffixPlain } from "@/components/ui/input/input-suffix";
import { useProductUnits } from "@/hooks/use-product-units";
import { InventoryDialog } from "@/components/share/inventory-dialog";
import { PR_ITEM_STAGE_STATUS } from "@/types/purchase-request";
import { STAGE_ROLE } from "@/types/stage-role";
import type { PrFormValues } from "../pr-form-schema";

type PrUnitField = "requested_unit_id" | "approved_unit_id" | "foc_unit_id";

/** ช่องชื่อหน่วยคู่ของแต่ละช่อง id — ใช้เป็น defaultLabel ของ LookupProductUnit */
const UNIT_NAME_FIELD = {
  requested_unit_id: "requested_unit_name",
  approved_unit_id: "approved_unit_name",
  foc_unit_id: "foc_unit_name",
} as const satisfies Record<PrUnitField, string>;

export const STATUS_NORMALIZE: Record<string, string> = {
  approve: "approved",
  submit: "pending",
  reject: "rejected",
};

export const LOCATION_TYPE_VARIANT: Record<
  string,
  "info" | "warning" | "secondary"
> = {
  inventory: "info",
  direct: "warning",
  consignment: "secondary",
};

const PrStageRoleContext = createContext<string | undefined>(undefined);

/**
 * บอก stage role ของฟอร์มให้ cell ทุกใบรู้ โดยไม่ต้องส่ง prop ไล่ทีละชั้น
 *
 * role เป็นของทั้งฟอร์ม ไม่ใช่ของ cell ใด cell หนึ่ง และ cell ที่ต้องใช้มีสิบกว่าใบ
 * ถ้าไล่ส่ง prop แล้วลืมไปใบเดียวจะได้แถวที่ปลดล็อกครึ่งเดียว ซึ่งแย่กว่าล็อกทั้งแถว
 */
export function PrStageRoleProvider({
  role,
  children,
}: {
  readonly role?: string;
  readonly children: ReactNode;
}) {
  return (
    <PrStageRoleContext.Provider value={role}>
      {children}
    </PrStageRoleContext.Provider>
  );
}

export function isRowSettled(
  currentStageStatus: string,
  initialStageStatus: string,
): boolean {
  const normalized = STATUS_NORMALIZE[currentStageStatus] ?? currentStageStatus;
  if (
    normalized !== PR_ITEM_STAGE_STATUS.APPROVED &&
    normalized !== PR_ITEM_STAGE_STATUS.REJECTED
  )
    return false;
  // Lock only if the status was already approve/reject on initial load (from server)
  const initialNormalized =
    STATUS_NORMALIZE[initialStageStatus] ?? initialStageStatus;
  return (
    initialNormalized === PR_ITEM_STAGE_STATUS.APPROVED ||
    initialNormalized === PR_ITEM_STAGE_STATUS.REJECTED
  );
}

export function isRowLocked(
  item: { current_stage_status?: string; _initial_stage_status?: string },
  role?: string,
): boolean {
  const initialNormalized =
    STATUS_NORMALIZE[item._initial_stage_status ?? ""] ??
    item._initial_stage_status ??
    "";
  if (
    role === STAGE_ROLE.PURCHASE &&
    initialNormalized === PR_ITEM_STAGE_STATUS.APPROVED
  ) {
    return false;
  }
  return isRowSettled(
    item.current_stage_status ?? "",
    item._initial_stage_status ?? "",
  );
}

export function useIsRowSettled(
  control: Control<PrFormValues>,
  index: number,
): boolean {
  "use no memo";
  const currentStageStatus =
    useWatch({ control, name: `items.${index}.current_stage_status` }) ?? "";
  const initialStageStatus =
    useWatch({ control, name: `items.${index}._initial_stage_status` }) ?? "";
  return isRowSettled(currentStageStatus, initialStageStatus);
}

/**
 * แถวนี้แก้ไข/ติ๊กเลือกไม่ได้แล้วหรือยัง
 *
 * ปกติคือ "ตัดสินมาจาก server แล้ว" ยกเว้น **stage purchase**: ใบที่มาถึงฝ่ายจัดซื้อ
 * ล้วนผ่าน approve มาแล้ว การ approve นั้นเป็นผลของ stage ก่อนหน้า ไม่ใช่คำตัดสิน
 * ของ stage นี้ — ฝ่ายจัดซื้อต้องแก้จำนวน/ยอดเงินได้ และต้องส่งกลับหรือไม่อนุมัติได้
 * ถ้าหาของไม่ได้ จึงไม่ล็อก ส่วนใบที่ถูก reject มายังล็อกไว้เหมือนเดิม เพราะเป็น
 * คำตัดสินของคนอนุมัติ ไม่ใช่เรื่องของฝ่ายจัดซื้อ
 */
export function useIsRowLocked(
  control: Control<PrFormValues>,
  index: number,
): boolean {
  "use no memo";
  const role = useContext(PrStageRoleContext);
  const currentStageStatus =
    useWatch({ control, name: `items.${index}.current_stage_status` }) ?? "";
  const initialStageStatus =
    useWatch({ control, name: `items.${index}._initial_stage_status` }) ?? "";

  return isRowLocked(
    {
      current_stage_status: currentStageStatus,
      _initial_stage_status: initialStageStatus,
    },
    role,
  );
}

export const InventoryDialogCell = memo(function InventoryDialogCell({
  control,
  index,
  buCode,
  onOnHandClick,
  onOnOrderClick,
}: {
  control: Control<PrFormValues>;
  index: number;
  buCode?: string;
  onOnHandClick?: () => void;
  onOnOrderClick?: () => void;
}) {
  "use no memo";
  const locationId =
    useWatch({ control, name: `items.${index}.location_id` }) ?? "";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const productName =
    useWatch({ control, name: `items.${index}.product_name` }) ?? "";
  const productLocalName =
    useWatch({ control, name: `items.${index}.product_local_name` }) ?? "";
  const unitName =
    useWatch({ control, name: `items.${index}.requested_unit_name` }) ?? "";
  // on hand ณ ปัจจุบัน ไม่ส่งวันที่ของใบไป

  return (
    <InventoryDialog
      buCode={buCode}
      locationId={locationId}
      productId={productId}
      productName={productName}
      productLocalName={productLocalName}
      unitName={unitName}
      icon="package"
      className={productId ? "text-primary" : "text-muted-foreground"}
      onOnHandClick={onOnHandClick}
      onOnOrderClick={onOnOrderClick}
    />
  );
});

/**
 * unit lookup แบบไร้ border (Select) ฝังใน InputSuffixAddon ของกล่อง qty
 * cascade ตาม product_id ของ row — auto-select หน่วยแรกทำโดย LookupProductUnit เอง
 * `onExtraChange` ใช้ propagate หน่วยที่เลือก (requested → foc/approved) ทั้งตอน
 * auto-select และตอนผู้ใช้เลือกเอง เพราะ onValueChange ยิงทั้งสองกรณี
 */
export const WatchedProductUnit = memo(function WatchedProductUnit({
  control,
  index,
  unitField,
  isDisabled,
  onExtraChange,
}: {
  control: Control<PrFormValues>;
  index: number;
  unitField: PrUnitField;
  isDisabled: boolean;
  onExtraChange?: (value: string) => void;
}) {
  "use no memo";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const { field } = useController({
    control,
    name: `items.${index}.${unitField}`,
  });
  const unitName = useWatch({
    control,
    name: `items.${index}.${UNIT_NAME_FIELD[unitField]}`,
  });

  return (
    <LookupProductUnit
      productId={productId}
      value={field.value ?? ""}
      defaultLabel={unitName || undefined}
      onValueChange={(id) => {
        field.onChange(id);
        onExtraChange?.(id);
      }}
      disabled={isDisabled || !productId}
      className="h-full w-19 shrink-0 rounded-none border-0 bg-transparent px-2 text-xs shadow-none hover:bg-transparent focus-visible:ring-0"
    />
  );
});

export const QtyUnitPlain = memo(function QtyUnitPlain({
  control,
  index,
  unitField,
  value,
}: {
  control: Control<PrFormValues>;
  index: number;
  unitField: PrUnitField;
  value: ReactNode;
}) {
  "use no memo";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const unitId =
    useWatch({ control, name: `items.${index}.${unitField}` }) ?? "";
  const { data: units = [] } = useProductUnits(productId || undefined);
  const unitName = units.find((u) => u.id === unitId)?.name ?? "";
  return (
    <InputSuffixPlain
      className="w-full"
      value={value}
      suffix={unitName}
      suffixClassName="text-right"
    />
  );
});
