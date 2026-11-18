---
title: "การ์ดรายการ PR บนมือถือใช้แบบกระชับไม่มี label ส่วนผังฟิลด์สองคอลัมน์ทำให้การ์ดสูงขึ้นแทนที่จะเตี้ยลง"
author: Thammanoon
date: 2026-11-18
branch: fix/pr-list-mobile-cards
cost: { minutes: 9, tokens: 168863 }
id: l-57c89752
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request/pr-card.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกการ์ด PR แบบกระชับสำหรับมือถือ: หัวการ์ดเป็นเลขที่ + ชิปสถานะ (มีชิป Send Back เฉพาะใบที่ถูกตีกลับ) ตามด้วยบรรทัดสรุปไม่มี label สามบรรทัด (วันที่·ประเภท / ผู้ขอ·แผนก / stage + ยอดเงินชิดขวา) ไม่มี audit ในการ์ด ที่ 390px การ์ดสูงลดจาก 306 เหลือ 170px (มีปุ่มลบ) หรือ 133px (ไม่มีปุ่มลบ) โหมด grid บนจอกว้างยังใช้การ์ดเต็มที่มี label
ปุ่ม My pending / All Documents ของ PR/PO/SR ขึ้นบนแถบเครื่องมือของมือถือแล้ว (ปุ่มคู่เต็มความกว้าง) และเอาตัวซ้ำในชีต Filter ออก เพราะเดิมขอบเขตค่าเริ่มต้น (My pending) มองไม่เห็นเลยบนมือถือ

## Tried and ruled out
ผังฟิลด์สองคอลัมน์ใน ListCard กลาง (label อยู่เหนือค่า เรียงสองคอลัมน์): การ์ดกลับสูงขึ้นจาก 306 เป็น 324px เพราะข้อมูลแต่ละคู่ยังกินสองบรรทัดเหมือนเดิม การเรียงเป็นสองคอลัมน์ไม่ได้ช่วยลดความสูงเมื่อค่าเป็นข้อความสั้นบรรทัดเดียว

## Watch out
การ์ดแบบกระชับขัดกับข้อตกลงเดิมของ ListCard (สถานะต้องเป็นแถวที่มี label และแถว Send Back ต้องขึ้นทุกใบ) ผู้ใช้ตัดสินให้ยกเว้นเฉพาะการ์ด PR บนมือถือ PO/SR/GRN/CN/IA ยังเป็นการ์ดเต็ม

In the code: routes/procurement/purchase-request/pr-card.tsx prop `compact`, pr-card-list.tsx, pr-component.tsx `compact={!!isMobile}`; ViewModeToggle className "grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto" ใน pr/po/sr-component; ลบ field view_mode_toggle ออกจาก use-pr-filter-fields.tsx, po-component.tsx, sr-component.tsx
