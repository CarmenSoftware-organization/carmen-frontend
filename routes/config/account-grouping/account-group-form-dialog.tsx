import { useState } from "react";
import { useTranslations } from "use-intl";
import { FolderPlus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ACCOUNT_CATEGORIES,
  type AccountCategory,
} from "@/types/chart-of-accounts";
import type {
  AccountGroupNode,
  GroupTreeLevel,
} from "./account-grouping-types";

interface AccountGroupFormDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: "add" | "edit";
  readonly initialNode?: AccountGroupNode | null;
  readonly defaultParentNode?: AccountGroupNode | null;
  readonly parentOptions: AccountGroupNode[];
  readonly onLevelChange?: (level: GroupTreeLevel) => void;
  readonly onSubmit: (data: {
    code: string;
    name: string;
    name_local?: string;
    level: GroupTreeLevel;
    parent_id: string | null;
    category: AccountCategory;
    sort_order?: number;
  }) => void;
  readonly isPending?: boolean;
}

export function AccountGroupFormDialog(props: AccountGroupFormDialogProps) {
  const { open, onOpenChange, mode, initialNode, defaultParentNode } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <AccountGroupFormContent
          key={`${mode}-${initialNode?.id ?? "new"}-${defaultParentNode?.id ?? "root"}`}
          {...props}
        />
      )}
    </Dialog>
  );
}

function AccountGroupFormContent({
  onOpenChange,
  mode,
  initialNode,
  defaultParentNode,
  parentOptions,
  onLevelChange,
  onSubmit,
  isPending = false,
}: AccountGroupFormDialogProps) {
  const t = useTranslations("config.accountGrouping");

  const [level, setLevel] = useState<GroupTreeLevel>(() => {
    if (mode === "edit" && initialNode) return initialNode.level;
    if (defaultParentNode) {
      return Math.min(defaultParentNode.level + 1, 4) as GroupTreeLevel;
    }
    return 1;
  });

  const [parentId, setParentId] = useState<string>(() => {
    if (mode === "edit" && initialNode) return initialNode.parent_id ?? "";
    if (defaultParentNode) return defaultParentNode.id;
    return "";
  });

  const [code, setCode] = useState(() => (mode === "edit" && initialNode ? initialNode.code : ""));
  const [nameEn, setNameEn] = useState(() => (mode === "edit" && initialNode ? initialNode.name : ""));
  const [nameTh, setNameTh] = useState(() => (mode === "edit" && initialNode ? initialNode.name_local ?? "" : ""));
  const [category, setCategory] = useState<AccountCategory>(() => {
    if (mode === "edit" && initialNode) return initialNode.category;
    if (defaultParentNode) return defaultParentNode.category;
    return "asset";
  });
  const [sortOrder] = useState<number>(() =>
    mode === "edit" && initialNode ? initialNode.sort_order ?? 0 : 0,
  );

  const handleLevelSelect = (lvlVal: string) => {
    const nextLvl = Number(lvlVal) as GroupTreeLevel;
    setLevel(nextLvl);
    setParentId("");
    onLevelChange?.(nextLvl);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !nameEn.trim()) return;
    if (level > 1 && !parentId) return;

    onSubmit({
      code: code.trim(),
      name: nameEn.trim(),
      name_local: nameTh.trim() || undefined,
      level,
      parent_id: level === 1 ? null : parentId,
      category,
      sort_order: sortOrder,
    });
  };

  const isEdit = mode === "edit";

  return (
    <DialogContent className="@container max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isEdit ? (
            <Pencil className="size-4 text-primary" />
          ) : (
            <FolderPlus className="size-4 text-primary" />
          )}
          <span>{isEdit ? t("dialog.editTitle") : t("dialog.addTitle")}</span>
        </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          {/* STEP 1: TARGET LEVEL */}
          <Field>
            <FieldLabel required>{t("dialog.targetLevel")}</FieldLabel>
            <Select
              value={String(level)}
              onValueChange={handleLevelSelect}
              disabled={isEdit || isPending}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t("dialog.level1")}</SelectItem>
                <SelectItem value="2">{t("dialog.level2")}</SelectItem>
                <SelectItem value="3">{t("dialog.level3")}</SelectItem>
                <SelectItem value="4">{t("dialog.level4")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {/* STEP 2: PARENT GROUP (MANDATORY IF LEVEL > 1) */}
          {level > 1 && (
            <Field>
              <FieldLabel required className="text-primary font-semibold">
                {t("dialog.parentGroup")} (Level {level - 1})
              </FieldLabel>
              <Select
                value={parentId}
                onValueChange={setParentId}
                disabled={isEdit || isPending}
              >
                <SelectTrigger size="sm" className="w-full border-primary/60">
                  <SelectValue placeholder={t("dialog.selectParent")} />
                </SelectTrigger>
                <SelectContent>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.code}] {p.name}
                      {p.assignedAccounts?.length ? ` (${p.assignedAccounts.length} accs)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Category */}
          <Field>
            <FieldLabel required>{t("dialog.category")}</FieldLabel>
            <Select
              value={category}
              onValueChange={(val) => setCategory(val as AccountCategory)}
              disabled={isPending || (level > 1 && !isEdit)}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Group Code */}
          <Field>
            <FieldLabel htmlFor="group-code" required>
              {t("dialog.code")}
            </FieldLabel>
            <FieldInput
              id="group-code"
              placeholder={t("dialog.codePlaceholder")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isPending}
              maxLength={20}
              className="font-mono"
            />
          </Field>

          {/* Group Name (EN) */}
          <Field>
            <FieldLabel htmlFor="group-name-en" required>
              {t("dialog.nameEn")}
            </FieldLabel>
            <FieldInput
              id="group-name-en"
              placeholder="e.g. Current Assets"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              disabled={isPending}
              maxLength={150}
            />
          </Field>

          {/* Group Name (TH) */}
          <Field>
            <FieldLabel htmlFor="group-name-th">
              {t("dialog.nameTh")}
            </FieldLabel>
            <FieldInput
              id="group-name-th"
              placeholder="เช่น สินทรัพย์หมุนเวียน"
              value={nameTh}
              onChange={(e) => setNameTh(e.target.value)}
              disabled={isPending}
              maxLength={150}
            />
          </Field>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("dialog.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !code.trim() || !nameEn.trim() || (level > 1 && !parentId)}
            >
              {t("dialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
  );
}
