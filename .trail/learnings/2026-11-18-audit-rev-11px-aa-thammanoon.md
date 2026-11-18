---
title: "ตาราง audit ในหัวเอกสารรวมเลขรุ่น (rev.) ตัว 11px สีจางได้แค่เส้นขอบ ตัวอักษรต้องผ่าน AA"
author: Thammanoon
date: 2026-11-18
branch: feature/doc-header-rev-label
cost: { minutes: 29, tokens: 120115 }
id: l-82b4bd33
scope: repo
status: active
replaces: l-55051db6
src: agent
touches:
  - components/share/doc-audit-line.tsx
  - components/ui/summary-bar.tsx
  - messages/en.json
  - messages/th.json
  - routes/procurement/credit-note/cn-footer-action.tsx
  - routes/procurement/credit-note/cn-form.tsx
  - routes/procurement/credit-note/cn-header.tsx
  - routes/procurement/goods-receive-note/grn-form.tsx
  - routes/procurement/goods-receive-note/grn-header.tsx
  - routes/procurement/goods-receive-note/grn-summary-footer.tsx
---

## Decided
2026-11-18 ต่อจากตาราง audit ในการ์ดหัวเอกสาร PR/PO/GRN/CN/SR (มือถือเป็นไอคอน Info + popover):
- เลขรุ่นเอกสาร (doc_version) ย้ายออกจากข้างป้ายสถานะ ไปเป็นคอลัมน์ขวาสุดของตาราง audit ช่องเดียว rowSpan เต็มทุกแถว ป้าย "rev." (คีย์ field.revision ทั้ง en/th; field.version "Edition/ฉบับที่" ยังอยู่ไม่ได้ลบ)
- ตัวอักษร 11px (text-micro) ผู้ใช้ดู 10px แล้วสั่งให้ใหญ่ขึ้น
- ผู้ใช้สั่งให้กลืนกับพื้นหลัง ไม่ดึงสายตา: เส้นขอบ border-border/40 ไม่มีพื้นช่องป้าย

## Tried and ruled out
- "Edition x" / "rev. x" ข้างป้ายสถานะบนหัวเอกสาร: ผู้ใช้สั่งเอาออกแล้วไปใส่ในตาราง audit
- text-muted-foreground/70 เพื่อให้จาง: วัดจริง 3.09:1 (dark) / 3.45:1 (light) ตก WCAG AA 4.5:1 — สีเต็มได้ 4.90 / 7.11
- 10px: ผู้ใช้ว่าเล็กไป · ต่ำกว่า 10px ตัดสระบนภาษาไทย

## Watch out
- จะทำให้จางกว่านี้ให้ลดที่เส้นขอบ/พื้น ห้ามลดความทึบตัวอักษร
- doc_version 0 เป็นค่าจริง ใช้ `!= null` ตัดสินว่ามีช่อง rev.
- popover บนมือถือปิด onOpenAutoFocus — เปิดด้วย hover ไม่ดึงโฟกัส
- PO/GRN/CN/SR กัน grid ฟิลด์ไว้ 64rem ที่ HD ตารางตกบรรทัดใต้ฟิลด์ (ดู learning ก่อนหน้า)

In the code: components/share/doc-audit-line.tsx (DocAuditLine docVersion, DocAuditButton) · ribbon ใน pr/po/grn/cn/sr-header.tsx · messages field.revision
