import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronsUpDown,
  CircleAlert,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Command, CommandInput } from "@/components/ui/command";
import { FieldPlainText } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VirtualCommandList } from "@/components/ui/virtual-command-list";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyComponent from "@/components/empty-component";
import { useLookupResize } from "./use-lookup-resize";

/**
 * หน่วงก่อนส่งคำค้นให้ server — สั้นกว่านี้ยิงทุกตัวอักษร ยาวกว่านี้ (เคยคุยกันที่ 2 วิ)
 * ผู้ใช้หยุดพิมพ์แล้วนึกว่าค้าง ระหว่างรอมี spinner ในช่องค้นหา
 */
export const LOOKUP_SEARCH_DEBOUNCE_MS = 400;

const SKELETON_WIDTHS = ["w-3/4", "w-2/3", "w-1/2", "w-4/5", "w-3/5", "w-5/6"];

const LookupSkeletonList = () => {
  return (
    <div className="space-y-1 p-1" aria-hidden="true">
      {SKELETON_WIDTHS.map((w) => (
        <div
          key={w}
          className="flex items-center justify-between gap-2 px-2 py-1.5"
        >
          <Skeleton className={cn("h-3.5", w)} />
          <Skeleton className="h-4 w-12 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
};

interface LookupComboboxProps<T> {
  readonly value: string;
  readonly onValueChange: (value: string, item?: T) => void;
  readonly items: T[];
  /**
   * รายการที่เลือกอยู่ซึ่งอาจไม่อยู่ใน `items` (อยู่หลังหน้าแรก / ถูกปิดใช้งาน)
   * — ใช้หา label บนปุ่มเท่านั้น ไม่แสดงในรายการ
   */
  readonly selectedItems?: T[];
  readonly getId: (item: T) => string;
  readonly getLabel: (item: T) => string;
  readonly placeholder?: string;
  readonly searchPlaceholder?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
  readonly getSearchValue?: (item: T) => string;
  readonly renderItem?: (item: T) => ReactNode;
  readonly defaultLabel?: string;
  readonly renderSelected?: (item: T) => string;
  readonly emptyIcon?: LucideIcon;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly headerSlot?: ReactNode;
  readonly prependItems?: ReactNode;
  readonly popoverWidth?: string;
  readonly popoverAlign?: "start" | "center" | "end";
  readonly popoverClassName?: string;
  readonly modal?: boolean;
  readonly size?: "xs" | "sm" | "default";
  readonly onSearchChange?: (search: string) => void;
  readonly serverSideSearch?: boolean;
  readonly onLoadMore?: () => void;
  readonly hasMore?: boolean;
  readonly isLoadingMore?: boolean;
  readonly disableTooltip?: boolean;
  readonly error?: string;
  readonly onOpenChange?: (open: boolean) => void;
  readonly defaultOpen?: boolean;
  /**
   * ปิดแล้วให้ focus ไปที่ element นี้แทนที่จะเด้งกลับปุ่มเดิม
   *
   * default ของ Radix คือคืน focus ให้ trigger ซึ่งถูกในกรณีทั่วไป แต่ในฟอร์มที่
   * กรอกไล่ทีละช่อง (เลือกสินค้า → เลือกคลัง → ใส่จำนวน) มันกลายเป็นทางตัน
   * ผู้ใช้พิมพ์ต่อทันทีแล้วตัวอักษรหายเงียบเพราะ focus ค้างอยู่ที่ปุ่ม
   */
  readonly nextFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * คุมสถานะเปิด/ปิดจากข้างนอก — ใช้เมื่อต้องสั่งเปิดทีหลัง ตอน component mount
   * ไปแล้ว (`defaultOpen` ยิงแค่ตอน mount) เช่นพากรอกทีละช่องหลังเลือกสินค้าเสร็จ
   * ส่งมาแล้วต้องคุมปิดเองด้วยผ่าน `onOpenChange`
   */
  readonly open?: boolean;
  readonly readOnly?: boolean;
  /**
   * คลิกแถวที่เลือกอยู่แล้วให้ล้างค่า (default `true`) — lookup ที่แปลงมาจาก
   * `<Select>` ต้องส่ง `false` เพราะ Select ไม่เคยล้างค่าเมื่อคลิกซ้ำ ถ้าปล่อยไว้
   * ฟิลด์การเงิน (ภาษี/เครดิต/สกุลเงิน) จะโดนล้างเงียบ ๆ; เมื่อเป็น `false`
   * คลิกซ้ำแค่ปิด popover โดยไม่เรียก `onValueChange`
   */
  readonly allowDeselect?: boolean;
  readonly estimateSize?: number;
  readonly maxHeight?: number;
  /**
   * คีย์สำหรับจำขนาด popup ที่ผู้ใช้ลากไว้ (localStorage) — ตั้งตามชนิด lookup
   * เช่น `"product"` ไม่ใช่ตามหน้า ไม่ส่ง = ยังลากปรับได้แต่ปิดแล้วกลับขนาดเดิม
   */
  readonly resizeKey?: string;
}

export function LookupCombobox<T>({
  value,
  onValueChange,
  items,
  selectedItems,
  getId,
  getLabel,
  placeholder,
  searchPlaceholder,
  className,
  disabled,
  isLoading,
  getSearchValue,
  renderItem,
  defaultLabel,
  renderSelected,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  headerSlot,
  prependItems,
  popoverWidth = "w-(--radix-popover-trigger-width)",
  popoverAlign,
  popoverClassName,
  modal,
  size = "sm",
  onSearchChange,
  serverSideSearch,
  onLoadMore,
  hasMore,
  isLoadingMore,
  disableTooltip,
  error,
  onOpenChange,
  defaultOpen,
  open: controlledOpen,
  nextFocusRef,
  readOnly,
  allowDeselect = true,
  estimateSize,
  maxHeight,
  resizeKey,
}: LookupComboboxProps<T>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    defaultOpen ?? false,
  );
  const open = controlledOpen ?? uncontrolledOpen;
  const {
    size: resizedSize,
    contentRef,
    triggerRef,
    autoAlign,
    onOpened,
    onPointerDown: onResizeStart,
    reset: resetSize,
    onClose: onResizeClose,
  } = useLookupResize(resizeKey, maxHeight ?? 300);
  const [search, setSearch] = useState("");

  const t = useTranslations("lookup");
  const resolvedPlaceholder = placeholder ?? t("selectPlaceholder");
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("searchPlaceholder");

  const searchFn = getSearchValue ?? getLabel;
  const debouncedSearch = useDebouncedValue(search, LOOKUP_SEARCH_DEBOUNCE_MS);
  // พิมพ์แล้วยังไม่ครบเวลาหน่วง — โชว์ spinner ให้รู้ว่ากำลังจะค้น
  const isSearchPending = search !== debouncedSearch;

  useEffect(() => {
    onSearchChange?.(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  const q = debouncedSearch.toLowerCase();
  const filteredItems =
    serverSideSearch || !debouncedSearch
      ? items
      : items.filter((item) => searchFn(item).toLowerCase().includes(q));

  // item ที่ผู้ใช้เพิ่งกดเลือก — เก็บไว้เผื่อมันหลุดออกจาก `items`
  //
  // เลือกเสร็จเราล้างคำค้นทิ้ง (setSearch("")) พอเป็น serverSideSearch ตัว
  // caller จะยิงโหลดหน้าแรกใหม่แบบไม่มีคำค้น ตัวที่เพิ่งเลือกมักไม่อยู่ใน 30
  // รายการแรก → หา `selectedItem` ไม่เจอ → ป้ายบนปุ่มกลับไปเป็น placeholder
  // ทั้งที่ค่าถูกเก็บแล้ว (บั๊กเดิม: ค้น "กรอ" แล้วเลือก ช่องขึ้น "Select Product")
  const [pickedItem, setPickedItem] = useState<T | null>(null);

  const selectedItem = value
    ? (items.find((item) => getId(item) === value) ??
      selectedItems?.find((item) => getId(item) === value) ??
      (pickedItem && getId(pickedItem) === value ? pickedItem : undefined))
    : undefined;
  let selectedLabel: string | null = null;
  if (value) {
    if (selectedItem) {
      selectedLabel = renderSelected
        ? renderSelected(selectedItem)
        : getLabel(selectedItem);
    } else {
      selectedLabel = defaultLabel ?? null;
    }
  }

  const showTooltip = !error && !disableTooltip && !open && !!selectedLabel;
  const showErrorTooltip = !!error && !open;

  if (readOnly) {
    // FieldPlainText (ไม่ใช่ <span> เปล่า) เพราะ `Field` จะมุด label ให้ก็ต่อเมื่อ
    // เจอ data-slot="field-plain-text" เป็น direct child — และมันแสดง "—" เองอยู่แล้ว
    return (
      <FieldPlainText
        className={cn(
          size === "default" && "min-h-9",
          size === "xs" && "min-h-6",
          className,
        )}
      >
        {selectedLabel}
      </FieldPlainText>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setUncontrolledOpen(o);
        if (!o) {
          setSearch("");
          onResizeClose();
        }
        onOpenChange?.(o);
      }}
      modal={modal}
    >
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                ref={triggerRef}
                variant="outline"
                aria-expanded={open}
                aria-invalid={!!error}
                className={cn(
                  "bg-field flex items-center justify-between pr-1 pl-3 text-xs",
                  size === "default" && "h-9",
                  size === "sm" && "h-8",
                  size === "xs" && "h-6 gap-1 px-2 text-xs",
                  // important: ชนะ `dark:border-input` ของ Button outline
                  // (specificity 0,2,0 จาก dark variant `:is(.dark *)`)
                  error && "border-destructive! pr-7",
                  className,
                )}
                disabled={disabled}
              >
                {isLoading ? (
                  <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
                ) : (
                  <span
                    className={cn(
                      "truncate",
                      !selectedLabel && "text-muted-foreground text-xs",
                    )}
                  >
                    {selectedLabel ?? resolvedPlaceholder}
                  </span>
                )}
                {error ? (
                  <CircleAlert
                    className="text-destructive size-4 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronsUpDown
                    className={cn(
                      "shrink-0 opacity-50",
                      size === "xs" ? "size-3" : "h-4 w-4",
                    )}
                  />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          {showErrorTooltip && (
            <TooltipContent
              side="top"
              align="end"
              className="bg-background text-destructive [&>svg]:fill-background [&>svg]:text-border border px-3 py-2 text-xs font-semibold"
            >
              {error}
            </TooltipContent>
          )}
          {showTooltip && (
            <TooltipContent side="top" className="max-w-[20rem]">
              <p className="text-xs font-semibold">{selectedLabel}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        ref={contentRef}
        className={cn(
          popoverWidth,
          "group/lookup relative p-0",
          // ขนาดที่จำไว้อาจใหญ่กว่าจอปัจจุบัน — ให้รายการหดตามพื้นที่ที่เหลือ
          resizedSize &&
            "flex max-h-(--radix-popover-content-available-height) flex-col",
          popoverClassName,
        )}
        style={
          resizedSize
            ? {
                width: `clamp(var(--radix-popover-trigger-width), ${resizedSize.width}px, var(--radix-popover-content-available-width))`,
              }
            : undefined
        }
        align={popoverAlign ?? autoAlign}
        onOpenAutoFocus={onOpened}
        onCloseAutoFocus={(e) => {
          const next = nextFocusRef?.current;
          if (!next) return;
          // ต้องดักที่ event ของ Radix ไม่ใช่สั่ง focus เองหลังปิด — Radix คืน
          // focus ให้ trigger ทีหลัง แล้วทับของเราเสมอ (ลองมาแล้ว)
          e.preventDefault();
          next.focus();
        }}
      >
        <Command shouldFilter={false}>
          <div className="relative w-full">
            <CommandInput
              placeholder={resolvedSearchPlaceholder}
              className={cn(
                "placeholder:text-xs",
                headerSlot ? "pr-14" : isSearchPending && "pr-8",
              )}
              value={search}
              onValueChange={setSearch}
            />
            {isSearchPending && (
              <Loader2
                aria-hidden="true"
                className={cn(
                  "text-muted-foreground absolute top-1/2 size-3.5 -translate-y-1/2 animate-spin",
                  headerSlot ? "right-9" : "right-2",
                )}
              />
            )}
            {headerSlot}
          </div>
          {isLoading ? (
            <LookupSkeletonList />
          ) : (
            <>
              {prependItems}
              <VirtualCommandList
                items={filteredItems}
                onLoadMore={onLoadMore}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                estimateSize={estimateSize}
                maxHeight={resizedSize?.height ?? maxHeight}
                emptyMessage={
                  <EmptyComponent
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                }
              >
                {(item) => (
                  <button
                    type="button"
                    aria-pressed={value === getId(item)}
                    data-value={searchFn(item)}
                    className={cn(
                      // text-left: <button> จัดกลางเป็น default — renderItem ที่ห่อข้อความด้วย div จะลอยกลางแถว
                      "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-hidden select-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                    )}
                    onClick={() => {
                      const id = getId(item);
                      const isSame = value === id;
                      if (!(isSame && !allowDeselect)) {
                        const isUnselect = isSame;
                        setPickedItem(isUnselect ? null : item);
                        onValueChange(
                          isUnselect ? "" : id,
                          isUnselect ? undefined : item,
                        );
                      }
                      // ปิดทั้งสองทาง: uncontrolled ปิดเอง ส่วน controlled ให้
                      // caller เป็นคนปิดผ่าน onOpenChange
                      setUncontrolledOpen(false);
                      setSearch("");
                      onOpenChange?.(false);
                    }}
                  >
                    {/* แถวของ VirtualCommandList สูงตายตัว — label ที่ขึ้นบรรทัดใหม่จะทับแถวถัดไป
                        จึงตัดเป็นบรรทัดเดียว (เต็มดูได้จาก title) */}
                    {renderItem ? (
                      renderItem(item)
                    ) : (
                      <span className="min-w-0 truncate" title={getLabel(item)}>
                        {getLabel(item)}
                      </span>
                    )}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0",
                        value === getId(item) ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                )}
              </VirtualCommandList>
            </>
          )}
        </Command>
        {/* ที่จับปรับขนาด — ย้ายมุมตามทิศที่ Radix วาง popup (ดู useLookupResize) */}
        <div
          aria-hidden="true"
          title={t("resizeHint")}
          onPointerDown={onResizeStart}
          onDoubleClick={resetSize}
          className={cn(
            "text-muted-foreground/60 hover:text-muted-foreground absolute z-10 flex size-4 touch-none items-end justify-end p-0.5 select-none",
            "right-0 bottom-0 cursor-nwse-resize",
            "group-data-[align=end]/lookup:right-auto group-data-[align=end]/lookup:left-0 group-data-[align=end]/lookup:scale-x-[-1] group-data-[align=end]/lookup:cursor-nesw-resize",
            "group-data-[side=top]/lookup:top-0 group-data-[side=top]/lookup:bottom-auto group-data-[side=top]/lookup:scale-y-[-1] group-data-[side=top]/lookup:cursor-nesw-resize",
            "group-data-[side=top]/lookup:group-data-[align=end]/lookup:cursor-nwse-resize",
          )}
        >
          <svg viewBox="0 0 8 8" className="size-2" fill="none">
            <path
              d="M7 1 1 7M7 4 4 7"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </PopoverContent>
    </Popover>
  );
}
