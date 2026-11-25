import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ViewScope } from "@/types/list-view";

interface SaveViewDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly canManageBu: boolean;
  readonly existingNames: (scope: ViewScope) => string[];
  readonly onSave: (name: string, scope: ViewScope) => Promise<void>;
}

/**
 * Dialog บันทึกตัวกรองปัจจุบันเป็น view ใหม่ — กรอกชื่อ + เลือก scope
 * (เฉพาะฉัน หรือทั้งหน่วยธุรกิจถ้ามีสิทธิ์ `canManageBu`)
 *
 * ถ้าชื่อซ้ำกับ view ที่มีอยู่แล้วใน scope เดียวกัน ปุ่มบันทึกจะเปลี่ยนเป็น
 * ปุ่มยืนยันแทนที่ — ต้องกดซ้ำอีกครั้งเพื่อเรียก `onSave` (parent จัดการ
 * replace semantics เอง) ทุกครั้งที่เปิด dialog ใหม่ state จะถูกล้างสะอาด
 */
export function SaveViewDialog({
  open,
  onOpenChange,
  canManageBu,
  existingNames,
  onSave,
}: SaveViewDialogProps) {
  const tv = useTranslations("listView");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ViewScope>("user");
  const [error, setError] = useState<string | null>(null);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setScope("user");
    setError(null);
    setConfirmingReplace(false);
    setIsPending(false);
  }, [open]);

  const handleOpenChange = (value: boolean) => {
    if (!value && isPending) return;
    onOpenChange(value);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setError(null);
    setConfirmingReplace(false);
  };

  const handleScopeChange = (value: string) => {
    setScope(value as ViewScope);
    setConfirmingReplace(false);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(tv("nameRequired"));
      return;
    }

    const isDuplicate = existingNames(scope).includes(trimmed);
    if (isDuplicate && !confirmingReplace) {
      setConfirmingReplace(true);
      return;
    }

    setIsPending(true);
    try {
      await onSave(trimmed, scope);
      onOpenChange(false);
    } catch {
      // error toast เป็นหน้าที่ของ mutation layer — dialog แค่เปิดค้างไว้
    } finally {
      setIsPending(false);
    }
  };

  const duplicateName = name.trim();
  const showDuplicateNotice = confirmingReplace && duplicateName.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tv("saveAsTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="save-view-name">{tv("name")}</Label>
            <Input
              id="save-view-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={120}
              disabled={isPending}
              aria-invalid={!!error}
            />
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>{tv("scope")}</Label>
            <RadioGroup
              value={scope}
              onValueChange={handleScopeChange}
              disabled={isPending}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="user" id="save-view-scope-user" />
                <Label
                  htmlFor="save-view-scope-user"
                  className="cursor-pointer text-xs font-normal"
                >
                  {tv("scopeUser")}
                </Label>
              </div>
              {canManageBu && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="bu" id="save-view-scope-bu" />
                  <Label
                    htmlFor="save-view-scope-bu"
                    className="cursor-pointer text-xs font-normal"
                  >
                    {tv("scopeBu")}
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {showDuplicateNotice && (
            <p className="text-warning-ink text-xs">
              {tv("nameDuplicate", { name: duplicateName })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {tc("cancel")}
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={isPending}>
            {confirmingReplace ? tv("replace") : tv("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
