import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LineDimensionFields } from "@/components/dimension/line-dimension-fields";
import type { DimensionRef } from "@/types/gl-dimension";

interface LineDimensionPopoverProps {
  readonly value: readonly DimensionRef[];
  readonly onChange: (next: DimensionRef[]) => void;
  readonly disabled?: boolean;
}

/**
 * ปุ่มเปิด popover เลือก dimension ต่อบรรทัดเอกสาร (แสดง `Dim N` หรือ `Dim —` เมื่อยังไม่เลือก)
 * ปุ่มกดได้เสมอแม้ `disabled` เพื่อให้ดูค่าได้ — `disabled` ส่งต่อให้ช่องเลือกข้างในเป็น read-only
 * ไม่เช็ค license เอง ผู้เรียกต้องเช็คก่อนวางคอมโพเนนต์
 */
export function LineDimensionPopover({
  value,
  onChange,
  disabled = false,
}: LineDimensionPopoverProps) {
  const label = value.length === 0 ? "Dim —" : `Dim ${value.length}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <LineDimensionFields
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}
