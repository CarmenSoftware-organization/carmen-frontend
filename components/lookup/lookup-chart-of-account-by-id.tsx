import { useChartOfAccountById } from "@/hooks/use-chart-of-account";
import {
  LookupChartOfAccount,
  type LookupChartOfAccountProps,
} from "./lookup-chart-of-account";

interface LookupChartOfAccountByIdProps extends Omit<
  LookupChartOfAccountProps,
  "value" | "onValueChange"
> {
  /** uuid ของ tb_chart_of_accounts — null/"" = ยังไม่เลือก */
  readonly value: string | null;
  /** ล้างค่า = null (backend ตีความ null เป็น "ล้าง" ส่วน omit = "ไม่เปลี่ยน") */
  readonly onValueChange: (id: string | null) => void;
}

/**
 * ตัวเลือกบัญชีที่เก็บ **uuid** ของแถวผัง — `LookupChartOfAccount` ใช้ `code` เป็น value
 * แต่ API ของ vendor / adjustment type รับและตอบแค่ uuid (ไม่มี code ปนมา) จึงดึงแถวตาม
 * id ครั้งเดียวเพื่อแปลง uuid → code แล้วส่งแถวนั้นเป็น `selectedItems` ให้ picker แสดงป้าย
 * ค่าปัจจุบันได้ แม้บัญชีอยู่นอก 100 รายการแรกหรือถูกปิดใช้งานแล้ว (ไม่ใช้ข้อมูลตัวอย่าง
 * เพราะ id ของมันไม่ใช่ uuid)
 */
export function LookupChartOfAccountById({
  value,
  onValueChange,
  ...rest
}: LookupChartOfAccountByIdProps) {
  const { data: account } = useChartOfAccountById(value || undefined);

  return (
    <LookupChartOfAccount
      {...rest}
      demoFallback={false}
      selectedItems={account ? [account] : undefined}
      value={account && account.id === value ? account.code : ""}
      onValueChange={(_code, picked) => onValueChange(picked?.id ?? null)}
    />
  );
}
