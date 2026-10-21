# Project Config
**Project:** Carmen Blue (React SPA)
**Created:** 2026-09-29

## Domains

| Domain | Prefix | Description |
|--------|--------|-------------|
| All users | `CB-` | Prefix เดียวทั้งชุด — ความต่างตามบทบาท (Requestor / HOD / Purchase / Store / Admin) บันทึกในตาราง permission ของแต่ละเอกสาร ไม่แยก prefix |

## Status Value Convention

**Selected:** `snake_case` (ตรงกับค่าจริงจาก backend เช่น `in_progress`, `approved`, `voided`)

## Docs Root
`docs/ui/`

## Test Environment

| Field | Value |
|-------|-------|
| Base URL | `http://localhost:5173` (`VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev`) |
| Backend | Gateway `:4000` → **dev DB ร่วม (dev.blueledgers.com)** — การกดบันทึกเขียนข้อมูลจริง |
| BU (Test) | TBD — ระบุต่อ flow |
| Cluster | TBD |

### Test Users

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin (god mode) | admin@zebra.com | ดูจากทีม (ไม่เก็บในรีโป) | bypass permission — ไม่เหมาะกับการดูความต่างตามบทบาท |

> ข้อควรระวัง: ภาพถ่ายเอกสารให้ใช้มุม "My pending" — "All Documents" บน dev DB เป็นข้อมูล seed ที่ไม่สวย

## Templates
อยู่ที่ `docs/ui/references/`:

| Template | File | Use For |
|----------|------|---------|
| Feature Module | `feature-module-template.md` | End-to-end feature |
| Page | `page-template.md` | Individual screen |
| Modal | `modal-template.md` | Popup, dialog, side panel / sheet |
| Flow | `flow-template.md` | Multi-step workflow with diagram |
| Style Guide | `style-guide.md` | Formatting conventions |

## Folder Structure
```
docs/ui/
  modules/  flows/  pages/  modals/  errors/
  screenshots/<doc-id>/   exports/   references/
  project-config.md
  INDEX.md
```

## Doc ID Format

| Type | Pattern | Example |
|------|---------|---------|
| Page | `CB-PAGE-{NNN}-{slug}.md` | `CB-PAGE-001-pr-list.md` |
| Modal | `CB-MODAL-{NNN}-{slug}.md` | `CB-MODAL-001-item-search.md` |
| Flow | `CB-FLOW-{NNN}-{slug}.md` | `CB-FLOW-001-purchase-request.md` |
| Error Page | `CB-PAGE-ERR-{NNN}-{slug}.md` | `CB-PAGE-ERR-001-api-error.md` |
| Feature Module | `modules/CB-MODULE-{NN}-{slug}.md` (NN = เลขโมดูล) | `CB-MODULE-08-configuration.md` |

## Module Registry

เลขโมดูลเรียงตามโฟลเดอร์ใต้ `routes/` (หนึ่งโมดูล = หนึ่งหัวข้อระดับบน)

| Module No. | Module Name | Route folder | Status | Owner |
|-----------|-------------|--------------|--------|-------|
| 1 | Procurement | `routes/procurement/` | Planned | — |
| 2 | Inventory Management | `routes/inventory-management/` | Planned | — |
| 3 | Store Operation | `routes/store-operation/` | Planned | — |
| 4 | Vendor Management | `routes/vendor-management/` | Planned | — |
| 5 | Product Management | `routes/product-management/` | Planned | — |
| 6 | Operation Plan | `routes/operation-plan/` | Planned | — |
| 7 | Report | `routes/report/` | Planned | — |
| 8 | Configuration | `routes/config/` | Draft (18 pages · 14 modals, 2026-09-29) | — |
| 9 | System Admin | `routes/system-admin/` | Planned | — |
| 10 | Dashboard | `routes/dashboard/` | Planned | — |
