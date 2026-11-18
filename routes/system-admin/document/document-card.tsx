import { File } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DocumentFile } from "@/types/document";
import { ListCardRowNo } from "@/components/share/list-card";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface DocumentCardProps {
  readonly item: DocumentFile;
  /** เลขลำดับแถว (`rowNumber()`) */
  readonly rowNo?: number;
  readonly onClick?: (item: DocumentFile) => void;
}

export default function DocumentCard({
  item,
  rowNo,
  onClick,
}: DocumentCardProps) {
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={() => onClick?.(item)}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick(item);
        }
      }}
      className="hover:border-primary/30 focus-visible:ring-ring gap-0 py-0 transition-colors focus-visible:ring-2"
    >
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center gap-2 truncate text-sm">
          <ListCardRowNo rowNo={rowNo} />
          <File
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <span className="truncate">{item.originalName}</span>
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="flex items-center justify-between px-4 py-3 text-xs">
        <span className="text-muted-foreground">{formatSize(item.size)}</span>
        <span className="text-muted-foreground">
          {new Date(item.lastModified).toLocaleDateString()}
        </span>
      </CardContent>
    </Card>
  );
}
