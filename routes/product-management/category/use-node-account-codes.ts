import { useCategoryById } from "@/hooks/use-category";
import { useSubCategoryById } from "@/hooks/use-sub-category";
import { useItemGroupById } from "@/hooks/use-item-group";
import {
  NODE_TYPE,
  type AccountCodeEntry,
  type CategoryNode,
} from "@/types/category";

/** ไม่ใช้ cache ของ GET รายตัว — ดูเหตุผลที่ useNodeAccountCodes */
const FRESH = { staleTime: 0, refetchOnMount: "always" } as const;

/**
 * โหลด account_codes ของ node เดียวผ่าน GET รายตัว — GET list ของ category /
 * sub-category / item group ไม่ส่งฟิลด์นี้มา (backend ใส่เฉพาะ findOne)
 * จึงต้องยิง detail ตามชนิดของ node; ชนิดที่ไม่ตรงได้ id undefined = query ปิด
 *
 * ต้องได้ค่าสดทุกครั้งที่เปิด dialog — ฟอร์มคำนวณ diff add/update/remove จาก codes
 * ชุดนี้ ถ้าใช้ cache เก่า (profile ปกติ stale 30 นาที) diff จะผิด จึงตั้ง staleTime: 0
 * (query key เปลี่ยนจาก id undefined → id ทุกครั้งที่เปิด = ยิงใหม่) และถือว่า
 * "ยังไม่มี codes" จนกว่าจะ fetch สำเร็จหลังเปิด (`isFetchedAfterMount`) — ระหว่างนั้น
 * cache เก่ายังอยู่ใน `data` แต่ไม่ส่งออกไป
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
    FRESH,
  );
  const sub = useSubCategoryById(
    node?.type === NODE_TYPE.SUBCATEGORY ? node.id : undefined,
    FRESH,
  );
  const ig = useItemGroupById(
    node?.type === NODE_TYPE.ITEM_GROUP ? node.id : undefined,
    FRESH,
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
  const fresh = q.isFetchedAfterMount && !q.isError;
  return {
    codes: fresh && q.data ? (q.data.account_codes ?? []) : undefined,
    isLoading: q.isFetching && !q.isFetchedAfterMount,
    isError: q.isError,
  };
}
