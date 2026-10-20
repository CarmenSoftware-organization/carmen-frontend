import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group border-input bg-field dark:bg-background relative flex w-full items-center rounded-md border transition-[color,box-shadow] outline-none",
        "h-9 min-w-0 has-[>textarea]:h-auto",

        // Variants based on alignment.
        "has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",

        // Focus state.
        "has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-2",

        // Error state.
        "has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",

        className,
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-semibold select-none [&>svg:not([class*='size-'])]:size-4 [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
        "inline-end":
          "order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
        "block-start":
          "order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3 group-has-[>input]/input-group:pt-2",
        "block-end":
          "order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3 group-has-[>input]/input-group:pb-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  },
);

/**
 * Slot ของ addon ภายใน InputGroup สำหรับวาง icon/ปุ่ม/ข้อความ
 *
 * รองรับ 4 ตำแหน่งผ่าน align: "inline-start" (default), "inline-end",
 * "block-start" (บน), "block-end" (ล่าง) การคลิก addon จะ focus input
 * ภายในกลุ่มโดยอัตโนมัติ (ยกเว้นคลิกที่ปุ่มภายใน addon)
 *
 * @param props - align + props ของ div
 * @returns JSX element ของ addon
 * @example
 * ```tsx
 * <InputGroupAddon align="inline-end">
 *   <InputGroupButton><Eye /></InputGroupButton>
 * </InputGroupAddon>
 * ```
 */
function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    /* role="group" intentional: ไม่มี jsx-a11y plugin ใน Vite eslint config */
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "text-sm shadow-none flex gap-2 items-center",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-3.5 has-[>svg]:px-2",
        sm: "h-8 px-2 gap-1.5 rounded-md has-[>svg]:px-2",
        "icon-xs":
          "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  },
);

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

/**
 * Span สำหรับแสดงข้อความหรือไอคอนภายใน InputGroupAddon
 *
 * สไตล์เป็น text-muted-foreground ขนาด text-sm พร้อม auto-size SVG
 * ให้เท่ากัน (size-4) ใช้แสดง prefix/suffix เช่น "฿", "kg"
 *
 * @param props - props ของ span
 * @returns JSX element span
 * @example
 * ```tsx
 * <InputGroupAddon><InputGroupText>THB</InputGroupText></InputGroupAddon>
 * ```
 */
function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Input control หลักภายใน InputGroup
 *
 * ครอบ Input ของ shadcn แล้วถอด border/shadow/focus ring ออก เพื่อให้
 * visual border ถูกจัดการโดย InputGroup container แทน มี data-slot=
 * "input-group-control" สำหรับ :has() selector ของ parent
 *
 * @param props - props ของ input element
 * @returns JSX element input
 * @example
 * ```tsx
 * <InputGroupInput placeholder="ค้นหา..." value={q} onChange={...} />
 * ```
 */
function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Textarea control สำหรับใช้แทน InputGroupInput เมื่อเป็นข้อความหลายบรรทัด
 *
 * ครอบ Textarea ของ shadcn แล้วถอด border/shadow ออก เปลี่ยน resize เป็น
 * none ทำให้ InputGroup container auto-grow ตาม textarea
 *
 * @param props - props ของ textarea element
 * @returns JSX element textarea
 * @example
 * ```tsx
 * <InputGroup>
 *   <InputGroupTextarea rows={3} placeholder="หมายเหตุ" />
 * </InputGroup>
 * ```
 */
function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
