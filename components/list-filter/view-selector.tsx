import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import {
  Bookmark,
  BookmarkX,
  Building2,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { UseListFiltersResult } from "@/hooks/use-list-filters";
import type { SavedView, ViewScope } from "@/types/list-view";

interface ViewSelectorProps {
  readonly view: UseListFiltersResult["view"];
  readonly snapshot: {
    readonly filters: Record<string, string>;
    readonly sort?: string;
  };
}

interface RenameTarget {
  readonly id: string;
  readonly scope: ViewScope;
  readonly name: string;
}

interface DeleteTarget {
  readonly id: string;
  readonly scope: ViewScope;
  readonly name: string;
}

/**
 * Dropdown เลือก/จัดการ saved view ของหน้า list หนึ่งหน้า
 *
 * Trigger เป็นปุ่ม outline โชว์ชื่อ view ปัจจุบัน (+ ต่อท้าย "(modified)" เมื่อ
 * dirty) หรือ "No view" เมื่อไม่มี view ที่กำลัง apply อยู่ เนื้อในแบ่งเป็น:
 * - section บนสุด (เฉพาะตอน dirty): "Update this view" (เฉพาะมีสิทธิ์ — scope
 *   user ทำได้เสมอ, scope bu ต้อง `canManageBu`) / "Save as new view" / "Revert"
 * - "No view" — ล้างแค่ `sv` (filter ที่แก้ไว้ยังอยู่ ไม่ผูก view ไหน)
 * - กลุ่ม "My views" / "Business unit views" — คลิกชื่อ = apply view นั้น,
 *   ปุ่ม ⋯ (submenu ซ้อนในเมนูเดียวกัน) = rename / update (เฉพาะแถวที่กำลัง
 *   apply อยู่และ dirty) / delete ต่อแถว — bu view ต้อง `canManageBu` ถึงจะเห็น
 *   ปุ่ม ⋯ (แต่ยัง apply ได้เสมอ)
 * - แถว spinner ระหว่างโหลด, แถว error + ปุ่ม retry (invalidate ทั้งสอง query
 *   key ของ app-config), แถว empty เมื่อทั้งสอง scope ไม่มี view เลย
 * - แถวท้ายสุดเสมอ: "Save current filters as view"
 *
 * Rename ใช้ dialog เล็กในตัวคอมโพเนนต์นี้เอง (ไม่แยกไฟล์) ส่วน delete ใช้
 * `DeleteDialog` กลาง และ save/replace ใช้ `SaveViewDialog` — ทั้งสองเก็บ
 * target เป็น local state แยกจาก dropdown เพราะ dropdown ปิดตัวเองทันทีที่กด
 * action ใน item แต่ dialog ต้องเปิดค้างต่อ
 *
 * @param props.view - `view` object จาก `useListFilters` (current/scope/isDirty
 * + apply/clear/revert รวมกับ CRUD ทั้งหมดจาก `useListViews`)
 * @param props.snapshot - ค่าตัวกรอง + sort ปัจจุบันของหน้า ใช้ตอน save/update view
 * @returns JSX element ของปุ่ม dropdown เลือก view
 * @example
 * ```tsx
 * <ViewSelector view={view} snapshot={{ filters: values, sort: sortParam }} />
 * ```
 */
export function ViewSelector({ view, snapshot }: ViewSelectorProps) {
  const tv = useTranslations("listView");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renamePending, setRenamePending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const {
    current,
    scope,
    isDirty,
    userViews,
    buViews,
    isLoading,
    error,
    canManageBu,
  } = view;

  // scope user จัดการได้เสมอ (view ของตัวเอง) — scope bu ต้องเป็น admin ของ BU
  const canUpdateCurrent = scope === "user" || (scope === "bu" && canManageBu);
  const isEmpty = userViews.length === 0 && buViews.length === 0;

  const label = current
    ? `${current.name}${isDirty ? ` ${tv("modified")}` : ""}`
    : tv("noView");

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APP_CONFIGS] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APP_USER_CONFIGS] });
  };

  const openRename = (v: SavedView, rowScope: ViewScope) => {
    setRenameTarget({ id: v.id, scope: rowScope, name: v.name });
    setRenameValue(v.name);
    setRenameError(null);
  };

  const confirmRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError(tv("nameRequired"));
      return;
    }
    setRenamePending(true);
    try {
      await view.rename(renameTarget.id, renameTarget.scope, trimmed);
      setRenameTarget(null);
    } finally {
      setRenamePending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    try {
      await view.remove(deleteTarget.id, deleteTarget.scope);
      // ลบ view ที่กำลัง apply อยู่ — ล้าง `sv` ตามไปด้วยไม่งั้น URL จะชี้ view ที่หายไปแล้ว
      if (current?.id === deleteTarget.id) view.clear();
      setDeleteTarget(null);
    } finally {
      setDeletePending(false);
    }
  };

  const renderRow = (v: SavedView, rowScope: ViewScope, canManage: boolean) => {
    const isCurrent = v.id === current?.id;
    const applyItem = (
      <DropdownMenuItem
        key={v.id}
        className={canManage ? "min-w-0 flex-1" : undefined}
        onClick={() => view.apply(v)}
      >
        {isCurrent ? (
          <Check className="size-3.5 shrink-0" />
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        <Bookmark className="size-3.5 shrink-0" />
        <span className="truncate">{v.name}</span>
      </DropdownMenuItem>
    );

    if (!canManage) return applyItem;

    return (
      <div key={v.id} className="flex items-center gap-0.5">
        {applyItem}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className="w-auto shrink-0 gap-0 px-1.5"
            aria-label={tc("rowActions")}
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => openRename(v, rowScope)}>
              <Pencil className="size-3.5" />
              {tv("rename")}
            </DropdownMenuItem>
            {isCurrent && isDirty && canUpdateCurrent && (
              <DropdownMenuItem
                onClick={() => {
                  void view.update(v.id, rowScope, snapshot);
                }}
              >
                <Save className="size-3.5" />
                {tv("updateView")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                setDeleteTarget({ id: v.id, scope: rowScope, name: v.name })
              }
            >
              <Trash2 className="size-3.5" />
              {tv("delete")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </div>
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="max-w-64 justify-between"
          >
            <Bookmark aria-hidden="true" className="size-3.5 shrink-0" />
            {/* ชื่อ field จาง ค่าเข้ม — ภาษาเดียวกับ chip ใน ActiveFilterBar */}
            <span className="truncate">
              <span className="text-muted-foreground">{tv("view")}: </span>
              {label}
            </span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {isDirty && current && scope && (
            <>
              <DropdownMenuGroup>
                {canUpdateCurrent && (
                  <DropdownMenuItem
                    onClick={() => {
                      void view.update(current.id, scope, snapshot);
                    }}
                  >
                    <Save className="size-3.5" />
                    {tv("updateView")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
                  <Copy className="size-3.5" />
                  {tv("saveAsNew")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => view.revert()}>
                  <RotateCcw className="size-3.5" />
                  {tv("revert")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem onClick={() => view.clear()}>
            {!current ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <span className="size-3.5 shrink-0" />
            )}
            <BookmarkX className="size-3.5 shrink-0" />
            {tv("noView")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {isLoading && (
            <DropdownMenuItem disabled>
              <Loader2 className="size-3.5 animate-spin" />
              {tc("loading")}
            </DropdownMenuItem>
          )}

          {!isLoading && error && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
              <span className="text-destructive">{tv("loadError")}</span>
              <Button variant="outline" size="xs" onClick={handleRetry}>
                {tv("retry")}
              </Button>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {isEmpty && (
                <DropdownMenuItem disabled>{tv("empty")}</DropdownMenuItem>
              )}
              {userViews.length > 0 && (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <UserRound className="size-3.5 shrink-0" />
                    {tv("myViews")}
                  </DropdownMenuLabel>
                  {userViews.map((v) => renderRow(v, "user", true))}
                </DropdownMenuGroup>
              )}
              {buViews.length > 0 && (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Building2 className="size-3.5 shrink-0" />
                    {tv("buViews")}
                  </DropdownMenuLabel>
                  {buViews.map((v) => renderRow(v, "bu", canManageBu))}
                </DropdownMenuGroup>
              )}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
            <Save className="size-3.5" />
            {tv("saveCurrent")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveViewDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        canManageBu={canManageBu}
        existingNames={view.existingNames}
        onSave={view.saveOrUpdate}
      />

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open && !renamePending) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tv("rename")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="view-rename-name">{tv("name")}</Label>
            <Input
              id="view-rename-name"
              value={renameValue}
              onChange={(e) => {
                setRenameValue(e.target.value);
                setRenameError(null);
              }}
              maxLength={120}
              disabled={renamePending}
              aria-invalid={!!renameError}
            />
            {renameError && (
              <p className="text-destructive text-xs">{renameError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRenameTarget(null)}
              disabled={renamePending}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmRename}
              disabled={renamePending}
            >
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deletePending && setDeleteTarget(null)
        }
        title={tv("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deletePending}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </>
  );
}
