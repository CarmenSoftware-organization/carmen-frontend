---
title: "แผงแจ้งเตือนบนแถบบนยังเป็น popover ทุกขนาดจอ แต่กว้างไม่เกินจอ พื้นทึบ แถวแบน และปุ่มอ่านแล้วเห็นตลอดบนจอสัมผัส"
author: Thammanoon
date: 2026-11-18
branch: feature/notification-popover-mobile
cost: { minutes: 3, tokens: 37131 }
id: l-4a6509da
scope: repo
status: active
src: agent
touches:
  - components/navbar/bu-switcher.tsx
  - components/navbar/navbar.tsx
  - components/navbar/path-breadcrumb.tsx
  - components/navbar/user-profile.tsx
  - components/navbar/notification.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกให้แผงแจ้งเตือน (กดกระดิ่งบนแถบบน) ยังเป็น popover ทุกขนาดจอ แต่ปรับให้ใช้บนมือถือได้
- กว้างไม่เกินจอ เหลือขอบ 8px
- สูงไม่เกินพื้นที่ที่เหลือใต้ปุ่ม
- พื้นทึบ
- แถวแบนคั่นเส้น ไม่ใช่การ์ดในการ์ด
- ชื่อเรื่องขึ้นได้ 2 บรรทัด ใช้รูปแบบเดียวกับหน้า /notifications
- ปุ่ม ✓ (อ่านแล้ว) เห็นตลอดบนจอสัมผัส

## Tried and ruled out
- Sheet เต็มจอบนมือถือ คู่กับ popover บนจอกว้าง: ต้องดูแลโค้ดสองทาง ผู้ใช้ไม่เลือก
- บนมือถือให้กระดิ่งพาไปหน้า /notifications เลย: เปลี่ยนน้อยที่สุด แต่ผู้ใช้ต้องออกจากหน้าที่ทำงานอยู่
- ของเดิม: กว้างตายตัว 432px ล้นจอ 360 จนปุ่ม Clear / ↗ และเวลาหาย, พื้นโปร่ง + blur ทำให้ตารางข้างหลังทะลุขึ้นมา, ปุ่ม ✓ โผล่เฉพาะตอน hover จึงนิ้วกดไม่ได้

## Watch out
- ปุ่ม ✓ ซ่อนด้วย `pointer-fine:` ไม่ใช่ซ่อนเสมอ ตรวจในเบราว์เซอร์ที่ใช้เมาส์จะเห็นว่าหาย ซึ่งถูกต้องแล้ว อย่าเปลี่ยนกลับเป็น `opacity-0 group-hover:` เพราะจอสัมผัสจะกดไม่ได้อีก
- แถวต้องมี `relative` เพราะลิงก์ทั้งแถวเป็น `absolute inset-0` ของเดิมรอดมาได้เพราะ backdrop-blur บังเอิญสร้าง containing block ให้

In the code: components/navbar/notification.tsx: PopoverContent `w-[min(27rem,calc(100vw-1rem))]` `max-h-[min(34rem,var(--radix-popover-content-available-height))]` collisionPadding={8}; list `divide-y`; NotificationItemContent `clampMessage`
