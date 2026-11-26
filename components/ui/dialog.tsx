import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function DialogCloseX() {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={"ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 cursor-pointer rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"}
    >
      <XIcon />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  );
}

// dialog ที่ใช้เลย์เอาต์ปกติ: DialogHeader ปักอยู่บน จึงรับปุ่ม X ไปถือไว้เอง
// (ปุ่ม absolute ใน DialogContent จะเลื่อนหายไปกับเนื้อหาแล้วโดน header ทับ)
type HeaderCloseSlot = {
  enabled: boolean;
  register: () => () => void;
};
const HeaderCloseContext = React.createContext<HeaderCloseSlot | null>(null);

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  // dialog ที่กำหนด padding เอง (p-0 + header/body/footer ของตัวเอง) จัดเลย์เอาต์เองอยู่แล้ว
  // — ปักปุ่ม footer ให้เฉพาะ dialog ที่ใช้ padding ปกติ
  const ownsLayout = /(^|\s)(?:[a-z0-9-]+:)*p[xytblr]?-/.test(className ?? "");
  const [headerCount, setHeaderCount] = React.useState(0);
  const closeSlot = React.useMemo<HeaderCloseSlot>(
    () => ({
      enabled: showCloseButton && !ownsLayout,
      register: () => {
        setHeaderCount((n) => n + 1);
        return () => setHeaderCount((n) => n - 1);
      },
    }),
    [showCloseButton, ownsLayout],
  );
  const closeInHeader = closeSlot.enabled && headerCount > 0;
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      {/* grid-cols-[minmax(0,1fr)]: คอลัมน์ auto ของ grid ขยายตาม min-content ของลูก
          ชื่อไฟล์ยาวไม่มีช่องว่าง / <pre> โค้ด จึงดันเนื้อหาและปุ่มทะลุกรอบ dialog */}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-layout={ownsLayout ? "custom" : "default"}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full grid-cols-[minmax(0,1fr)] max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          // ยาวเกินจอ → เนื้อหาเลื่อนในกรอบ ส่วน DialogHeader / DialogFooter ปักบน/ล่าง (sticky)
          "group/dialog max-h-[calc(100dvh-2rem)] overflow-y-auto",
          className,
        )}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented || ownsLayout) return;
          // ปุ่ม X อยู่ใน header ซึ่งมาก่อนช่องกรอกใน DOM — focus แรกต้องข้ามไปช่องแรกเหมือนเดิม
          const content = event.currentTarget as HTMLElement | null;
          const first = content?.querySelector<HTMLElement>(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([data-slot="dialog-close"]), [href], [tabindex]:not([tabindex="-1"])',
          );
          if (first) {
            event.preventDefault();
            first.focus();
          }
        }}
        {...props}
      >
        <HeaderCloseContext.Provider value={closeSlot}>
          {children}
        </HeaderCloseContext.Provider>
        {showCloseButton && !closeInHeader && <DialogCloseX />}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const closeSlot = React.useContext(HeaderCloseContext);
  const holdsClose = !!closeSlot?.enabled;
  const register = closeSlot?.register;
  React.useLayoutEffect(() => {
    if (holdsClose && register) return register();
  }, [holdsClose, register]);
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-2 text-center sm:text-left",
        // -top-6 / -mt-6 / -mx-6: sticky วัดขอบจาก padding ของกรอบ ต้องชดเชย p-6 เหมือน footer
        "group-data-[layout=default]/dialog:bg-background group-data-[layout=default]/dialog:sticky group-data-[layout=default]/dialog:-top-6 group-data-[layout=default]/dialog:z-10 group-data-[layout=default]/dialog:-mx-6 group-data-[layout=default]/dialog:-mt-6 group-data-[layout=default]/dialog:-mb-4 group-data-[layout=default]/dialog:rounded-t-lg group-data-[layout=default]/dialog:px-6 group-data-[layout=default]/dialog:pt-6 group-data-[layout=default]/dialog:pb-4",
        className,
      )}
      {...props}
    >
      {children}
      {holdsClose && <DialogCloseX />}
    </div>
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        "group-data-[layout=default]/dialog:bg-background group-data-[layout=default]/dialog:sticky group-data-[layout=default]/dialog:-bottom-6 group-data-[layout=default]/dialog:z-10 group-data-[layout=default]/dialog:-mx-6 group-data-[layout=default]/dialog:-mb-6 group-data-[layout=default]/dialog:rounded-b-lg group-data-[layout=default]/dialog:border-t group-data-[layout=default]/dialog:px-6 group-data-[layout=default]/dialog:py-3",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-sm leading-snug font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
