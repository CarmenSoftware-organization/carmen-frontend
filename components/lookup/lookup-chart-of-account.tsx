import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { useChartOfAccount } from "@/hooks/use-chart-of-account";
import { LookupCombobox } from "./lookup-combobox";
import { Badge } from "@/components/ui/badge";
import {
  ACCOUNT_NATURE,
  CHART_OF_ACCOUNT_TYPE,
  type AccountCategory,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";

export const DEFAULT_CHART_OF_ACCOUNTS: ChartOfAccount[] = [
  {
    id: "coa-1110-01",
    doc_version: 1,
    code: "1110-01",
    description_1: "Petty Cash",
    description_2: "เงินสดย่อย",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-1112-01",
    doc_version: 1,
    code: "1112-01",
    description_1: "Cash at Bank - KBANK THB",
    description_2: "เงินฝากธนาคารกสิกรไทย",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-1112-02",
    doc_version: 1,
    code: "1112-02",
    description_1: "Cash at Bank - SCB THB",
    description_2: "เงินฝากธนาคารไทยพาณิชย์",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-1150-01",
    doc_version: 1,
    code: "1150-01",
    description_1: "Input VAT (ภาษีซื้อ)",
    description_2: "ภาษีซื้อ",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-1410-01",
    doc_version: 1,
    code: "1410-01",
    description_1: "Computer Hardware & Software",
    description_2: "อุปกรณ์คอมพิวเตอร์และซอฟต์แวร์",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-1419-01",
    doc_version: 1,
    code: "1419-01",
    description_1: "Accumulated Dep. - Computer",
    description_2: "ค่าเสื่อมราคาสะสม - คอมพิวเตอร์",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-1420-01",
    doc_version: 1,
    code: "1420-01",
    description_1: "Furniture & Fixtures",
    description_2: "เฟอร์นิเจอร์และเครื่องตกแต่ง",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-1429-01",
    doc_version: 1,
    code: "1429-01",
    description_1: "Accumulated Dep. - Furniture",
    description_2: "ค่าเสื่อมราคาสะสม - เฟอร์นิเจอร์",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-1430-01",
    doc_version: 1,
    code: "1430-01",
    description_1: "Operating Equipment",
    description_2: "เครื่องมือและอุปกรณ์ดำเนินงาน",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-1439-01",
    doc_version: 1,
    code: "1439-01",
    description_1: "Accumulated Dep. - Equipment",
    description_2: "ค่าเสื่อมราคาสะสม - เครื่องมืออุปกรณ์",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "asset",
    is_active: true,
  },
  {
    id: "coa-2110-01",
    doc_version: 1,
    code: "2110-01",
    description_1: "Trade Accounts Payable",
    description_2: "เจ้าหนี้การค้า",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "liability",
    is_active: true,
  },
  {
    id: "coa-21100",
    doc_version: 1,
    code: "21100",
    description_1: "Accounts Payable Accrual",
    description_2: "เจ้าหนี้ค้างจ่าย",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "liability",
    is_active: true,
  },
  {
    id: "coa-2141-01",
    doc_version: 1,
    code: "2141-01",
    description_1: "Withholding Tax Payable (ภ.ง.ด. 3)",
    description_2: "ภาษีหัก ณ ที่จ่ายค้างจ่าย ภ.ง.ด. 3",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "liability",
    is_active: true,
  },
  {
    id: "coa-2141-02",
    doc_version: 1,
    code: "2141-02",
    description_1: "Withholding Tax Payable (ภ.ง.ด. 53)",
    description_2: "ภาษีหัก ณ ที่จ่ายค้างจ่าย ภ.ง.ด. 53",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "liability",
    is_active: true,
  },
  {
    id: "coa-2150-01",
    doc_version: 1,
    code: "2150-01",
    description_1: "Output VAT (ภาษีขาย)",
    description_2: "ภาษีขาย",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "liability",
    is_active: true,
  },
  {
    id: "coa-3100-01",
    doc_version: 1,
    code: "3100-01",
    description_1: "Retained Earnings",
    description_2: "กำไรสะสม",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
    category: "equity",
    is_active: true,
  },
  {
    id: "coa-41000",
    doc_version: 1,
    code: "41000",
    description_1: "Room Revenue",
    description_2: "รายได้ค่าห้องพัก",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "revenue",
    is_active: true,
  },
  {
    id: "coa-42000",
    doc_version: 1,
    code: "42000",
    description_1: "Food & Beverage Revenue",
    description_2: "รายได้อาหารและเครื่องดื่ม",
    nature: ACCOUNT_NATURE.CREDIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "revenue",
    is_active: true,
  },
  {
    id: "coa-51001",
    doc_version: 1,
    code: "51001",
    description_1: "Electricity Expense",
    description_2: "ค่าไฟฟ้า",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "expense",
    is_active: true,
  },
  {
    id: "coa-51002",
    doc_version: 1,
    code: "51002",
    description_1: "Water Expense",
    description_2: "ค่าน้ำประปา",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "expense",
    is_active: true,
  },
  {
    id: "coa-5310-01",
    doc_version: 1,
    code: "5310-01",
    description_1: "Depreciation Expense - Computer",
    description_2: "ค่าเสื่อมราคา - คอมพิวเตอร์",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "expense",
    is_active: true,
  },
  {
    id: "coa-5310-02",
    doc_version: 1,
    code: "5310-02",
    description_1: "Depreciation Expense - Furniture",
    description_2: "ค่าเสื่อมราคา - เฟอร์นิเจอร์",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "expense",
    is_active: true,
  },
  {
    id: "coa-5310-03",
    doc_version: 1,
    code: "5310-03",
    description_1: "Depreciation Expense - Equipment",
    description_2: "ค่าเสื่อมราคา - เครื่องมืออุปกรณ์",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "expense",
    is_active: true,
  },
  {
    id: "coa-6100",
    doc_version: 1,
    code: "6100",
    description_1: "General Operating Expense",
    description_2: "ค่าใช้จ่ายดำเนินงานทั่วไป",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "expense",
    is_active: true,
  },
  {
    id: "coa-61010",
    doc_version: 1,
    code: "61010",
    description_1: "Operating Supplies",
    description_2: "ของใช้สิ้นเปลืองดำเนินงาน",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "expense",
    is_active: true,
  },
  {
    id: "coa-6200",
    doc_version: 1,
    code: "6200",
    description_1: "Office Supplies",
    description_2: "เครื่องเขียนและอุปกรณ์สำนักงาน",
    nature: ACCOUNT_NATURE.DEBIT,
    type: CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
    category: "expense",
    is_active: true,
  },
];

export interface LookupChartOfAccountProps {
  readonly value: string;
  readonly onValueChange: (value: string, account?: ChartOfAccount) => void;
  readonly category?: AccountCategory | AccountCategory[];
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
  readonly readOnly?: boolean;
  readonly activeOnly?: boolean;
  /**
   * default `true` — ผู้เรียกเกือบทั้งหมดอยู่ใน Sheet/Dialog ซึ่งล็อกการเลื่อนนอกกล่อง
   * ของมัน แต่ popover ถูก portal ออกไปที่ body → ถ้าไม่ modal รายการจะเลื่อนไม่ได้
   */
  readonly modal?: boolean;
  /** รายการที่ผู้เรียกรู้จักอยู่แล้ว — ให้ combobox แสดงป้ายของค่าที่เลือกได้แม้อยู่นอก 100 แถวแรก */
  readonly selectedItems?: ChartOfAccount[];
  /** default `true` — ปิดเมื่อ value เป็น uuid จริง (ข้อมูลตัวอย่างใช้ id ที่ไม่ใช่ uuid) */
  readonly demoFallback?: boolean;
}

export function LookupChartOfAccount({
  value,
  onValueChange,
  category,
  disabled,
  placeholder,
  className,
  size,
  error,
  readOnly,
  activeOnly = true,
  modal = true,
  selectedItems,
  demoFallback = true,
}: LookupChartOfAccountProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [hasOpened, setHasOpened] = useState(false);
  const { data, isLoading } = useChartOfAccount(
    { perpage: 100 },
    { enabled: hasOpened || !!value },
  );

  const rows = data?.data;
  const accounts = useMemo(() => {
    const list =
      rows && rows.length > 0
        ? rows
        : demoFallback
          ? DEFAULT_CHART_OF_ACCOUNTS
          : [];

    const categories = category
      ? Array.isArray(category)
        ? category
        : [category]
      : null;

    return list.filter((acc) => {
      if (activeOnly && !acc.is_active) return false;
      if (categories && (!acc.category || !categories.includes(acc.category)))
        return false;
      return true;
    });
  }, [rows, category, activeOnly, demoFallback]);

  const resolvedPlaceholder =
    placeholder ?? tl("select", { entity: tfl("glAccount") });

  return (
    <LookupCombobox
      resizeKey="chart-of-account"
      size={size}
      value={value}
      onValueChange={(code, item) => onValueChange(code, item)}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={accounts}
      selectedItems={selectedItems}
      getId={(acc) => acc.code}
      getLabel={(acc) => `${acc.code} - ${acc.description_1}`}
      getSearchValue={(acc) =>
        `${acc.code} ${acc.description_1} ${acc.description_2 ?? ""} ${acc.category}`
      }
      renderItem={(acc) => (
        <div className="flex w-full items-center justify-between gap-2 text-xs">
          <div className="min-w-0 flex-1 truncate">
            <span className="font-mono font-semibold">{acc.code}</span>
            <span className="text-muted-foreground ml-2">
              {acc.description_1}
            </span>
          </div>
          {/* ข้อมูลจริงจาก API มักไม่มี category — Badge ว่างจะกลายเป็นวงกลมเปล่าท้ายแถว */}
          {acc.category && (
            <Badge variant="outline" size="xs" className="shrink-0 uppercase">
              {acc.category}
            </Badge>
          )}
        </div>
      )}
      placeholder={resolvedPlaceholder}
      searchPlaceholder={tl("search", { entity: tfl("glAccount") })}
      disabled={disabled}
      readOnly={readOnly}
      isLoading={isLoading}
      className={className}
      error={error}
      modal={modal}
    />
  );
}
