---
title: "แผงแจ้งเตือนบนแถบบนยังเป็น popover ทุกขนาดจอ กว้างไม่เกินจอ พื้นทึบ แถวแบนแบบแน่น และปุ่มอ่านแล้วเห็นตลอดบนจอสัมผัส"
author: Thammanoon
date: 2026-11-18
branch: feature/notification-popover-mobile
cost: { minutes: 2, tokens: 19311 }
id: l-9a7f9ce2
scope: repo
status: active
replaces: l-4a6509da
src: agent
touches:
  - components/navbar/notification.tsx
  - components/navbar/notification-item-content.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกให้แผงแจ้งเตือน (กดกระดิ่งบนแถบบน) ยังเป็น popover ทุกขนาดจอ แต่ปรับให้ใช้บนมือถือได้
- กว้างไม่เกินจอ เหลือขอบ 8px
- สูงไม่เกินพื้นที่ที่เหลือใต้ปุ่ม
- พื้นทึบ
- แถวแบนคั่นเส้น ไม่ใช่การ์ดในการ์ด
- ปุ่ม ✓ (อ่านแล้ว) เห็นตลอดบนจอสัมผัส

จากนั้นผู้ใช้สั่ง "ทำให้ message compact ขึ้นอีก" แถวในแผงจึงใช้แบบแน่นของตัวเอง (โหมด compact)
- ชื่อเรื่องขึ้นได้ 2 บรรทัด
- ใต้ชื่อเรื่องเป็นบรรทัดเดียว: BU · เวลา · ข้อความ (ข้อความตัดด้วย …)
- ไอคอน 28px
- แถวสูงราว 53px ถ้าชื่อเรื่องตก 2 บรรทัดจะสูง 72px (เดิมราว 100px)

หน้า /notifications ยังใช้แบบเดิม (clampMessage) คือข้อความ 2 บรรทัด

## Tried and ruled out
- Sheet เต็มจอบนมือถือ คู่กับ popover บนจอกว้าง: ต้องดูแลโค้ดสองทาง ผู้ใช้ไม่เลือก
- บนมือถือให้กระดิ่งพาไปหน้า /notifications เลย: ผู้ใช้ต้องออกจากหน้าที่ทำงานอยู่
- ใช้แบบ clampMessage ของหน้า /notifications ในแผง (รอบแรก): แถวสูงราว 100px ผู้ใช้บอกว่ายังไม่แน่นพอ
- ของเดิม: กว้างตายตัว 432px ล้นจอ 360, พื้นโปร่ง + blur ทำให้ตารางข้างหลังทะลุขึ้นมา, ปุ่ม ✓ โผล่เฉพาะตอน hover จึงนิ้วกดไม่ได้

## Watch out
- ปุ่ม ✓ ซ่อนด้วย `pointer-fine:` ตรวจในเบราว์เซอร์ที่ใช้เมาส์จะเห็นว่าหาย ซึ่งถูกต้องแล้ว อย่าเปลี่ยนกลับเป็น `opacity-0 group-hover:` เพราะจอสัมผัสจะกดไม่ได้อีก
- แถวต้องมี `relative` เพราะลิงก์ทั้งแถวเป็น `absolute inset-0`
- แก้แบบแถวของแผง ให้แก้ที่ branch `compact` ไม่ใช่ที่ clampMessage ไม่งั้นหน้า /notifications เปลี่ยนตามไปด้วย

In the code: components/navbar/notification.tsx (PopoverContent `w-[min(27rem,calc(100vw-1rem))]`, `max-h-[min(34rem,var(--radix-popover-content-available-height))]`, collisionPadding={8}, list `divide-y`, `<NotificationItemContent compact />`) · components/navbar/notification-item-content.tsx (prop `compact`)
