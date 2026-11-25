import { Plus, RefreshCw, Sparkles, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CHANGELOG, type ChangeItem, type VersionEntry } from "@/lib/changelog";

interface WhatsNewDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

// chip ใช้คู่ tint ตามกติกา token: bg-x/10 + text-x-foreground (destructive
// เป็นข้อยกเว้น ใช้ text-destructive บน canvas ได้เลย) ส่วนจุด bullet ใช้ตัว
// token สด ๆ — อย่าเอา class ของ chip ไป replace เป็นสีจุด
const SECTIONS = [
  {
    key: "added",
    label: "Added",
    Icon: Plus,
    chipClass: "bg-success/10 text-success-foreground",
    dotClass: "bg-success",
  },
  {
    key: "fixed",
    label: "Fixed",
    Icon: Wrench,
    chipClass: "bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  {
    key: "changed",
    label: "Changed",
    Icon: RefreshCw,
    chipClass: "bg-info/10 text-info-foreground",
    dotClass: "bg-info",
  },
] as const;

function ChangeList({
  items,
  dotClass,
}: {
  readonly items: readonly ChangeItem[];
  dotClass: string;
}) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((item) => (
        <li
          key={item.hash}
          className="flex items-start gap-3 text-sm leading-relaxed"
        >
          <div
            className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
          />
          <div>
            {item.scope && (
              <span className="bg-muted text-micro-legal text-muted-foreground mr-2 mb-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 font-bold tracking-wider uppercase">
                {item.scope}
              </span>
            )}
            <span className="text-foreground/90 font-medium">
              {item.summary}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function VersionBlock({ entry }: { readonly entry: VersionEntry }) {
  const sections = SECTIONS.filter(({ key }) => entry.changes[key].length > 0);
  return (
    <section className="border-muted/60 relative border-l-2 pb-10 pl-6 last:pb-2">
      {/* Timeline dot */}
      <div className="bg-primary ring-background absolute top-1.5 -left-[5px] h-2 w-2 rounded-full ring-4" />

      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-foreground text-xl font-bold tracking-tight">
          v{entry.version}
        </h3>
        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
          {entry.date}
        </span>
      </div>
      {sections.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">
          {entry.note === "init" ? "Initial release." : "No notable changes."}
        </p>
      ) : (
        <div className="space-y-7">
          {sections.map(({ key, label, Icon, chipClass, dotClass }) => (
            <div key={key}>
              <div
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold ${chipClass}`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                <span className="tracking-wider uppercase">{label}</span>
              </div>
              <ChangeList items={entry.changes[key]} dotClass={dotClass} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function WhatsNewDialog({ open, onOpenChange }: WhatsNewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden border-0 bg-transparent p-0 shadow-2xl sm:max-w-4xl"
        showCloseButton={false}
      >
        <div className="border-border/60 bg-popover/80 relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-3xl">
          {/* Header */}
          <div className="border-border/40 bg-background/40 border-b px-6 py-6">
            <div className="flex items-center gap-4">
              <div className="text-primary bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="flex flex-col text-left">
                <DialogTitle className="text-foreground text-sm font-semibold tracking-tight">
                  What&apos;s New
                </DialogTitle>
                <div className="text-muted-foreground mt-1 text-sm font-semibold">
                  Recent updates to CARMEN BLUE.
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
              {CHANGELOG.versions.map((entry) => (
                <VersionBlock key={entry.build} entry={entry} />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-border/40 bg-background/40 flex justify-end border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
