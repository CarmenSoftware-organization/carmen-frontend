import { useCallback } from "react";
import { useLocation, useNavigate, type NavigateOptions } from "react-router";

/**
 * จำ query ของหน้า list (filter / sort / page / view …) ข้ามไปหน้า detail แล้วพากลับ
 *
 * ปุ่ม Back ในฟอร์มทุกใบ = "กลับหน้า list เสมอ" ไม่ใช่ history back (กดครั้งเดียว
 * ต้องถึง list ไม่ใช่ถอยทีละหน้า) แต่การ navigate ไป list path เปล่า ๆ ทิ้ง query
 * ที่ list เก็บไว้ใน URL ทั้งหมด — กรอง in_progress ไว้ กดเข้าใบหนึ่ง กด Back แล้ว
 * ตัวกรองหาย
 *
 * วิธีแก้: ฝั่ง list แนบ `window.location.search` ของตัวเองไปกับ `state` ตอน
 * navigate เข้า detail ({@link listReturnState}) · ฝั่งฟอร์มอ่านค่านั้นมาต่อท้าย
 * list path ตอนออก ({@link useListReturn}) · ไม่มี state (เปิดจาก deep link / เมนู)
 * ก็ไป list เปล่าเหมือนเดิม · detail → detail ในโมดูลเดียวกัน (create สำเร็จแล้ว
 * replace ไป /:id, duplicate ไป /new) ต้องส่ง `returnState` ต่อ ไม่งั้น Back จาก
 * ใบที่เพิ่งสร้างจะหลุด
 *
 * ทำไมไม่ใช้ `navigate(-1)` — history คือเส้นทางที่เดินผ่านมา ไม่ใช่ที่ที่อยากกลับไป
 * ทำไมไม่ใช้ sessionStorage — ตัวกรองเก่าจะโผล่ตอนเปิดใบจากอีเมล/เมนูโดยไม่ได้ตั้งใจ
 *
 * ค่าอยู่ใน `history.state` ของ React Router จึงรอด refresh หน้า detail · ยกเว้น
 * refresh ขณะฟอร์ม dirty (navigation guard ดัน sentinel ด้วย pushState ดิบซึ่งไม่มี
 * `usr`) → Back ไป list เปล่า ยอมรับได้
 */

const LIST_RETURN_KEY = "listReturnTo";

/** pathname + search ของหน้า list ที่กดเข้ามา เช่น `/procurement/purchase-request?filter=…` */
type ListReturnState = { [LIST_RETURN_KEY]: string };

/**
 * ฝั่ง list: options ของ `navigate()` ที่แนบ query ปัจจุบันไป
 *
 * อ่านจาก `window.location.search` ไม่ใช่ `useLocation().search` — `useURL`
 * เขียน query ด้วย `replaceState` ตรง ๆ ซึ่ง React Router ไม่รู้ location ของ
 * router จึงล้าได้
 *
 * @example
 * navigate(`/procurement/purchase-request/${item.id}`, listReturnState());
 */
export function listReturnState(): { state: ListReturnState } {
  return {
    state: {
      [LIST_RETURN_KEY]: `${window.location.pathname}${window.location.search}`,
    },
  };
}

/**
 * list path พร้อม query ที่แนบมา — ใช้ค่าที่แนบมาก็ต่อเมื่อ pathname ตรงกับ
 * `listPath` ของฟอร์มนี้เท่านั้น เก็บ pathname ไว้ด้วยเพราะ state เดินทางข้ามโมดูลได้
 * (wastage-reporting เปิด GRN detail ตรง ๆ) ถ้าเอา query ของ list อื่นมาต่อท้าย
 * list ของตัวเองจะได้ตัวกรองที่ไม่มีความหมาย
 *
 * list ที่แยกมุมมองด้วย path (spot-check `/` กับ `/history`) ส่งเป็น array —
 * ตัวแรกคือปลายทางเมื่อไม่มี state ตัวอื่นแค่ยอมรับเป็นที่กลับได้
 */
export function resolveListPath(
  listPath: string | readonly string[],
  state: unknown,
): string {
  const paths = typeof listPath === "string" ? [listPath] : listPath;
  const fallback = paths[0];
  if (typeof state !== "object" || state === null) return fallback;
  const value = (state as Record<string, unknown>)[LIST_RETURN_KEY];
  if (typeof value !== "string") return fallback;
  const query = value.indexOf("?");
  const pathname = query === -1 ? value : value.slice(0, query);
  return paths.includes(pathname) ? value : fallback;
}

/**
 * ฝั่งฟอร์ม: ทางออกไป list ทุกทาง (Back / Cancel / หลัง mutation สำเร็จ / dialog)
 * ต้องผ่าน `toList()` ตัวเดียว · detail → detail ส่ง `returnState` ต่อ
 *
 * @example
 * const { toList, returnState } = useListReturn("/procurement/purchase-request");
 * const goBack = () => toList();
 * navigate(`/procurement/purchase-request/${id}`, { replace: true, ...returnState });
 *
 * `listPath` เป็น array ต้องเป็นค่าคงที่ระดับโมดูล — literal ใน render ทำให้
 * `toList` เปลี่ยนตัวทุก render
 */
export function useListReturn(listPath: string | readonly string[]) {
  const navigate = useNavigate();
  const { state } = useLocation();

  // ไม่ส่ง options เป็น undefined ต่อ — characterization test ของฟอร์มพิน
  // `navigate("/list")` แบบอาร์กิวเมนต์เดียวไว้ และ `(path, undefined)` ไม่เท่ากัน
  const toList = useCallback(
    (options?: NavigateOptions) => {
      const to = resolveListPath(listPath, state);
      return options === undefined ? navigate(to) : navigate(to, options);
    },
    [navigate, listPath, state],
  );

  /**
   * ส่ง state ต่อตอนไป detail อีกใบในโมดูลเดียวกัน — spread ลง options
   * (`{ replace: true, ...returnState }`) หรือส่งเป็น options ตรง ๆ ก็ได้ ·
   * `undefined` เมื่อไม่มี state จะได้ไม่เพิ่มอาร์กิวเมนต์/คีย์ที่ไม่มีความหมาย
   */
  const returnState: { state: unknown } | undefined =
    state == null ? undefined : { state };

  return { toList, returnState };
}
