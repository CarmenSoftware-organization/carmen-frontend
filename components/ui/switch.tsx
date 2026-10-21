import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors outline-none",
        "focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:ring-[0.5px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        // ตอนปิดรางกลืนกับพื้น (light: input ≈ พื้นขาว, dark: input ≈ พื้นการ์ด) — ใส่ขอบ
        // ให้เห็นขอบเขตของ control ทั้งสองธีม พื้น dark ใช้ชุดเดียวกับ Checkbox
        "data-[state=unchecked]:border-muted-foreground/60 dark:data-[state=unchecked]:bg-input/30",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-primary-foreground pointer-events-none block size-3 rounded-full shadow-xs ring-0 transition-transform",
          // dark: primary-foreground เป็นสีเข้ม ตอนปิด thumb จมหายในราง — ใช้สีกลางให้เห็นตำแหน่ง
          "dark:data-[state=unchecked]:bg-muted-foreground",
          "data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
