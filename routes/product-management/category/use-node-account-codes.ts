import { useCategoryById } from "@/hooks/use-category";
import { useSubCategoryById } from "@/hooks/use-sub-category";
import { useItemGroupById } from "@/hooks/use-item-group";
import {
  NODE_TYPE,
  type AccountCodeEntry,
  type CategoryNode,
} from "@/types/category";

/**
 * โหลด account_codes ของ node เดียวผ่าน GET รายตัว — GET list ของ category /
 * sub-category / item group ไม่ส่งฟิลด์นี้มา (backend ใส่เฉพาะ findOne)
 * จึงต้องยิง detail ตามชนิดของ node; ชนิดที่ไม่ตรงได้ id undefined = query ปิด
 * @param node - node ที่ต้องการ (undefined = ไม่โหลด)
 * @returns codes (undefined ระหว่างโหลด/ไม่มี node), isLoading, isError
 */
export function useNodeAccountCodes(node: CategoryNode | undefined): {
  codes: AccountCodeEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const cat = useCategoryById(
    node?.type === NODE_TYPE.CATEGORY ? node.id : undefined,
  );
  const sub = useSubCategoryById(
    node?.type === NODE_TYPE.SUBCATEGORY ? node.id : undefined,
  );
  const ig = useItemGroupById(
    node?.type === NODE_TYPE.ITEM_GROUP ? node.id : undefined,
  );

  const q =
    node?.type === NODE_TYPE.CATEGORY
      ? cat
      : node?.type === NODE_TYPE.SUBCATEGORY
        ? sub
        : node?.type === NODE_TYPE.ITEM_GROUP
          ? ig
          : undefined;

  if (!q) return { codes: undefined, isLoading: false, isError: false };
  return {
    codes: q.data ? (q.data.account_codes ?? []) : undefined,
    isLoading: q.isLoading,
    isError: q.isError,
  };
}
