/** มุมมองของหน้า list แยกด้วย path — `/spot-check` = locations, `/spot-check/history` = history */
export const SC_LIST_PATH = "/inventory-management/spot-check";
export const SC_HISTORY_PATH = `${SC_LIST_PATH}/history`;

/** ที่กลับได้จากหน้าใบ — ตัวแรกคือปลายทางเมื่อเปิดใบจาก deep link (ดู `useListReturn`) */
export const SC_LIST_PATHS = [SC_LIST_PATH, SC_HISTORY_PATH] as const;
