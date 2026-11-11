import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  Banknote,
  Box,
  Boxes,
  Briefcase,
  Building,
  Building2,
  Calendar,
  ChefHat,
  ChevronRight,
  CircleDashed,
  Coins,
  Eraser,
  FileText,
  Flag,
  Folder,
  FolderTree,
  Gauge,
  Globe,
  LayoutTemplate,
  ListChecks,
  ListFilterPlus,
  Bookmark,
  MapPin,
  ReceiptText,
  Shapes,
  SlidersHorizontal,
  Store,
  Tag,
  Undo2,
  UserRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterInlineContext } from "@/components/ui/filter-inline-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { chipValueText } from "@/hooks/use-list-filters";
import { cn } from "@/lib/utils";
import { FilterFieldControl } from "./filter-field-control";
import type { FilterFieldDef, FilterPeerAccess } from "@/types/list-filter";

const CONTROL_ICONS: Record<FilterFieldDef["control"], LucideIcon> = {
  status: CircleDashed,
  "multi-select": ListChecks,
  "date-range": Calendar,
  "amount-range": Banknote,
  entity: SlidersHorizontal,
  stage: Flag,
  workflow: Workflow,
  custom: SlidersHorizontal,
};

/**
 * icon ตามความหมายของ field ผูกกับ labelKey ตรง ๆ — field เดียวกันได้ icon
 * เดียวกันทุกหน้า (vendor 4 หน้า, type ทุก variant ฯลฯ) โดยไม่ต้องไล่ประกาศ
 * `icon` ราย field def ประมาณ 50 จุด — field ที่ห่อเป็น custom (เมนูมองไส้ไม่เห็น)
 * ก็ได้ icon ที่สื่อจาก labelKey แทน SlidersHorizontal generic
 * เพิ่ม field ใหม่ที่ labelKey ไม่อยู่ในนี้ = ตกไปใช้ default ตามชนิด control
 */
const FIELD_ICONS: Record<string, LucideIcon> = {
  // คู่ค้า / เอกสารอ้างอิง
  "field.vendor": Store,
  "field.invoiceNo": ReceiptText,
  "field.purchaseOrder": FileText,
  // ประเภท / หมวดหมู่
  "field.type": Tag,
  "common.type": Tag,
  "procurement.purchaseOrder.type": Tag,
  "procurement.creditNote.type": Tag,
  "systemAdmin.workflow.workflowType": Tag,
  "report.allTypes": Tag,
  "inventoryManagement.transaction.referenceType": Tag,
  "systemAdmin.activityLog.entityType": Shapes,
  "field.category": FolderTree,
  "field.parent": FolderTree,
  "field.subCategory": Folder,
  "field.itemGroup": Boxes,
  // สถานที่ / ขอบเขต
  // location ในแอปนี้คือ "คลัง/สถานที่เก็บของ" ไม่ใช่พิกัดบนแผนที่ — ใช้ Building
  // ตรงกับไอคอนของ /config/location ใน sidebar ส่วนหมุดปักแผนที่สงวนไว้ให้
  // delivery point ซึ่งเป็นจุดส่งของจริง ๆ (และเป็นไอคอนของมันใน sidebar เช่นกัน)
  "field.location": Building,
  "field.fromLocation": Building,
  "field.toLocation": Building,
  "field.deliveryPoint": MapPin,
  "field.region": Globe,
  // สินค้า — ตรงกับ /product-management/product ใน sidebar
  "field.product": Box,
  // คน
  "field.receivedBy": UserRound,
  "field.createdBy": UserRound,
  "field.buyer": UserRound,
  "systemAdmin.userActivity.user": UserRound,
  "systemAdmin.activityLog.user": UserRound,
  "common.requester": UserRound,
  "field.department": Building2,
  "systemAdmin.user.department": Building2,
  "field.adjustmentType": Tag,
  // เอกสาร/ระบบ
  "common.sendBack": Undo2,
  "field.template": LayoutTemplate,
  "field.currency": Coins,
  "field.businessType": Briefcase,
  "field.cuisine": ChefHat,
  "field.difficulty": Gauge,
  "systemAdmin.userActivity.action": Activity,
  "systemAdmin.activityLog.action": Activity,
  // custom date-range ของ transaction (ห่อเองเลยไม่ได้ default Calendar ของ control)
  "inventoryManagement.transaction.dateRange": Calendar,
  "inventoryManagement.transaction.selectDateRange": Calendar,
};

function fieldIcon(f: FilterFieldDef): LucideIcon {
  if (f.icon) return f.icon;
  const byLabel = FIELD_ICONS[f.labelKey];
  if (byLabel) return byLabel;
  if (f.labelKey.endsWith(".status")) return CircleDashed;
  return CONTROL_ICONS[f.control];
}

export const SUBMENU_CLASS: Record<FilterFieldDef["control"], string> = {
  status: "w-48 p-1",
  "multi-select": "w-56 p-0",
  "date-range": "w-auto p-0",
  "amount-range": "w-72 p-2",
  entity: "w-56 p-0",
  stage: "w-56 p-0",
  workflow: "w-56 p-0",
  custom: "w-56 p-0",
};

interface ListFilterMenuProps {
  readonly fields: readonly FilterFieldDef[];
  readonly values: Record<string, string>;
  readonly setValue: (key: string, value: string) => void;
  readonly onClearAll?: () => void;
  readonly onSaveClick?: () => void;
  readonly activeCount: number;
}

const EDGE_PADDING = 8;

/**
 * กล่องตัวเลือกชั้นสอง — กางขวาตามทิศ chevron แต่ **พลิกไปซ้ายเองเมื่อขอบขวา
 * ไม่พอ** และเลื่อนขึ้นเมื่อก้นกล่องล้นจอ
 *
 * ตัวนี้เป็น div absolute ธรรมดา ไม่ใช่ Radix Popover จึงไม่มี collision detection
 * มาให้ฟรี — และแปลงเป็น Popover ไม่ได้ง่าย ๆ เพราะ Portal จะพา submenu ออกไป
 * นอก wrapper จน hover-delay กับ `wrapper.contains(document.activeElement)`
 * ข้างล่างพัง จึงวัดเอาเองตอน mount แทน
 *
 * วัดจากทรงจริงหลัง render (`useLayoutEffect` = ก่อน paint ไม่มีกระพริบ) ไม่ใช่
 * เทียบกับความกว้างที่ hardcode ไว้ เพราะ `SUBMENU_CLASS` มีทั้ง w-48/w-56/w-72
 * และ `w-auto` ของปฏิทินที่กว้างไม่ตายตัว
 */
function Submenu({
  control,
  children,
}: {
  readonly control: FilterFieldDef["control"];
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [flipX, setFlipX] = useState(false);
  const [shiftY, setShiftY] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setFlipX(rect.right > document.documentElement.clientWidth - EDGE_PADDING);
    // ล้นล่างแล้วดันขึ้นเท่าที่ล้น ไม่พลิกทิศ — พลิกไปกาง "ขึ้น" จะทำให้กล่อง
    // สูง ๆ อย่างปฏิทินไปล้นบนแทน ได้ปัญหาเดิมคนละด้าน
    const overflowY = rect.bottom - (window.innerHeight - EDGE_PADDING);
    setShiftY(overflowY > 0 ? -overflowY : 0);
  }, []);

  return (
    <div
      ref={ref}
      style={shiftY ? { transform: `translateY(${shiftY}px)` } : undefined}
      className={cn(
        "bg-popover text-popover-foreground absolute top-0 z-50 rounded-md border shadow-md",
        flipX ? "right-full mr-1" : "left-full ml-1",
        SUBMENU_CLASS[control],
      )}
    >
      {children}
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  summary,
  chevron,
  active,
  disabled,
  onClick,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly summary?: string;
  readonly chevron?: boolean;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm disabled:pointer-events-none disabled:opacity-50",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon aria-hidden="true" className="text-muted-foreground size-4" />
      <span className="flex-1 truncate text-start">{label}</span>
      {summary && (
        <span className="text-muted-foreground max-w-28 truncate text-xs">
          {summary}
        </span>
      )}
      {chevron && (
        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground size-3.5"
        />
      )}
    </button>
  );
}

/**
 * เมนู filter แบบ Linear สำหรับ desktop — popover ใต้ปุ่ม Filter รายชื่อ field
 * (icon + ชื่อ + ค่าย่อ + chevron จัดกลุ่มตาม section ด้วยเส้นคั่น) **hover**
 * แถวแล้ว submenu เด้งข้างขวาโชว์ตัวเลือกให้จิ้มได้ทันที (คลิกแถวก็เปิดได้
 * สำหรับ keyboard/จอสัมผัส) — ตัวเลือกใน submenu มาจาก FilterFieldControl ตัวเดิม
 * ที่สลับร่าง inline ผ่าน FilterInlineContext: control ที่ปกติเป็นปุ่ม trigger +
 * popover จะ render ไส้รายการ/ปฏิทินตรง ๆ เลือกแล้ว**มีผลทันที**เหมือนเดิม
 *
 * submenu เปิดฝั่งขวา — ทิศเดียวกับ chevron ที่ปลายแถว สายตาจึงไหลไปทางเดียวกับ
 * ที่ลูกศรชี้ (เคยเปิดฝั่งซ้ายเพราะปุ่ม Filter ชิดขวาของ toolbar แต่มันสวนทางกับ
 * chevron และสวนทางกับเมนูซ้อนของที่อื่นในแอปที่กางไปทางขวาหมด) — ที่ไม่พอเมื่อไหร่
 * `Submenu` พลิกไปซ้ายให้เอง
 *
 * มือถือไม่ใช้ตัวนี้ — ListFilter สลับไป bottom sheet เดิมให้เอง
 * props ชุดเดียวกับ ListFilter ทั้งชุด (ตัว sheet ส่งต่อมาตรง ๆ)
 */
export function ListFilterMenu({
  fields,
  values,
  setValue,
  onClearAll,
  onSaveClick,
  activeCount,
}: ListFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations();
  const tc = useTranslations("common");
  const tv = useTranslations("listView");

  // แถวเมนูต้องมีชื่อ — field ที่ labelKey ว่างคือ custom เฉพาะมือถือ (เช่น
  // view_mode_toggle ของ PR/SR/PO ที่ sm:hidden อยู่แล้ว) ข้ามไปเลยบน desktop
  const menuFields = fields.filter((f) => !f.hidden && f.labelKey);

  if (menuFields.length === 0) {
    return null;
  }

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openSubmenu = (key: string) => {
    cancelClose();
    setActiveKey(key);
  };
  // หน่วงปิดกันหลุดตอนลากเมาส์ข้ามช่องว่างระหว่างแถวกับ submenu — และถ้ากำลัง
  // พิมพ์อยู่ในช่องค้นของ submenu (focus ค้างใน wrapper) อย่าปิดใต้มือ
  const scheduleClose = (wrapper: HTMLElement) => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (wrapper.contains(document.activeElement)) return;
      setActiveKey(null);
    }, 150);
  };

  const peer: FilterPeerAccess = {
    get: (key) => values[key] ?? "",
    set: setValue,
  };

  const hasValues = fields.some((f) => values[f.key]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // เปิดรอบหน้าไม่ให้ submenu เก่าค้าง
        if (!o) {
          cancelClose();
          setActiveKey(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="relative">
          <ListFilterPlus aria-hidden="true" />
          {tc("filter")}
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              size="xs"
              className="text-micro-legal absolute -top-1 -right-1 h-4 min-w-4 px-1 tabular-nums"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        {menuFields.map((f, i) => {
          // เส้นคั่นเมื่อขึ้นกลุ่ม section ใหม่ — สไตล์ Linear ไม่มีหัวข้อ
          const showSeparator =
            i > 0 && f.section !== menuFields[i - 1].section;
          return (
            <Fragment key={f.key}>
              {showSeparator && <Separator className="my-1" />}
              <div
                className="relative"
                onMouseEnter={() => openSubmenu(f.key)}
                onMouseLeave={(e) => scheduleClose(e.currentTarget)}
              >
                <MenuRow
                  icon={fieldIcon(f)}
                  label={t(f.labelKey)}
                  summary={
                    values[f.key]
                      ? chipValueText(f, values[f.key], t)
                      : undefined
                  }
                  chevron
                  active={activeKey === f.key}
                  onClick={() => openSubmenu(f.key)}
                />
                {activeKey === f.key && (
                  <Submenu control={f.control}>
                    <FilterInlineContext.Provider value={true}>
                      <FilterFieldControl
                        field={f}
                        value={values[f.key] ?? ""}
                        onChange={(v) => setValue(f.key, v)}
                        peer={peer}
                      />
                    </FilterInlineContext.Provider>
                  </Submenu>
                )}
              </div>
            </Fragment>
          );
        })}
        <Separator className="my-1" />
        <MenuRow
          icon={Eraser}
          label={tc("clearAll")}
          disabled={!hasValues}
          onClick={() => {
            // ล้างเป็นชุดเดียว (onClearAll จัดการ linked/hidden key ให้ครบ) —
            // fallback ไล่ล้างรายตัวเมื่อหน้าไม่ได้ส่ง prop มา
            if (onClearAll) onClearAll();
            else for (const f of fields) setValue(f.key, "");
          }}
        />
        {onSaveClick && (
          <MenuRow
            icon={Bookmark}
            label={tv("saveCurrent")}
            onClick={() => {
              setOpen(false);
              onSaveClick();
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
